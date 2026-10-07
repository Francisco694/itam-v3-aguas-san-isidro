import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/database";
import type {
  ActualizarSimInput,
  CrearSimInput,
  EstadoSimRow,
  HistorialSimRow,
  SimRow
} from "./sim.types";

type DbExecutor = Pool | PoolClient;

const getDb = (client?: PoolClient): DbExecutor => client ?? pool;

const simSelect = `
  SELECT
    s.id AS sim_id,
    linea.id AS linea_movil_id,
    linea.numero_telefonico AS linea_numero_telefonico,
    linea.estado AS linea_estado,
    s.codigo_inventario AS sim_codigo_inventario,
    s.iccid_codigo_fabrica,
    s.numero_asociado,
    s.compania,
    s.observaciones,
    s.fecha_registro,
    s.creado_en,
    s.actualizado_en,
    e.id AS estado_id,
    e.codigo AS estado_codigo,
    e.nombre AS estado_nombre,
    c.id AS colaborador_id,
    c.rut AS colaborador_rut,
    c.nombre AS colaborador_nombre,
    c.cargo AS colaborador_cargo,
    d.id AS dispositivo_id,
    d.codigo_inventario AS dispositivo_codigo_inventario,
    dispositivo_tipo.nombre AS tipo_dispositivo,
    d.marca AS dispositivo_marca,
    d.modelo AS dispositivo_modelo,
    de.id AS dispositivo_estado_id,
    de.codigo AS dispositivo_estado_codigo,
    de.nombre AS dispositivo_estado_nombre
  FROM itam.sim s
  INNER JOIN itam.estados e
    ON e.id = s.estado_id
  LEFT JOIN itam.colaboradores c
    ON c.id = s.colaborador_id
  LEFT JOIN itam.dispositivos d
    ON d.id = s.dispositivo_id
  LEFT JOIN itam.tipos_dispositivo dispositivo_tipo
    ON dispositivo_tipo.id = d.tipo_dispositivo_id
  LEFT JOIN itam.estados de
    ON de.id = d.estado_id
  LEFT JOIN itam.lineas_moviles linea
    ON linea.id = s.linea_movil_id
`;

export const listarSim = async (): Promise<SimRow[]> => {
  const result = await pool.query<SimRow>(
    `
      ${simSelect}
      ORDER BY s.codigo_inventario ASC
    `
  );

  return result.rows;
};

export const listarSimPorColaborador = async (colaboradorId: number): Promise<SimRow[]> => {
  const result = await pool.query<SimRow>(
    `
      ${simSelect}
      WHERE s.colaborador_id = $1
      ORDER BY s.codigo_inventario ASC
    `,
    [colaboradorId]
  );
  return result.rows;
};

export const obtenerSimPorCodigo = async (
  codigoInventario: number,
  client?: PoolClient,
  forUpdate = false
): Promise<SimRow | null> => {
  const result = await getDb(client).query<SimRow>(
    `
      ${simSelect}
      WHERE s.codigo_inventario = $1
      LIMIT 1
      ${forUpdate ? "FOR UPDATE OF s" : ""}
    `,
    [codigoInventario]
  );

  return result.rows[0] ?? null;
};

export const obtenerSimPorId = async (
  simId: string,
  client?: PoolClient,
  forUpdate = false
): Promise<SimRow | null> => {
  const result = await getDb(client).query<SimRow>(
    `
      ${simSelect}
      WHERE s.id = $1
      LIMIT 1
      ${forUpdate ? "FOR UPDATE OF s" : ""}
    `,
    [simId]
  );

  return result.rows[0] ?? null;
};

export const obtenerSimPorDispositivoId = async (
  dispositivoId: string,
  client?: PoolClient
): Promise<SimRow | null> => {
  const result = await getDb(client).query<SimRow>(
    `
      ${simSelect}
      WHERE s.dispositivo_id = $1
      LIMIT 1
    `,
    [dispositivoId]
  );

  return result.rows[0] ?? null;
};

export const obtenerSimPorIccid = async (
  iccid: string,
  client?: PoolClient,
  forUpdate = false
): Promise<SimRow | null> => {
  const result = await getDb(client).query<SimRow>(
    `
      ${simSelect}
      WHERE REGEXP_REPLACE(BTRIM(s.iccid_codigo_fabrica), '[^0-9]', '', 'g') = $1
      LIMIT 1
      ${forUpdate ? "FOR UPDATE OF s" : ""}
    `,
    [iccid]
  );
  return result.rows[0] ?? null;
};

