import type { PoolClient } from "pg";
import { pool } from "../config/database";
import { env } from "../config/env";

const EVENT_TYPE = "EQUIPO_VERIFICADO_POR_REGISTRO_MANUAL";
const CONFIRMATION = "VERIFICAR_INGRESOS_MANUALES";
const DESCRIPTION = "Equipo verificado por registro manual en ITAM.";

interface ManualVerificationState {
  dispositivo_id: string;
  codigo_itam: number;
  estado_id: string;
  tipo_nombre: string;
  imei: string | null;
  numero_serie: string | null;
  origen_registro: "MANUAL" | "IMPORTADO" | "DESCONOCIDO";
  resultado_actual: "PENDIENTE" | "VERIFICADO" | "REVISAR" | null;
  verificacion_actual_id: string | null;
}

interface ActorRow { id: string; nombre: string; }

const argumentValue = (name: string): string | null => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
};

const parseCodes = (value: string | null): number[] => {
  if (!value?.trim()) throw new Error("Debe indicar --codes=4024 o una lista explícita de códigos ITAM.");
  const codes = value.split(",").map((part) => part.trim());
  if (codes.some((part) => !/^\d+$/.test(part))) throw new Error("--codes solo acepta enteros positivos separados por coma.");
  const parsed = codes.map(Number);
  if (parsed.some((code) => !Number.isSafeInteger(code) || code <= 0) || new Set(parsed).size !== parsed.length) {
    throw new Error("--codes contiene valores inválidos o duplicados.");
  }
  return parsed;
};

const loadStates = async (client: PoolClient, codes: number[]): Promise<ManualVerificationState[]> => {
  const result = await client.query<ManualVerificationState>(
    `
      SELECT d.id AS dispositivo_id, d.codigo_inventario AS codigo_itam,
             d.estado_id, tipo.nombre AS tipo_nombre, d.imei, d.numero_serie,
             origen.origen_registro, actual.resultado AS resultado_actual,
             actual.id AS verificacion_actual_id
        FROM itam.dispositivos d
        JOIN itam.tipos_dispositivo tipo ON tipo.id = d.tipo_dispositivo_id
        LEFT JOIN LATERAL (
          SELECT h.tipo_evento, h.detalle, h.responsable, h.observaciones
            FROM itam.historial_eventos h
           WHERE h.dispositivo_id = d.id
             AND h.tipo_entidad = 'DISPOSITIVO'
             AND h.tipo_evento IN (
               'ALTA_DISPOSITIVO','IMPORTAR_DISPOSITIVO','REGISTRO_IMPORTADO',
               'EQUIPO_CREADO','DISPOSITIVO_CREADO',
               'EQUIPO_INCORPORADO_AL_INVENTARIO','CONCILIAR_DISPOSITIVO_EXISTENTE'
             )
           ORDER BY h.fecha_evento ASC, h.id ASC
           LIMIT 1
        ) ingreso ON TRUE
        CROSS JOIN LATERAL (
          SELECT CASE
            WHEN ingreso.tipo_evento IN ('IMPORTAR_DISPOSITIVO','REGISTRO_IMPORTADO')
              OR ingreso.detalle ? 'source'
              OR ingreso.detalle ? 'importKey'
              OR ingreso.detalle ? 'historicalCode'
              OR COALESCE(ingreso.responsable, '') ILIKE 'Importador%'
              OR COALESCE(ingreso.observaciones, '') ILIKE 'Origen:%'
            THEN 'IMPORTADO'
            WHEN ingreso.tipo_evento IN ('ALTA_DISPOSITIVO','EQUIPO_CREADO','DISPOSITIVO_CREADO','EQUIPO_INCORPORADO_AL_INVENTARIO')
            THEN 'MANUAL'
            ELSE 'DESCONOCIDO'
          END AS origen_registro
        ) origen
        LEFT JOIN LATERAL (
          SELECT v.id, v.resultado
            FROM itam.verificaciones_fisicas_dispositivo v
           WHERE v.dispositivo_id = d.id
           ORDER BY v.fecha_verificacion DESC, v.id DESC
           LIMIT 1
        ) actual ON TRUE
       WHERE d.codigo_inventario = ANY($1::bigint[])
       ORDER BY d.codigo_inventario
       FOR UPDATE OF d
    `,
    [codes]
  );
  return result.rows;
};

