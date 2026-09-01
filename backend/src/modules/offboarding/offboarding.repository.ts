import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/database";
import type {
  OffboardingAssetRow,
  OffboardingProcessRow,
  OffboardingSearchRow
} from "./offboarding.types";

type DbExecutor = Pool | PoolClient;

const db = (client?: PoolClient): DbExecutor => client ?? pool;

const pendingAssetCondition = `
  EXISTS (
    SELECT 1 FROM itam.custodias_dispositivo custodia_actual
    WHERE custodia_actual.dispositivo_id = d.id
      AND custodia_actual.colaborador_id = p.colaborador_id
      AND custodia_actual.vigente = TRUE
  )
  AND NOT COALESCE((
    SELECT
      CASE
        WHEN h.detalle->>'resultado' IN (
          'DEVUELTO', 'DANADO', 'EXTRAVIADO', 'ROBADO_HURTADO'
        ) THEN NOT EXISTS (
          SELECT 1
          FROM itam.historial_eventos nueva_asignacion
          WHERE nueva_asignacion.dispositivo_id = d.id
            AND nueva_asignacion.tipo_evento = 'ASIGNAR_COLABORADOR'
            AND nueva_asignacion.fecha_evento > h.fecha_evento
            AND COALESCE(
              nueva_asignacion.detalle#>>'{custodiaNueva,id}',
              nueva_asignacion.detalle->>'colaboradorId'
            ) = p.colaborador_id::TEXT
        )
        ELSE FALSE
      END
    FROM itam.historial_eventos h
    WHERE h.dispositivo_id = d.id
      AND h.tipo_evento = 'RESULTADO_OFFBOARDING'
      AND h.fecha_evento >= p.fecha_inicio
    ORDER BY h.fecha_evento DESC, h.id DESC
    LIMIT 1
  ), FALSE)
`;

const processSelect = `
  SELECT
    p.id,
    p.colaborador_id,
    c.rut,
    c.nombre,
    c.cargo,
    c.departamento_id,
    dep.nombre AS departamento_nombre,
    c.localidad,
    c.activo AS colaborador_activo,
    c.observaciones AS colaborador_observaciones,
    c.creado_en AS colaborador_creado_en,
    c.actualizado_en AS colaborador_actualizado_en,
    p.fecha_inicio,
    p.estado,
    p.usuario_inicio_id,
    usuario_inicio.nombre AS usuario_inicio_nombre,
    usuario_inicio.email AS usuario_inicio_email,
    p.observaciones,
    p.fecha_cierre,
    p.usuario_cierre_id,
    usuario_cierre.nombre AS usuario_cierre_nombre,
    usuario_cierre.email AS usuario_cierre_email,
    p.creado_en,
    p.actualizado_en,
    COALESCE(pendientes.equipos_pendientes, 0) AS equipos_pendientes,
    COALESCE(pendientes.valor_pendiente, 0) AS valor_pendiente,
    COALESCE(recuperados.valor_recuperado, 0) AS valor_recuperado
  FROM itam.procesos_offboarding p
  INNER JOIN itam.colaboradores c ON c.id = p.colaborador_id
  LEFT JOIN itam.departamentos dep ON dep.id = c.departamento_id
  INNER JOIN itam.usuarios usuario_inicio ON usuario_inicio.id = p.usuario_inicio_id
  LEFT JOIN itam.usuarios usuario_cierre ON usuario_cierre.id = p.usuario_cierre_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS equipos_pendientes,
      COALESCE(SUM(d.valor_comercial), 0) AS valor_pendiente
    FROM itam.dispositivos d
    WHERE ${pendingAssetCondition}
  ) pendientes ON TRUE
  LEFT JOIN LATERAL (
    SELECT COALESCE(SUM(d.valor_comercial), 0) AS valor_recuperado
    FROM itam.dispositivos d
    WHERE EXISTS (
      SELECT 1
      FROM itam.historial_eventos h
      WHERE h.dispositivo_id = d.id
        AND h.fecha_evento >= p.fecha_inicio
        AND h.detalle#>>'{custodiaAnterior,id}' = p.colaborador_id::TEXT
        AND (
          (
            h.tipo_evento = 'DEVOLVER_DISPOSITIVO'
            AND h.detalle->>'resultado' IN ('DEVUELTO', 'DANADO')
          )
          OR
          (
            h.tipo_evento = 'RESULTADO_OFFBOARDING'
            AND h.detalle->>'resultado' IN (
              'EXTRAVIADO', 'ROBADO_HURTADO'
            )
          )
        )
    )
  ) recuperados ON TRUE
`;

