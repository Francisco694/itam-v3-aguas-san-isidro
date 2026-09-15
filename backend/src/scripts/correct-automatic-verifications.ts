import type { PoolClient } from "pg";
import { pool } from "../config/database";

const EVENT_TYPE = "CORRECCION_VERIFICACION_A_PENDIENTE";
const DESCRIPTION =
  "Verificación automática revertida por ajuste de regla operacional. Requiere verificación manual explícita.";
const APPLY_CONFIRMATION = "CORREGIR_VERIFICACION";

interface VerificationStateRow {
  dispositivo_id: string;
  codigo_itam: number;
  estado_id: string;
  resultado_actual: "PENDIENTE" | "VERIFICADO" | "REVISAR" | null;
  verificacion_actual_id: string | null;
  fecha_verificacion_actual: Date | string | null;
  evento_sospechoso_id: string | null;
  fecha_evento_sospechoso: Date | string | null;
  motivo_sospechoso: string | null;
  es_verificacion_automatica_actual: boolean;
}

interface ActorRow {
  id: string;
  nombre: string;
}

const argumentValue = (name: string): string | null => {
  const prefix = `--${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
};

export const parseCodes = (value: string | null): number[] => {
  if (!value?.trim()) {
    throw new Error("Debe indicar una lista explícita con --codes=1119,1272.");
  }
  const parts = value.split(",").map((part) => part.trim());
  if (parts.some((part) => !/^\d+$/.test(part))) {
    throw new Error("Todos los códigos ITAM deben ser enteros positivos separados por coma.");
  }
  const codes = parts.map(Number);
  if (codes.some((code) => !Number.isSafeInteger(code) || code <= 0)) {
    throw new Error("Todos los códigos ITAM deben ser enteros positivos válidos.");
  }
  if (new Set(codes).size !== codes.length) {
    throw new Error("La lista contiene códigos ITAM duplicados.");
  }
  return codes;
};

const loadStates = async (
  client: PoolClient,
  codes: number[]
): Promise<VerificationStateRow[]> => {
  const result = await client.query<VerificationStateRow>(
    `
      SELECT
        d.id AS dispositivo_id,
        d.codigo_inventario AS codigo_itam,
        d.estado_id,
        actual.resultado AS resultado_actual,
        actual.id AS verificacion_actual_id,
        actual.fecha_verificacion AS fecha_verificacion_actual,
        sospechoso.id AS evento_sospechoso_id,
        sospechoso.fecha_evento AS fecha_evento_sospechoso,
        sospechoso.detalle->>'motivo' AS motivo_sospechoso,
        COALESCE(
          actual.resultado = 'VERIFICADO'
          AND ABS(EXTRACT(EPOCH FROM (
            actual.fecha_verificacion - sospechoso.fecha_evento
          ))) <= 5,
          FALSE
        ) AS es_verificacion_automatica_actual
      FROM itam.dispositivos d
      LEFT JOIN LATERAL (
        SELECT v.id, v.resultado, v.fecha_verificacion
        FROM itam.verificaciones_fisicas_dispositivo v
        WHERE v.dispositivo_id = d.id
        ORDER BY v.fecha_verificacion DESC, v.id DESC
        LIMIT 1
      ) actual ON TRUE
      LEFT JOIN LATERAL (
        SELECT h.id, h.fecha_evento, h.detalle
        FROM itam.historial_eventos h
        WHERE h.dispositivo_id = d.id
          AND h.tipo_evento = 'VERIFICACION_FISICA'
          AND h.detalle->>'resultado' = 'VERIFICADO'
          AND h.detalle->>'motivo' IN (
            'equipo creado directamente en ITAM',
            'recibido en bodega',
            'recuperado de baja'
          )
        ORDER BY h.fecha_evento DESC, h.id DESC
        LIMIT 1
      ) sospechoso ON TRUE
      WHERE d.codigo_inventario = ANY($1::bigint[])
      ORDER BY d.codigo_inventario
      FOR UPDATE OF d
    `,
    [codes]
  );
  return result.rows;
};

const summaryRows = (
  states: VerificationStateRow[],
  result: "VERIFICADO" | "PENDIENTE"
) => states.map((state) => ({
  codigoItam: state.codigo_itam,
  resultado: result,
  verificacionActualId: state.verificacion_actual_id,
  eventoSospechosoId: state.evento_sospechoso_id,
  motivo: state.motivo_sospechoso
}));

const validateSelection = (
  codes: number[],
  states: VerificationStateRow[]
): void => {
  const found = new Set(states.map((state) => state.codigo_itam));
  const missing = codes.filter((code) => !found.has(code));
  if (missing.length) {
    throw new Error(`No existen los códigos ITAM: ${missing.join(", ")}.`);
  }
  const notVerified = states
    .filter((state) => state.resultado_actual !== "VERIFICADO")
    .map((state) => state.codigo_itam);
  if (notVerified.length) {
    throw new Error(`No están actualmente VERIFICADO: ${notVerified.join(", ")}.`);
  }
  const notLinked = states
    .filter((state) => !state.es_verificacion_automatica_actual)
    .map((state) => state.codigo_itam);
  if (notLinked.length) {
    throw new Error(
      `La verificación vigente no corresponde a la lógica automática auditada: ${notLinked.join(", ")}.`
    );
  }
};

const loadActor = async (
  client: PoolClient,
  actorIdValue: string | null
): Promise<ActorRow> => {
  if (!actorIdValue || !/^\d+$/.test(actorIdValue)) {
    throw new Error("El modo APPLY exige --usuario-id=<id de usuario ITAM>.");
  }
  const result = await client.query<ActorRow>(
    "SELECT id,nombre FROM itam.usuarios WHERE id=$1 AND activo=TRUE",
    [actorIdValue]
  );
  if (!result.rows[0]) {
    throw new Error("El usuario ITAM indicado no existe o está inactivo.");
  }
  return result.rows[0];
};

const applyCorrection = async (
  client: PoolClient,
  states: VerificationStateRow[],
  actor: ActorRow
): Promise<void> => {
  for (const state of states) {
    const verification = await client.query<{ id: string }>(
      `
        INSERT INTO itam.verificaciones_fisicas_dispositivo
          (dispositivo_id,encontrado,identificador_comprobado,
           identificador_esperado,resultado,observacion,usuario_id)
        VALUES ($1,FALSE,NULL,NULL,'PENDIENTE',$2,$3)
        RETURNING id
      `,
      [state.dispositivo_id, DESCRIPTION, actor.id]
    );
    await client.query(
      `
        INSERT INTO itam.historial_eventos
          (tipo_entidad,dispositivo_id,tipo_evento,estado_anterior_id,
           estado_nuevo_id,responsable,observaciones,detalle,
           usuario_ejecutor_id)
        VALUES ('DISPOSITIVO',$1,$2,$3,$3,$4,$5,$6::jsonb,$7)
      `,
      [
        state.dispositivo_id,
        EVENT_TYPE,
        state.estado_id,
        actor.nombre,
        DESCRIPTION,
        JSON.stringify({
          descripcion: DESCRIPTION,
          resultadoAnterior: "VERIFICADO",
          resultadoNuevo: "PENDIENTE",
          verificacionAnteriorId: state.verificacion_actual_id,
          verificacionCorreccionId: verification.rows[0]!.id,
          eventoSospechosoId: state.evento_sospechoso_id,
          motivoSospechoso: state.motivo_sospechoso
        }),
        actor.id
      ]
    );
  }
};

const printUsage = (): void => {
  console.log("DRY_RUN:");
  console.log("  npm run correction:automatic-verifications -- --codes=1119,1272");
  console.log("APPLY explícito:");
  console.log(
    `  npm run correction:automatic-verifications -- --codes=1119,1272 --usuario-id=1 --apply --confirm=${APPLY_CONFIRMATION}`
  );
};

const main = async (): Promise<void> => {
  if (process.argv.includes("--help")) {
    printUsage();
    return;
  }
  const codes = parseCodes(argumentValue("codes"));
  const apply = process.argv.includes("--apply");
  if (apply && argumentValue("confirm") !== APPLY_CONFIRMATION) {
    throw new Error(
      `El modo APPLY exige --confirm=${APPLY_CONFIRMATION}.`
    );
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const before = await loadStates(client, codes);
    console.log("ANTES");
    console.table(summaryRows(before, "VERIFICADO"));
    validateSelection(codes, before);

    if (!apply) {
      console.log("DESPUÉS (SIMULADO)");
      console.table(summaryRows(before, "PENDIENTE"));
      await client.query("ROLLBACK");
      console.log(
        `DRY_RUN completado. Códigos validados: ${codes.length}. Escrituras confirmadas: 0.`
      );
      return;
    }

    const actor = await loadActor(client, argumentValue("usuario-id"));
    await applyCorrection(client, before, actor);
    const after = await loadStates(client, codes);
    console.log("DESPUÉS");
    console.table(summaryRows(after, "PENDIENTE"));
    if (after.some((state) => state.resultado_actual !== "PENDIENTE")) {
      throw new Error("La validación posterior no confirmó PENDIENTE para todos los equipos.");
    }
    await client.query("COMMIT");
    console.log(
      `APPLY confirmado. Equipos corregidos: ${after.length}. Eventos ${EVENT_TYPE}: ${after.length}.`
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "No se pudo preparar la corrección.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
