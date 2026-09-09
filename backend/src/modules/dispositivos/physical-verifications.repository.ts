import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/database";
import { currentUserId } from "../../shared/auth-context";
import type {
  DispositivoVerificacionRow,
  ResultadoVerificacionFisica,
  VerificacionFisicaInsert,
  VerificacionFisicaRow
} from "./physical-verifications.types";

type DbExecutor = Pool | PoolClient;

export const obtenerDispositivoParaVerificacion = async (
  codigo: number,
  client?: PoolClient
): Promise<DispositivoVerificacionRow | null> => {
  const result = await (client ?? pool).query<DispositivoVerificacionRow>(
    `SELECT d.id, d.estado_id, e.codigo AS estado_codigo,
            tipo.nombre AS tipo_nombre,
            d.numero_serie, d.imei, d.colaborador_id, d.departamento_id
       FROM itam.dispositivos d
       JOIN itam.estados e ON e.id = d.estado_id
       JOIN itam.tipos_dispositivo tipo ON tipo.id = d.tipo_dispositivo_id
      WHERE d.codigo_inventario = $1`,
    [codigo]
  );
  return result.rows[0] ?? null;
};

export const insertarVerificacionFisica = async (
  dispositivo: DispositivoVerificacionRow,
  input: VerificacionFisicaInsert,
  client?: PoolClient
): Promise<VerificacionFisicaRow> => {
  const executor: DbExecutor = client ?? (await pool.connect());
  const ownsTransaction = !client;
  try {
    if (ownsTransaction) await executor.query("BEGIN");
    const verification = await executor.query<VerificacionFisicaRow>(
      `INSERT INTO itam.verificaciones_fisicas_dispositivo
         (dispositivo_id, encontrado, identificador_comprobado,
          identificador_esperado, resultado, observacion, usuario_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, dispositivo_id, encontrado, identificador_comprobado,
                 identificador_esperado, resultado, observacion,
                 usuario_id, fecha_verificacion`,
      [
        dispositivo.id,
        input.encontrado,
        input.identificadorComprobado,
        input.identificadorEsperado,
        input.resultado,
        input.observacion,
        currentUserId()
      ]
    );
    await executor.query(
      `INSERT INTO itam.historial_eventos
         (tipo_entidad, dispositivo_id, tipo_evento, estado_anterior_id,
          estado_nuevo_id, responsable, observaciones, detalle,
          usuario_ejecutor_id)
       VALUES ('DISPOSITIVO',$1,'VERIFICACION_FISICA',$2,$2,$3,$4,$5::jsonb,$6)`,
      [
        dispositivo.id,
        dispositivo.estado_id,
        input.responsable,
        input.observacion,
        JSON.stringify({
          encontrado: input.encontrado,
          identificadorComprobado: input.identificadorComprobado,
          identificadorEsperado: input.identificadorEsperado,
          resultado: input.resultado,
          motivo: input.motivo ?? null
        }),
        currentUserId()
      ]
    );
    if (ownsTransaction) await executor.query("COMMIT");
    const row = verification.rows[0];
    const user = await executor.query<{ nombre: string; email: string }>(
      "SELECT nombre, email FROM itam.usuarios WHERE id = $1",
      [row.usuario_id]
    );
    return {
      ...row,
      usuario_nombre: user.rows[0]?.nombre ?? input.responsable,
      usuario_email: user.rows[0]?.email ?? ""
    };
  } catch (error) {
    if (ownsTransaction) await executor.query("ROLLBACK");
    throw error;
  } finally {
    if (ownsTransaction) (executor as PoolClient).release();
  }
};

export const obtenerUltimaVerificacionFisica = async (
  dispositivoId: string,
  client?: PoolClient
): Promise<ResultadoVerificacionFisica | null> => {
  const result = await (client ?? pool).query<{ resultado: ResultadoVerificacionFisica }>(
    `SELECT resultado
       FROM itam.verificaciones_fisicas_dispositivo
      WHERE dispositivo_id = $1
      ORDER BY fecha_verificacion DESC, id DESC
      LIMIT 1`,
    [dispositivoId]
  );
  return result.rows[0]?.resultado ?? null;
};

export const listarVerificacionesFisicas = async (
  codigo: number
): Promise<VerificacionFisicaRow[]> => {
  const result = await pool.query<VerificacionFisicaRow>(
    `SELECT v.id, v.dispositivo_id, v.encontrado,
            v.identificador_comprobado, v.identificador_esperado,
            v.resultado, v.observacion, v.usuario_id,
            u.nombre AS usuario_nombre, u.email AS usuario_email,
            v.fecha_verificacion
       FROM itam.verificaciones_fisicas_dispositivo v
       JOIN itam.dispositivos d ON d.id = v.dispositivo_id
       JOIN itam.usuarios u ON u.id = v.usuario_id
      WHERE d.codigo_inventario = $1
      ORDER BY v.fecha_verificacion DESC, v.id DESC`,
    [codigo]
  );
  return result.rows;
};
