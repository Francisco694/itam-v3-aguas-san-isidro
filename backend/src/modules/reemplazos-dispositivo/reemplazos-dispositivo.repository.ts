import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/database";
import type { ReemplazoDispositivoRow } from "./reemplazos-dispositivo.types";

type DbExecutor = Pool | PoolClient;

export const replacementSelect = `
  SELECT
    r.id,
    r.colaborador_id,
    colaborador.nombre AS colaborador_nombre,
    colaborador.rut AS colaborador_rut,
    anterior.id AS dispositivo_anterior_id,
    anterior.codigo_inventario AS dispositivo_anterior_codigo,
    anterior.tipo_dispositivo AS dispositivo_anterior_tipo,
    anterior.marca AS dispositivo_anterior_marca,
    anterior.modelo AS dispositivo_anterior_modelo,
    anterior_estado.codigo AS dispositivo_anterior_estado_codigo,
    anterior_estado.nombre AS dispositivo_anterior_estado_nombre,
    nuevo.id AS dispositivo_nuevo_id,
    nuevo.codigo_inventario AS dispositivo_nuevo_codigo,
    nuevo.tipo_dispositivo AS dispositivo_nuevo_tipo,
    nuevo.marca AS dispositivo_nuevo_marca,
    nuevo.modelo AS dispositivo_nuevo_modelo,
    nuevo_estado.codigo AS dispositivo_nuevo_estado_codigo,
    nuevo_estado.nombre AS dispositivo_nuevo_estado_nombre,
    r.estado_operacion,
    r.fecha_inicio,
    r.fecha_recepcion_anterior,
    r.fecha_cierre,
    r.usuario_inicio_id,
    usuario_inicio.nombre AS usuario_inicio_nombre,
    r.usuario_cierre_id,
    usuario_cierre.nombre AS usuario_cierre_nombre,
    r.comprobante_devolucion_id,
    r.destino_dispositivo_anterior,
    r.observacion,
    r.motivo_cancelacion,
    r.created_at,
    r.updated_at
  FROM itam.reemplazos_dispositivo r
  INNER JOIN itam.colaboradores colaborador ON colaborador.id = r.colaborador_id
  INNER JOIN itam.dispositivos anterior ON anterior.id = r.dispositivo_anterior_id
  INNER JOIN itam.estados anterior_estado ON anterior_estado.id = anterior.estado_id
  INNER JOIN itam.dispositivos nuevo ON nuevo.id = r.dispositivo_nuevo_id
  INNER JOIN itam.estados nuevo_estado ON nuevo_estado.id = nuevo.estado_id
  INNER JOIN itam.usuarios usuario_inicio ON usuario_inicio.id = r.usuario_inicio_id
  LEFT JOIN itam.usuarios usuario_cierre ON usuario_cierre.id = r.usuario_cierre_id
`;

export const insertarReemplazoPendiente = async (
  input: {
    colaboradorId: number;
    dispositivoAnteriorId: string;
    dispositivoNuevoId: string;
    observacion: string | null;
    usuarioInicioId: string;
  },
  client: PoolClient
): Promise<string> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO itam.reemplazos_dispositivo(
       colaborador_id, dispositivo_anterior_id, dispositivo_nuevo_id,
       estado_operacion, observacion, usuario_inicio_id
     ) VALUES ($1, $2, $3, 'PENDIENTE_DEVOLUCION', $4, $5)
     RETURNING id`,
    [
      input.colaboradorId,
      input.dispositivoAnteriorId,
      input.dispositivoNuevoId,
      input.observacion,
      input.usuarioInicioId
    ]
  );
  return result.rows[0]!.id;
};

export const completarReemplazo = async (
  id: string,
  input: {
    comprobanteDevolucionId: string;
    destinoDispositivoAnterior: string;
    usuarioCierreId: string;
  },
  client: PoolClient
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE itam.reemplazos_dispositivo
     SET estado_operacion = 'COMPLETADO',
         fecha_recepcion_anterior = NOW(),
         fecha_cierre = NOW(),
         usuario_cierre_id = $2,
         comprobante_devolucion_id = $3,
         destino_dispositivo_anterior = $4
     WHERE id = $1 AND estado_operacion = 'PENDIENTE_DEVOLUCION'`,
    [id, input.usuarioCierreId, input.comprobanteDevolucionId, input.destinoDispositivoAnterior]
  );
  return (result.rowCount ?? 0) > 0;
};

export const obtenerReemplazoPendientePorId = async (
  id: string,
  client: PoolClient
): Promise<ReemplazoDispositivoRow | null> => {
  const result = await client.query<ReemplazoDispositivoRow>(
    `${replacementSelect} WHERE r.id = $1 AND r.estado_operacion = 'PENDIENTE_DEVOLUCION' FOR UPDATE OF r`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const obtenerReemplazoPendientePorDispositivoCodigo = async (
  codigo: number
): Promise<{ id: string } | null> => {
  const result = await pool.query<{ id: string }>(
    `SELECT r.id
     FROM itam.reemplazos_dispositivo r
     INNER JOIN itam.dispositivos d ON d.id = r.dispositivo_anterior_id
     WHERE r.estado_operacion = 'PENDIENTE_DEVOLUCION'
       AND d.codigo_inventario = $1
     LIMIT 1`,
    [codigo]
  );
  return result.rows[0] ?? null;
};

export const listarReemplazosPendientes = async (): Promise<ReemplazoDispositivoRow[]> => {
  const result = await pool.query<ReemplazoDispositivoRow>(
    `${replacementSelect} WHERE r.estado_operacion = 'PENDIENTE_DEVOLUCION' ORDER BY r.fecha_inicio ASC, r.id ASC`
  );
  return result.rows;
};

export const listarReemplazosDeColaborador = async (
  colaboradorId: number
): Promise<ReemplazoDispositivoRow[]> => {
  const result = await pool.query<ReemplazoDispositivoRow>(
    `${replacementSelect} WHERE r.colaborador_id = $1 ORDER BY r.fecha_inicio DESC, r.id DESC`,
    [colaboradorId]
  );
  return result.rows;
};
