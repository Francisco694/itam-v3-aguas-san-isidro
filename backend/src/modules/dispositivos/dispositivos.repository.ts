import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/database";
import type {
  ActualizarDispositivoInput,
  CrearDispositivoInput,
  DispositivoFilters,
  DispositivoRow,
  EstadoRow,
  HistorialDispositivoRow
} from "./dispositivos.types";

type DbExecutor = Pool | PoolClient;

const getDb = (client?: PoolClient): DbExecutor => client ?? pool;

const dispositivoSelect = `
  SELECT
    d.id AS dispositivo_id,
    d.codigo_inventario AS dispositivo_codigo_inventario,
    d.tipo_dispositivo,
    d.marca,
    d.modelo,
    d.numero_serie,
    d.imei,
    d.localidad,
    d.ubicacion_detalle,
    d.observaciones,
    d.fecha_registro,
    d.creado_en,
    d.actualizado_en,
    e.id AS estado_id,
    e.codigo AS estado_codigo,
    e.nombre AS estado_nombre,
    c.id AS colaborador_id,
    c.rut AS colaborador_rut,
    c.nombre AS colaborador_nombre,
    c.cargo AS colaborador_cargo,
    c.localidad AS colaborador_localidad,
    dep.id AS departamento_id,
    dep.nombre AS departamento_nombre,
    recibido.id AS recibido_por_id,
    recibido.rut AS recibido_por_rut,
    recibido.nombre AS recibido_por_nombre,
    recibido.cargo AS recibido_por_cargo,
    recibido.localidad AS recibido_por_localidad,
    s.id AS sim_id,
    s.codigo_inventario AS sim_codigo_inventario,
    s.iccid_codigo_fabrica,
    s.numero_asociado,
    s.compania,
    sim_estado.id AS sim_estado_id,
    sim_estado.codigo AS sim_estado_codigo,
    sim_estado.nombre AS sim_estado_nombre
  FROM itam.dispositivos d
  INNER JOIN itam.estados e
    ON e.id = d.estado_id
  LEFT JOIN itam.colaboradores c
    ON c.id = d.colaborador_id
  LEFT JOIN itam.departamentos dep
    ON dep.id = d.departamento_id
  LEFT JOIN itam.colaboradores recibido
    ON recibido.id = d.recibido_por_id
  LEFT JOIN itam.sim s
    ON s.dispositivo_id = d.id
  LEFT JOIN itam.estados sim_estado
    ON sim_estado.id = s.estado_id
`;

export const listarDispositivos = async (
  filters: DispositivoFilters
): Promise<DispositivoRow[]> => {
  const values: unknown[] = [];
  const where: string[] = [];

  if (filters.q !== undefined) {
    values.push(`%${filters.q}%`);
    where.push(`
      (
        d.codigo_inventario::TEXT ILIKE $${values.length}
        OR d.tipo_dispositivo ILIKE $${values.length}
        OR d.marca ILIKE $${values.length}
        OR d.modelo ILIKE $${values.length}
        OR d.numero_serie ILIKE $${values.length}
        OR d.imei ILIKE $${values.length}
      )
    `);
  }

  if (filters.tipo !== undefined) {
    values.push(`%${filters.tipo}%`);
    where.push(`d.tipo_dispositivo ILIKE $${values.length}`);
  }

  if (filters.estado !== undefined) {
    values.push(filters.estado);
    where.push(`e.codigo = $${values.length}`);
  }

  if (filters.colaboradorId !== undefined) {
    values.push(filters.colaboradorId);
    where.push(`d.colaborador_id = $${values.length}`);
  }

  if (filters.departamentoId !== undefined) {
    values.push(filters.departamentoId);
    where.push(`d.departamento_id = $${values.length}`);
  }

  if (filters.localidad !== undefined) {
    values.push(`%${filters.localidad}%`);
    where.push(`d.localidad ILIKE $${values.length}`);
  }

  const result = await pool.query<DispositivoRow>(
    `
      ${dispositivoSelect}
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY d.codigo_inventario ASC
    `,
    values
  );

  return result.rows;
};

export const obtenerDispositivoPorCodigo = async (
  codigoInventario: number,
  client?: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await getDb(client).query<DispositivoRow>(
    `
      ${dispositivoSelect}
      WHERE d.codigo_inventario = $1
      LIMIT 1
    `,
    [codigoInventario]
  );

  return result.rows[0] ?? null;
};

export const obtenerEstadoDispositivoPorCodigo = async (
  codigo: string,
  client?: PoolClient
): Promise<EstadoRow | null> => {
  const result = await getDb(client).query<EstadoRow>(
    `
      SELECT id, codigo, nombre
      FROM itam.estados
      WHERE tipo_entidad = 'DISPOSITIVO'
        AND codigo = $1
        AND activo = TRUE
      LIMIT 1
    `,
    [codigo]
  );

  return result.rows[0] ?? null;
};

export const obtenerEstadoDispositivoPorId = async (
  estadoId: number,
  client?: PoolClient
): Promise<EstadoRow | null> => {
  const result = await getDb(client).query<EstadoRow>(
    `
      SELECT id, codigo, nombre
      FROM itam.estados
      WHERE tipo_entidad = 'DISPOSITIVO'
        AND id = $1
        AND activo = TRUE
      LIMIT 1
    `,
    [estadoId]
  );

  return result.rows[0] ?? null;
};