export const existeOtraLineaConNumero = async (
  numeroTelefonico: string,
  simId: string | null,
  client: PoolClient,
  simIdAdicionalExcluida: string | null = null
): Promise<boolean> => {
  const result = await client.query<{ existe: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1
        FROM itam.lineas_moviles linea
        LEFT JOIN itam.sim sim ON sim.id = linea.sim_id
        LEFT JOIN itam.estados estado_sim ON estado_sim.id = sim.estado_id
        WHERE REGEXP_REPLACE(linea.numero_telefonico, '[^0-9]', '', 'g') = $1
          AND ($2::bigint IS NULL OR sim.id IS NULL OR sim.id <> $2::bigint)
          AND ($3::bigint IS NULL OR sim.id IS NULL OR sim.id <> $3::bigint)
          AND (sim.id IS NULL OR estado_sim.codigo IN ('DISPONIBLE', 'ASIGNADA'))
          AND linea.estado <> 'DADA_BAJA'
      ) AS existe
    `,
    [numeroTelefonico, simId, simIdAdicionalExcluida]
  );
  return result.rows[0]?.existe ?? false;
};

export const existeOtraSimOperableConNumero = async (
  numeroAsociado: string,
  simId: string | null,
  client: PoolClient,
  simIdAdicionalExcluida: string | null = null
): Promise<boolean> => {
  return existeOtraLineaConNumero(
    numeroAsociado,
    simId,
    client,
    simIdAdicionalExcluida
  );
};

export const obtenerEstadoSimPorCodigo = async (
  codigo: string,
  client?: PoolClient
): Promise<EstadoSimRow | null> => {
  const result = await getDb(client).query<EstadoSimRow>(
    `
      SELECT id, codigo, nombre
      FROM itam.estados
      WHERE tipo_entidad = 'SIM'
        AND codigo = $1
        AND activo = TRUE
      LIMIT 1
    `,
    [codigo]
  );

  return result.rows[0] ?? null;
};

export const obtenerEstadoSimPorId = async (
  estadoId: number,
  client?: PoolClient
): Promise<EstadoSimRow | null> => {
  const result = await getDb(client).query<EstadoSimRow>(
    `
      SELECT id, codigo, nombre
      FROM itam.estados
      WHERE tipo_entidad = 'SIM'
        AND id = $1
        AND activo = TRUE
      LIMIT 1
    `,
    [estadoId]
  );

  return result.rows[0] ?? null;
};

export const crearSim = async (
  input: CrearSimInput,
  codigoInventario: number,
  estadoId: string,
  client: PoolClient,
  options: {
    dispositivoId?: string | null;
    colaboradorId?: string | number | null;
    lineaMovilId?: string | null;
  } = {}
): Promise<SimRow> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      INSERT INTO itam.sim (
        codigo_inventario,
        iccid_codigo_fabrica,
        compania,
        estado_id,
        colaborador_id,
        dispositivo_id,
        linea_movil_id,
        observaciones
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      input.iccidCodigoFabrica,
      input.compania ?? null,
      estadoId,
      options.colaboradorId ?? null,
      options.dispositivoId ?? null,
      options.lineaMovilId ?? null,
      input.observaciones ?? null
    ]
  );

  const sim = await obtenerSimPorCodigo(
    result.rows[0]!.codigo_inventario,
    client
  );

  return sim!;
};

export const actualizarSim = async (
  codigoInventario: number,
  input: ActualizarSimInput,
  client?: PoolClient
): Promise<SimRow | null> => {
  const result = await getDb(client).query<{ codigo_inventario: number }>(
    `
      UPDATE itam.sim
      SET
        iccid_codigo_fabrica = COALESCE(
          $2,
          iccid_codigo_fabrica
        ),
        compania = CASE
          WHEN $3::boolean THEN $4
          ELSE compania
        END,
        observaciones = CASE
          WHEN $5::boolean THEN $6
          ELSE observaciones
        END
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      input.iccidCodigoFabrica ?? null,
      input.compania !== undefined,
      input.compania ?? null,
      input.observaciones !== undefined,
      input.observaciones ?? null
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerSimPorCodigo(result.rows[0].codigo_inventario, client);
};

export const asociarSimADispositivo = async (
  codigoInventario: number,
  dispositivoId: string,
  client: PoolClient
): Promise<SimRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.sim
      SET dispositivo_id = $2
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario, dispositivoId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerSimPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const desasociarSimDeDispositivo = async (
  codigoInventario: number,
  client: PoolClient
): Promise<SimRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.sim
      SET dispositivo_id = NULL
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerSimPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const asignarSimAColaborador = async (
  codigoInventario: number,
  colaboradorId: number,
  client: PoolClient
): Promise<SimRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.sim
      SET colaborador_id = $2
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario, colaboradorId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerSimPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const desasignarSimDeColaborador = async (
  codigoInventario: number,
  client: PoolClient
): Promise<SimRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.sim
      SET colaborador_id = NULL
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerSimPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const recibirSimEnTi = async (
  simId: string,
  estadoDisponibleId: number | string,
  client: PoolClient
): Promise<SimRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.sim
      SET dispositivo_id = NULL,
          colaborador_id = NULL,
          estado_id = $2
      WHERE id = $1
      RETURNING codigo_inventario
    `,
    [simId, estadoDisponibleId]
  );

  if (!result.rows[0]) return null;

  return obtenerSimPorCodigo(result.rows[0].codigo_inventario, client);
};

export const cambiarEstadoSim = async (
  codigoInventario: number,
  estadoId: number | string,
  client: PoolClient
): Promise<SimRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.sim
      SET estado_id = $2
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario, estadoId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerSimPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const insertarHistorialSim = async (
  simId: string,
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
        sim_id,
        tipo_evento,
        estado_anterior_id,
        estado_nuevo_id,
        responsable,
        observaciones,
        detalle
      )
      VALUES (
        'SIM',
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
      simId,
      tipoEvento,
      estadoAnteriorId,
      estadoNuevoId,
      responsable,
      observaciones ?? null,
      JSON.stringify(detalle)
    ]
  );
};

export const listarHistorialSim = async (
  codigoInventario: number
): Promise<HistorialSimRow[]> => {
  const result = await pool.query<HistorialSimRow>(
    `
      SELECT
        h.id,
        h.tipo_entidad,
        h.sim_id,
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
      INNER JOIN itam.sim s
        ON s.id = h.sim_id
      LEFT JOIN itam.estados anterior
        ON anterior.id = h.estado_anterior_id
      LEFT JOIN itam.estados nuevo
        ON nuevo.id = h.estado_nuevo_id
      WHERE s.codigo_inventario = $1
        AND h.tipo_entidad = 'SIM'
      ORDER BY h.fecha_evento DESC
    `,
    [codigoInventario]
  );

  return result.rows;
};
