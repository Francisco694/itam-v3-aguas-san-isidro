import { pool } from "../../config/database";
import type { PoolClient } from "pg";
import type {
  ActualizarColaboradorInput,
  ColaboradorFilters,
  ColaboradorRow,
  CrearColaboradorInput,
  ActivoColaboradorRow,
  HistorialActivoColaboradorRow,
  InventarioConciliableRow,
  PendienteOffboardingRow
} from "./colaboradores.types";

const getDb = (client?: PoolClient) => client ?? pool;

const colaboradorSelect = `
  SELECT
    c.id,
    c.rut,
    c.nombre,
    c.cargo,
    c.departamento_id,
    d.nombre AS departamento_nombre,
    c.localidad,
    c.activo,
    c.observaciones,
    c.creado_en,
    c.actualizado_en
  FROM itam.colaboradores c
  LEFT JOIN itam.departamentos d
    ON d.id = c.departamento_id
`;

export const listarColaboradores = async (
  filters: ColaboradorFilters
): Promise<ColaboradorRow[]> => {
  const values: unknown[] = [];
  const where: string[] = [];

  if (filters.nombre !== undefined) {
    values.push(`%${filters.nombre}%`);
    where.push(`c.nombre ILIKE $${values.length}`);
  }

  if (filters.rut !== undefined) {
    values.push(`%${filters.rut}%`);
    where.push(`c.rut ILIKE $${values.length}`);
  }

  if (filters.departamentoId !== undefined) {
    values.push(filters.departamentoId);
    where.push(`c.departamento_id = $${values.length}`);
  }

  if (filters.activo !== undefined) {
    values.push(filters.activo);
    where.push(`c.activo = $${values.length}`);
  }

  const result = await pool.query<ColaboradorRow>(
    `
      ${colaboradorSelect}
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY c.nombre ASC
    `,
    values
  );

  return result.rows;
};