export const crearDispositivo = async (
  input: CrearDispositivoInput,
  estadoId: string,
  client: PoolClient
): Promise<DispositivoRow> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      INSERT INTO itam.dispositivos (
        codigo_inventario,
        tipo_dispositivo,
        marca,
        modelo,
        numero_serie,
        imei,
        estado_id,
        localidad,
        ubicacion_detalle,
        observaciones
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING codigo_inventario
    `,
    [
      input.codigoInventario,
      input.tipoDispositivo,
      input.marca ?? null,
      input.modelo ?? null,
      input.numeroSerie ?? null,
      input.imei ?? null,
      estadoId,
      input.localidad ?? null,
      input.ubicacionDetalle ?? null,
      input.observaciones ?? null
    ]
  );

  const dispositivo = await obtenerDispositivoPorCodigo(
    result.rows[0]!.codigo_inventario,
    client
  );

  return dispositivo!;
};

export const actualizarDispositivo = async (
  codigoInventario: number,
  input: ActualizarDispositivoInput
): Promise<DispositivoRow | null> => {
  const result = await pool.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        tipo_dispositivo = COALESCE($2, tipo_dispositivo),
        marca = CASE WHEN $3::boolean THEN $4 ELSE marca END,
        modelo = CASE WHEN $5::boolean THEN $6 ELSE modelo END,
        numero_serie = CASE
          WHEN $7::boolean THEN $8
          ELSE numero_serie
        END,
        imei = CASE WHEN $9::boolean THEN $10 ELSE imei END,
        localidad = CASE
          WHEN $11::boolean THEN $12
          ELSE localidad
        END,
        ubicacion_detalle = CASE
          WHEN $13::boolean THEN $14
          ELSE ubicacion_detalle
        END,
        observaciones = CASE
          WHEN $15::boolean THEN $16
          ELSE observaciones
        END
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      input.tipoDispositivo ?? null,
      input.marca !== undefined,
      input.marca ?? null,
      input.modelo !== undefined,
      input.modelo ?? null,
      input.numeroSerie !== undefined,
      input.numeroSerie ?? null,
      input.imei !== undefined,
      input.imei ?? null,
      input.localidad !== undefined,
      input.localidad ?? null,
      input.ubicacionDetalle !== undefined,
      input.ubicacionDetalle ?? null,
      input.observaciones !== undefined,
      input.observaciones ?? null
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario
  );
};

export const asignarDispositivoAColaborador = async (
  codigoInventario: number,
  colaboradorId: number,
  estadoId: string,
  client: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        colaborador_id = $2,
        departamento_id = NULL,
        recibido_por_id = NULL,
        estado_id = $3
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario, colaboradorId, estadoId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const asignarDispositivoADepartamento = async (
  codigoInventario: number,
  departamentoId: number,
  recibidoPorId: number,
  estadoId: string,
  localidad: string | null | undefined,
  ubicacionDetalle: string | null | undefined,
  client: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        colaborador_id = NULL,
        departamento_id = $2,
        recibido_por_id = $3,
        estado_id = $4,
        localidad = CASE
          WHEN $5::boolean THEN $6
          ELSE localidad
        END,
        ubicacion_detalle = CASE
          WHEN $7::boolean THEN $8
          ELSE ubicacion_detalle
        END
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      departamentoId,
      recibidoPorId,
      estadoId,
      localidad !== undefined,
      localidad ?? null,
      ubicacionDetalle !== undefined,
      ubicacionDetalle ?? null
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const devolverDispositivo = async (
  codigoInventario: number,
  estadoId: string,
  client: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        colaborador_id = NULL,
        departamento_id = NULL,
        recibido_por_id = NULL,
        estado_id = $2
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario, estadoId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const cambiarEstadoDispositivo = async (
  codigoInventario: number,
  estadoId: number,
  client: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET estado_id = $2
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario, estadoId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const insertarHistorialDispositivo = async (
  dispositivoId: string,
  tipoEvento: string,
  estadoAnteriorId: string | null,
  estadoNuevoId: string | null,
  responsable: string,
  observaciones: string | null | undefined,
  detalle: Record<string, unknown>,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `
      INSERT INTO itam.historial_eventos (
        tipo_entidad,
        dispositivo_id,
        tipo_evento,
        estado_anterior_id,
        estado_nuevo_id,
        responsable,
        observaciones,
        detalle
      )
      VALUES (
        'DISPOSITIVO',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb
      )
    `,
    [
      dispositivoId,
      tipoEvento,
      estadoAnteriorId,
      estadoNuevoId,
      responsable,
      observaciones ?? null,
      JSON.stringify(detalle)
    ]
  );
};

export const listarHistorialDispositivo = async (
  codigoInventario: number
): Promise<HistorialDispositivoRow[]> => {
  const result = await pool.query<HistorialDispositivoRow>(
    `
      SELECT
        h.id,
        h.tipo_entidad,
        h.dispositivo_id,
        h.tipo_evento,
        h.estado_anterior_id,
        anterior.codigo AS estado_anterior_codigo,
        anterior.nombre AS estado_anterior_nombre,
        h.estado_nuevo_id,
        nuevo.codigo AS estado_nuevo_codigo,
        nuevo.nombre AS estado_nuevo_nombre,
        h.responsable,
        h.observaciones,
        h.detalle,
        h.fecha_evento
      FROM itam.historial_eventos h
      INNER JOIN itam.dispositivos d
        ON d.id = h.dispositivo_id
      LEFT JOIN itam.estados anterior
        ON anterior.id = h.estado_anterior_id
      LEFT JOIN itam.estados nuevo
        ON nuevo.id = h.estado_nuevo_id
      WHERE d.codigo_inventario = $1
        AND h.tipo_entidad = 'DISPOSITIVO'
      ORDER BY h.fecha_evento DESC
    `,
    [codigoInventario]
  );

  return result.rows;
};