export const listOpenProcesses = async (
  client?: PoolClient
): Promise<OffboardingProcessRow[]> =>
  (
    await db(client).query<OffboardingProcessRow>(
      `${processSelect}
       WHERE p.estado = 'ABIERTO'
       ORDER BY p.fecha_inicio DESC, p.id DESC`
    )
  ).rows;

export const getProcessById = async (
  id: number,
  client?: PoolClient,
  lock = false
): Promise<OffboardingProcessRow | null> => {
  const result = await db(client).query<OffboardingProcessRow>(
    `${processSelect}
     WHERE p.id = $1
     ${lock ? "FOR UPDATE OF p" : ""}
     LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const getOpenProcessByCollaborator = async (
  collaboratorId: number,
  client?: PoolClient
): Promise<OffboardingProcessRow | null> => {
  const result = await db(client).query<OffboardingProcessRow>(
    `${processSelect}
     WHERE p.colaborador_id = $1 AND p.estado = 'ABIERTO'
     LIMIT 1`,
    [collaboratorId]
  );
  return result.rows[0] ?? null;
};

export const listPendingAssets = async (
  processId: number,
  client?: PoolClient
): Promise<OffboardingAssetRow[]> =>
  (
    await db(client).query<OffboardingAssetRow>(
      `SELECT
         d.id,
         d.codigo_inventario,
         tipo.id AS tipo_id,
         tipo.nombre AS tipo_nombre,
         d.marca,
         d.modelo,
         d.numero_serie,
         d.imei,
         d.valor_comercial,
         estado.id AS estado_id,
         estado.codigo AS estado_codigo,
         estado.nombre AS estado_nombre
       FROM itam.procesos_offboarding p
       INNER JOIN itam.dispositivos d ON ${pendingAssetCondition}
       INNER JOIN itam.tipos_dispositivo tipo ON tipo.id = d.tipo_dispositivo_id
       INNER JOIN itam.estados estado ON estado.id = d.estado_id
       WHERE p.id = $1
       ORDER BY d.codigo_inventario`,
      [processId]
    )
  ).rows;

export const searchCollaborators = async (
  query: string,
  client?: PoolClient
): Promise<OffboardingSearchRow[]> =>
  (
    await db(client).query<OffboardingSearchRow>(
      `SELECT
         c.id AS colaborador_id,
         c.rut,
         c.nombre,
         c.cargo,
         c.departamento_id,
         dep.nombre AS departamento_nombre,
         c.localidad,
         c.activo AS colaborador_activo,
         c.observaciones AS colaborador_observaciones,
         c.creado_en AS colaborador_creado_en,
         c.actualizado_en AS colaborador_actualizado_en,
         COUNT(d.id) AS equipos_asignados,
         COALESCE(SUM(d.valor_comercial), 0) AS valor_asignado,
         abierto.id AS proceso_abierto_id
       FROM itam.colaboradores c
       LEFT JOIN itam.departamentos dep ON dep.id = c.departamento_id
       LEFT JOIN itam.custodias_dispositivo custodia
         ON custodia.colaborador_id = c.id
        AND custodia.vigente = TRUE
       LEFT JOIN itam.dispositivos d ON d.id = custodia.dispositivo_id
       LEFT JOIN itam.procesos_offboarding abierto
         ON abierto.colaborador_id = c.id
        AND abierto.estado = 'ABIERTO'
       WHERE c.nombre ILIKE $1 OR c.rut ILIKE $1
       GROUP BY c.id, dep.id, abierto.id
       ORDER BY
         CASE WHEN LOWER(BTRIM(c.rut)) = LOWER(BTRIM($2)) THEN 0 ELSE 1 END,
         c.nombre
       LIMIT 30`,
      [`%${query}%`, query]
    )
  ).rows;

export const lockCollaborator = async (
  collaboratorId: number,
  client: PoolClient
): Promise<boolean> => {
  const result = await client.query(
    "SELECT id FROM itam.colaboradores WHERE id = $1 FOR UPDATE",
    [collaboratorId]
  );
  return Boolean(result.rows[0]);
};

export const insertProcess = async (
  collaboratorId: number,
  userId: string,
  observations: string | null | undefined,
  client: PoolClient
): Promise<number> => {
  const result = await client.query<{ id: string }>(
    `INSERT INTO itam.procesos_offboarding(
       colaborador_id, usuario_inicio_id, observaciones
     ) VALUES ($1, $2, $3)
     RETURNING id`,
    [collaboratorId, userId, observations ?? null]
  );
  return Number(result.rows[0]!.id);
};

export const completeProcess = async (
  processId: number,
  userId: string,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `UPDATE itam.procesos_offboarding
        SET estado = 'COMPLETADO',
            fecha_cierre = NOW(),
            usuario_cierre_id = $2
      WHERE id = $1 AND estado = 'ABIERTO'`,
    [processId, userId]
  );
};