export const obtenerColaboradorPorId = async (
  id: number,
  client?: PoolClient
): Promise<ColaboradorRow | null> => {
  const result = await getDb(client).query<ColaboradorRow>(
    `
      ${colaboradorSelect}
      WHERE c.id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
};

export const obtenerColaboradorPorRut = async (
  rut: string
): Promise<ColaboradorRow | null> => {
  const result = await pool.query<ColaboradorRow>(
    `
      ${colaboradorSelect}
      WHERE LOWER(BTRIM(c.rut)) = LOWER(BTRIM($1))
      LIMIT 1
    `,
    [rut]
  );

  return result.rows[0] ?? null;
};

export const crearColaborador = async (
  input: CrearColaboradorInput
): Promise<ColaboradorRow> => {
  const result = await pool.query<ColaboradorRow>(
    `
      WITH inserted AS (
        INSERT INTO itam.colaboradores (
          rut,
          nombre,
          cargo,
          departamento_id,
          localidad,
          activo,
          observaciones
        )
        VALUES ($1, $2, $3, $4, $5, COALESCE($6, TRUE), $7)
        RETURNING *
      )
      SELECT
        c.id,
        c.rut,
        c.nombre,
        c.cargo,
        c.departamento_id,
        d.nombre AS departamento_nombre,
        c.localidad,
        c.activo,
        c.observaciones,
        c.creado_en,
        c.actualizado_en
      FROM inserted c
      LEFT JOIN itam.departamentos d
        ON d.id = c.departamento_id
    `,
    [
      input.rut,
      input.nombre,
      input.cargo ?? null,
      input.departamentoId ?? null,
      input.localidad ?? null,
      input.activo ?? null,
      input.observaciones ?? null
    ]
  );

  return result.rows[0]!;
};

export const actualizarColaborador = async (
  id: number,
  input: ActualizarColaboradorInput
): Promise<ColaboradorRow | null> => {
  const result = await pool.query<ColaboradorRow>(
    `
      WITH updated AS (
        UPDATE itam.colaboradores
        SET
          rut = COALESCE($2, rut),
          nombre = COALESCE($3, nombre),
          cargo = CASE WHEN $4::boolean THEN $5 ELSE cargo END,
          departamento_id = CASE
            WHEN $6::boolean THEN $7
            ELSE departamento_id
          END,
          localidad = CASE
            WHEN $8::boolean THEN $9
            ELSE localidad
          END,
          activo = COALESCE($10, activo),
          observaciones = CASE
            WHEN $11::boolean THEN $12
            ELSE observaciones
          END
        WHERE id = $1
        RETURNING *
      )
      SELECT
        c.id,
        c.rut,
        c.nombre,
        c.cargo,
        c.departamento_id,
        d.nombre AS departamento_nombre,
        c.localidad,
        c.activo,
        c.observaciones,
        c.creado_en,
        c.actualizado_en
      FROM updated c
      LEFT JOIN itam.departamentos d
        ON d.id = c.departamento_id
    `,
    [
      id,
      input.rut ?? null,
      input.nombre ?? null,
      input.cargo !== undefined,
      input.cargo ?? null,
      input.departamentoId !== undefined,
      input.departamentoId ?? null,
      input.localidad !== undefined,
      input.localidad ?? null,
      input.activo ?? null,
      input.observaciones !== undefined,
      input.observaciones ?? null
    ]
  );

  return result.rows[0] ?? null;
};

export const listarActivosActualesColaborador = async (
  colaboradorId:number
):Promise<ActivoColaboradorRow[]> => (await pool.query<ActivoColaboradorRow>(`
  SELECT d.id dispositivo_id,d.codigo_inventario,t.nombre tipo_dispositivo,
    d.marca,d.modelo,d.numero_serie,d.imei,d.valor_comercial,
    e.codigo estado_codigo,e.nombre estado_nombre
  FROM itam.dispositivos d JOIN itam.tipos_dispositivo t ON t.id=d.tipo_dispositivo_id
  JOIN itam.estados e ON e.id=d.estado_id WHERE d.colaborador_id=$1
  ORDER BY d.codigo_inventario`,[colaboradorId])).rows;

export const listarHistorialActivosColaborador = async (
  colaboradorId:number,
  client?:PoolClient
):Promise<HistorialActivoColaboradorRow[]> => (await getDb(client).query<HistorialActivoColaboradorRow>(`
  WITH asignaciones AS (
    SELECT h.id evento_asignacion_id,h.dispositivo_id,h.fecha_evento fecha_asignacion
    FROM itam.historial_eventos h
    WHERE h.tipo_entidad='DISPOSITIVO'
      AND h.tipo_evento IN ('ASIGNAR_COLABORADOR','IMPORTAR_CUSTODIA_HISTORICA')
      AND COALESCE(h.detalle#>>'{custodiaNueva,id}',h.detalle->>'collaboratorId',
        h.detalle->>'colaboradorId')=$1::text
  )
  SELECT d.id dispositivo_id,d.codigo_inventario,t.nombre tipo_dispositivo,
    d.marca,d.modelo,d.numero_serie,d.imei,d.valor_comercial,
    e.codigo estado_codigo,e.nombre estado_nombre,a.fecha_asignacion,
    siguiente.fecha_evento fecha_devolucion,
    siguiente.tipo_evento tipo_cierre,
    CASE WHEN siguiente.fecha_evento IS NULL AND d.colaborador_id=$1::bigint THEN 'ASIGNADO'
         WHEN siguiente.tipo_evento='DEVOLVER_DISPOSITIVO' THEN 'DEVUELTO'
         WHEN siguiente.tipo_evento='CIERRE_CUSTODIA_CONCILIACION' THEN 'CONCILIADO'
         WHEN siguiente.tipo_evento IN ('DAR_BAJA','DAR_BAJA_DESDE_SERVICIO') THEN 'DADO_BAJA'
         WHEN siguiente.tipo_evento IN ('ASIGNAR_COLABORADOR','ASIGNAR_DEPARTAMENTO',
           'IMPORTAR_CUSTODIA_HISTORICA') THEN 'REASIGNADO'
         ELSE 'FINALIZADO' END resultado
  FROM asignaciones a JOIN itam.dispositivos d ON d.id=a.dispositivo_id
  JOIN itam.tipos_dispositivo t ON t.id=d.tipo_dispositivo_id
  JOIN itam.estados e ON e.id=d.estado_id
  LEFT JOIN LATERAL (
    SELECT h2.fecha_evento,h2.tipo_evento FROM itam.historial_eventos h2
    WHERE h2.dispositivo_id=a.dispositivo_id
      AND (h2.fecha_evento,h2.id)>(a.fecha_asignacion,a.evento_asignacion_id)
      AND h2.tipo_evento IN ('DEVOLVER_DISPOSITIVO','ASIGNAR_COLABORADOR',
        'ASIGNAR_DEPARTAMENTO','IMPORTAR_CUSTODIA_HISTORICA',
        'CIERRE_CUSTODIA_CONCILIACION','DAR_BAJA',
        'DAR_BAJA_DESDE_SERVICIO')
    ORDER BY h2.fecha_evento,h2.id LIMIT 1
  ) siguiente ON TRUE ORDER BY a.fecha_asignacion DESC`,[colaboradorId])).rows;

export const listarInventarioConciliableColaborador = async (
  colaboradorId: number,
  client?: PoolClient
): Promise<InventarioConciliableRow[]> =>
  (
    await getDb(client).query<InventarioConciliableRow>(
      `
        WITH asignaciones_objetivo AS (
          SELECT h.id, h.dispositivo_id, h.fecha_evento
          FROM itam.historial_eventos h
          WHERE h.tipo_entidad = 'DISPOSITIVO'
            AND h.tipo_evento IN ('ASIGNAR_COLABORADOR', 'IMPORTAR_CUSTODIA_HISTORICA')
            AND COALESCE(
              h.detalle #>> '{custodiaNueva,id}',
              h.detalle ->> 'collaboratorId',
              h.detalle ->> 'colaboradorId'
            ) = $1::text
        ),
        candidatos AS (
          SELECT dispositivo_id FROM asignaciones_objetivo
          UNION
          SELECT id FROM itam.dispositivos WHERE colaborador_id = $1::bigint
        ),
        ultima_asignacion AS (
          SELECT DISTINCT ON (c.dispositivo_id)
            c.dispositivo_id,
            a.id AS evento_asignacion_id,
            a.fecha_evento
          FROM candidatos c
          LEFT JOIN asignaciones_objetivo a ON a.dispositivo_id = c.dispositivo_id
          ORDER BY c.dispositivo_id, a.fecha_evento DESC NULLS LAST, a.id DESC
        )
        SELECT
          d.id AS dispositivo_id,
          d.codigo_inventario,
          t.nombre AS tipo_dispositivo,
          d.marca,
          d.modelo,
          d.numero_serie,
          d.imei,
          d.valor_comercial,
          e.codigo AS estado_codigo,
          e.nombre AS estado_nombre,
          COALESCE(a.fecha_evento, d.fecha_registro::timestamptz) AS fecha_asignacion,
          a.evento_asignacion_id,
          (d.colaborador_id = $1::bigint) AS vinculo_actual,
          d.colaborador_id AS colaborador_actual_id,
          cierre.tipo_evento AS tipo_cierre,
          (
            cierre.tipo_evento = 'DEVOLVER_DISPOSITIVO'
            OR EXISTS (
              SELECT 1
              FROM itam.comprobantes_devolucion comprobante
              WHERE comprobante.dispositivo_id = d.id
                AND comprobante.colaborador_id = $1::bigint
                AND (a.fecha_evento IS NULL OR comprobante.fecha >= a.fecha_evento)
            )
          ) AS tiene_devolucion,
          (
            cierre.tipo_evento IN ('DAR_BAJA', 'DAR_BAJA_DESDE_SERVICIO')
            OR EXISTS (
              SELECT 1
              FROM itam.bajas_dispositivo baja
              WHERE baja.dispositivo_id = d.id
                AND COALESCE(baja.anulada, FALSE) = FALSE
                AND (a.fecha_evento IS NULL OR baja.fecha >= a.fecha_evento)
            )
          ) AS tiene_baja,
          EXISTS (
            SELECT 1
            FROM itam.dispositivos otro
            WHERE otro.id <> d.id
              AND otro.colaborador_id IS NOT NULL
              AND otro.colaborador_id IS DISTINCT FROM d.colaborador_id
              AND (
                (BTRIM(COALESCE(d.imei, '')) NOT IN ('', '0') AND BTRIM(otro.imei) = BTRIM(d.imei))
                OR (
                  BTRIM(COALESCE(d.numero_serie, '')) <> ''
                  AND LOWER(BTRIM(otro.numero_serie)) = LOWER(BTRIM(d.numero_serie))
                )
              )
          ) AS identidad_duplicada
        FROM ultima_asignacion a
        JOIN itam.dispositivos d ON d.id = a.dispositivo_id
        JOIN itam.tipos_dispositivo t ON t.id = d.tipo_dispositivo_id
        JOIN itam.estados e ON e.id = d.estado_id
        LEFT JOIN LATERAL (
          SELECT h2.tipo_evento
          FROM itam.historial_eventos h2
          WHERE a.evento_asignacion_id IS NOT NULL
            AND h2.dispositivo_id = d.id
            AND (h2.fecha_evento, h2.id) > (a.fecha_evento, a.evento_asignacion_id)
            AND h2.tipo_evento IN (
              'DEVOLVER_DISPOSITIVO', 'ASIGNAR_COLABORADOR',
              'ASIGNAR_DEPARTAMENTO', 'IMPORTAR_CUSTODIA_HISTORICA',
              'CIERRE_CUSTODIA_CONCILIACION', 'DAR_BAJA',
              'DAR_BAJA_DESDE_SERVICIO'
            )
          ORDER BY h2.fecha_evento, h2.id
          LIMIT 1
        ) cierre ON TRUE
        ORDER BY fecha_asignacion DESC, a.evento_asignacion_id DESC NULLS LAST
      `,
      [colaboradorId]
    )
  ).rows;

export const listarPendientesOffboarding = async ():Promise<PendienteOffboardingRow[]> =>
  (await pool.query<PendienteOffboardingRow>(`
    SELECT c.id colaborador_id,c.rut,c.nombre,c.cargo,c.localidad,c.activo,c.observaciones,
      c.creado_en,c.actualizado_en,dep.id departamento_id,dep.nombre departamento_nombre,
      COUNT(d.id) activos_pendientes,COALESCE(SUM(d.valor_comercial),0) valor_pendiente
    FROM itam.colaboradores c
    JOIN itam.dispositivos d ON d.colaborador_id=c.id
    LEFT JOIN itam.departamentos dep ON dep.id=c.departamento_id
    GROUP BY c.id,c.rut,c.nombre,c.cargo,c.localidad,c.activo,c.observaciones,c.creado_en,
      c.actualizado_en,dep.id,dep.nombre
    ORDER BY c.nombre
  `)).rows;
