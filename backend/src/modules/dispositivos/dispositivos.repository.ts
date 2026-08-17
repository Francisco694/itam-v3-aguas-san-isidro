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
    tipo.id AS tipo_dispositivo_id,
    tipo.nombre AS tipo_dispositivo_nombre,
    tipo.descripcion AS tipo_dispositivo_descripcion,
    tipo.activo AS tipo_dispositivo_activo,
    tipo.requiere_imei AS tipo_dispositivo_requiere_imei,
    tipo.configuracion_formulario AS tipo_dispositivo_configuracion_formulario,
    tipo_familia.id AS tipo_familia_id,
    tipo_familia.nombre_familia AS tipo_familia_nombre,
    tipo_familia.prefijo AS tipo_familia_prefijo,
    tipo_familia.activo AS tipo_familia_activa,
    tipo_familia.estrategia_codigo AS tipo_familia_estrategia,
    tipo_familia.agrupa_tipos AS tipo_familia_agrupa_tipos,
    tipo_familia.etiqueta_operativa AS tipo_familia_etiqueta_operativa,
    d.marca,
    d.modelo,
    d.numero_serie,
    d.imei,
    d.localidad,
    d.ubicacion_detalle,
    d.observaciones,
    d.atributos_especificos,
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
    colaborador_dep.id AS colaborador_departamento_id,
    colaborador_dep.nombre AS colaborador_departamento_nombre,
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
  INNER JOIN itam.tipos_dispositivo tipo
    ON tipo.id = d.tipo_dispositivo_id
  LEFT JOIN itam.familias_codigo_inventario tipo_familia
    ON tipo_familia.id = tipo.familia_codigo_inventario_id
  LEFT JOIN itam.colaboradores c
    ON c.id = d.colaborador_id
  LEFT JOIN itam.departamentos colaborador_dep
    ON colaborador_dep.id = c.departamento_id
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
        OR tipo.nombre ILIKE $${values.length}
        OR d.marca ILIKE $${values.length}
        OR d.modelo ILIKE $${values.length}
        OR d.numero_serie ILIKE $${values.length}
        OR d.imei ILIKE $${values.length}
      )
    `);
  }

  if (filters.tipo !== undefined) {
    values.push(`%${filters.tipo}%`);
    where.push(`tipo.nombre ILIKE $${values.length}`);
  }

  if (filters.tipoDispositivoId !== undefined) {
    values.push(filters.tipoDispositivoId);
    where.push(`d.tipo_dispositivo_id = $${values.length}`);
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

  if (filters.familiaCodigoInventarioId !== undefined) {
    values.push(filters.familiaCodigoInventarioId);
    where.push(`tipo.familia_codigo_inventario_id = $${values.length}`);
  }

  if (filters.departamentoColaboradorId !== undefined) {
    values.push(filters.departamentoColaboradorId);
    where.push(`c.departamento_id = $${values.length}`);
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
  codigoInventario: number,
  estadoId: string,
  client: PoolClient
): Promise<DispositivoRow> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      INSERT INTO itam.dispositivos (
        codigo_inventario,
        tipo_dispositivo_id,
        marca,
        modelo,
        numero_serie,
        imei,
        estado_id,
        localidad,
        ubicacion_detalle,
        observaciones,
        atributos_especificos
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      input.tipoDispositivoId,
      input.marca ?? null,
      input.modelo ?? null,
      input.numeroSerie ?? null,
      input.imei ?? null,
      estadoId,
      input.localidad ?? null,
      input.ubicacionDetalle ?? null,
      input.observaciones ?? null,
      JSON.stringify(input.atributosEspecificos ?? {})
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
  input: ActualizarDispositivoInput,
  client?: PoolClient
): Promise<DispositivoRow | null> => {
  const executor = getDb(client);
  const result = await executor.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        tipo_dispositivo_id = COALESCE($2, tipo_dispositivo_id),
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
        END,
        atributos_especificos = CASE
          WHEN $17::boolean THEN $18::jsonb
          ELSE atributos_especificos
        END
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      input.tipoDispositivoId ?? null,
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
      input.observaciones ?? null,
      input.atributosEspecificos !== undefined,
      JSON.stringify(input.atributosEspecificos ?? {})
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
        recibido_por_id = NULL,
        estado_id = $3,
        localidad = CASE
          WHEN $4::boolean THEN $5
          ELSE localidad
        END,
        ubicacion_detalle = CASE
          WHEN $6::boolean THEN $7
          ELSE ubicacion_detalle
        END
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      departamentoId,
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