const loadActor = async (client: PoolClient, value: string | null): Promise<ActorRow> => {
  if (!value || !/^\d+$/.test(value)) throw new Error("APPLY exige --usuario-id=<id de usuario ITAM>.");
  const result = await client.query<ActorRow>("SELECT id,nombre FROM itam.usuarios WHERE id=$1 AND activo=TRUE", [value]);
  if (!result.rows[0]) throw new Error("El usuario indicado no existe o está inactivo.");
  return result.rows[0];
};

const validate = (codes: number[], states: ManualVerificationState[]): void => {
  const found = new Set(states.map((state) => state.codigo_itam));
  const missing = codes.filter((code) => !found.has(code));
  if (missing.length) throw new Error(`No existen los códigos ITAM: ${missing.join(", ")}.`);
  const notManual = states.filter((state) => state.origen_registro !== "MANUAL");
  if (notManual.length) throw new Error(`Se detiene: no son MANUAL según el primer evento estructurado: ${notManual.map((state) => state.codigo_itam).join(", ")}.`);
};

const printStates = (states: ManualVerificationState[], mode: string): void => {
  console.table(states.map((state) => ({
    codigoItam: state.codigo_itam,
    origen: state.origen_registro,
    resultadoActual: state.resultado_actual ?? "SIN_REGISTRO",
    verificacionActualId: state.verificacion_actual_id,
    accion: state.resultado_actual === "VERIFICADO" ? "CONSERVAR" : "REGISTRAR_VERIFICADO"
  })));
  console.log(JSON.stringify({ mode, writesPerformed: false }, null, 2));
};

const apply = async (client: PoolClient, states: ManualVerificationState[], actor: ActorRow): Promise<number> => {
  let written = 0;
  for (const state of states) {
    if (state.resultado_actual === "VERIFICADO") continue;
    const expected = state.tipo_nombre.trim().toUpperCase() === "SMARTPHONE" ? state.imei : state.numero_serie;
    const verification = await client.query<{ id: string }>(
      `INSERT INTO itam.verificaciones_fisicas_dispositivo
         (dispositivo_id,encontrado,identificador_comprobado,identificador_esperado,
          resultado,observacion,usuario_id)
       VALUES ($1,TRUE,$2,$2,'VERIFICADO',$3,$4) RETURNING id`,
      [state.dispositivo_id, expected, DESCRIPTION, actor.id]
    );
    await client.query(
      `INSERT INTO itam.historial_eventos
         (tipo_entidad,dispositivo_id,tipo_evento,estado_anterior_id,estado_nuevo_id,
          responsable,observaciones,detalle,usuario_ejecutor_id)
       VALUES ('DISPOSITIVO',$1,$2,$3,$3,$4,$5,$6::jsonb,$7)`,
      [state.dispositivo_id, EVENT_TYPE, state.estado_id, actor.nombre, DESCRIPTION,
        JSON.stringify({ resultado: "VERIFICADO", verificacionId: verification.rows[0]!.id, descripcion: DESCRIPTION }), actor.id]
    );
    written += 1;
  }
  return written;
};

const main = async (): Promise<void> => {
  const codes = parseCodes(argumentValue("codes"));
  const applyMode = process.argv.includes("--apply");
  if (applyMode && argumentValue("confirm") !== CONFIRMATION) throw new Error(`APPLY exige --confirm=${CONFIRMATION}.`);
  const current = await pool.query<{ database: string }>("SELECT current_database() AS database");
  if (current.rows[0]?.database !== "itam_dev" || env.database.name !== "itam_dev") throw new Error("Corrección bloqueada: se exige la base itam_dev.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const states = await loadStates(client, codes);
    validate(codes, states);
    if (!applyMode) {
      printStates(states, "DRY_RUN");
      await client.query("ROLLBACK");
      return;
    }
    const actor = await loadActor(client, argumentValue("usuario-id"));
    const written = await apply(client, states, actor);
    await client.query("COMMIT");
    console.log(JSON.stringify({ mode: "APPLY", codes, written, writesPerformed: written > 0 }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

void main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : "Corrección fallida.", writesCommitted: false }));
  process.exitCode = 1;
}).finally(async () => { await pool.end().catch(() => undefined); });
