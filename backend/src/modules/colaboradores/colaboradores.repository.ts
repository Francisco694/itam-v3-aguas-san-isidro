import { pool } from "../../config/database";
import type { PoolClient } from "pg";
import { normalizeRut } from "../../shared/rut";
import type {
  ActualizarColaboradorInput,
  ColaboradorFilters,
  ColaboradorRow,
  CrearColaboradorInput,
  ActivoColaboradorRow,
  HistorialActivoColaboradorRow,
  EvidenciaHistoricaPendienteRow,
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
    values.push(`%${normalizeRut(filters.rut)}%`);
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
  rut: string,
  excludeId?: string,
  client?: PoolClient
): Promise<ColaboradorRow | null> => {
  const result = await getDb(client).query<ColaboradorRow>(
    `
      ${colaboradorSelect}
      WHERE UPPER(REGEXP_REPLACE(BTRIM(c.rut),'[^0-9Kk]','','g')) = $1
        AND ($2::bigint IS NULL OR c.id <> $2::bigint)
      ORDER BY c.id
      LIMIT 1
    `,
    [normalizeRut(rut),excludeId ?? null]
  );

  return result.rows[0] ?? null;
};

export const crearColaborador = async (
  input: CrearColaboradorInput,
  client?: PoolClient
): Promise<ColaboradorRow> => {
  const result = await getDb(client).query<ColaboradorRow>(
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
  input: ActualizarColaboradorInput,
  client?: PoolClient
): Promise<ColaboradorRow | null> => {
  const result = await getDb(client).query<ColaboradorRow>(
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
  colaboradorId:number,
  client?:PoolClient
):Promise<ActivoColaboradorRow[]> => (await getDb(client).query<ActivoColaboradorRow>(`
  SELECT d.id dispositivo_id,d.codigo_inventario,t.nombre tipo_dispositivo,
    d.marca,d.modelo,d.numero_serie,d.imei,d.valor_comercial,
    e.codigo estado_codigo,e.nombre estado_nombre
  FROM itam.custodias_dispositivo custodia
  JOIN itam.dispositivos d ON d.id=custodia.dispositivo_id
  JOIN itam.tipos_dispositivo t ON t.id=d.tipo_dispositivo_id
  JOIN itam.estados e ON e.id=d.estado_id
  WHERE custodia.colaborador_id=$1 AND custodia.vigente=TRUE
  ORDER BY d.codigo_inventario`,[colaboradorId])).rows;

export const listarHistorialActivosColaborador = async (
  colaboradorId:number,
  client?:PoolClient
):Promise<HistorialActivoColaboradorRow[]> => (await getDb(client).query<HistorialActivoColaboradorRow>(`
  SELECT d.id dispositivo_id,d.codigo_inventario,t.nombre tipo_dispositivo,
    d.marca,d.modelo,d.numero_serie,d.imei,d.valor_comercial,
    e.codigo estado_codigo,e.nombre estado_nombre,
    custodia.fecha_inicio fecha_asignacion,custodia.fecha_fin fecha_devolucion,
    custodia.tipo_cierre,
    CASE custodia.tipo_cierre
      WHEN 'DEVOLUCION' THEN 'DEVUELTO'
      WHEN 'CONCILIACION_HISTORICA' THEN 'CONCILIADO'
      WHEN 'REASIGNACION' THEN 'REASIGNADO'
      WHEN 'BAJA' THEN 'DADO_BAJA'
      WHEN 'EXTRAVIO' THEN 'EXTRAVIADO'
      WHEN 'OFFBOARDING' THEN 'OFFBOARDING'
      ELSE 'FINALIZADO'
    END resultado
  FROM itam.custodias_dispositivo custodia
  JOIN itam.dispositivos d ON d.id=custodia.dispositivo_id
  JOIN itam.tipos_dispositivo t ON t.id=d.tipo_dispositivo_id
  JOIN itam.estados e ON e.id=d.estado_id
  WHERE custodia.colaborador_id=$1 AND custodia.vigente=FALSE
  ORDER BY custodia.fecha_inicio DESC NULLS LAST,custodia.id DESC`,[colaboradorId])).rows;

export const listarEvidenciasPendientesColaborador = async (
  colaboradorId:number,
  client?:PoolClient
):Promise<EvidenciaHistoricaPendienteRow[]> => (await getDb(client).query<EvidenciaHistoricaPendienteRow>(`
  SELECT id,tipo_activo,descripcion_original,imei_original,serie_original,
    fecha_entrega,estado_conciliacion,motivo_conflicto,nivel_confianza,
    fuente,hoja,fila_origen
  FROM itam.evidencias_inventario_historico
  WHERE colaborador_id=$1 AND dispositivo_id IS NULL
  ORDER BY fecha_entrega DESC NULLS LAST,fila_origen DESC`,[colaboradorId])).rows;
export const listarPendientesOffboarding = async ():Promise<PendienteOffboardingRow[]> =>
  (await pool.query<PendienteOffboardingRow>(`
    SELECT c.id colaborador_id,c.rut,c.nombre,c.cargo,c.localidad,c.activo,c.observaciones,
      c.creado_en,c.actualizado_en,dep.id departamento_id,dep.nombre departamento_nombre,
      COUNT(d.id) activos_pendientes,COALESCE(SUM(d.valor_comercial),0) valor_pendiente
    FROM itam.colaboradores c
    JOIN itam.custodias_dispositivo custodia
      ON custodia.colaborador_id=c.id AND custodia.vigente=TRUE
    JOIN itam.dispositivos d ON d.id=custodia.dispositivo_id
    LEFT JOIN itam.departamentos dep ON dep.id=c.departamento_id
    GROUP BY c.id,c.rut,c.nombre,c.cargo,c.localidad,c.activo,c.observaciones,c.creado_en,
      c.actualizado_en,dep.id,dep.nombre
    ORDER BY c.nombre
  `)).rows;
