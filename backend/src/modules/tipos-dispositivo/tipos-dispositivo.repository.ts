import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/database";
import type {
  ActualizarTipoDispositivoInput,
  CrearTipoDispositivoInput,
  FamiliaDispositivoRow,
  TipoDispositivoFilters,
  TipoDispositivoRow
} from "./tipos-dispositivo.types";

type DbExecutor = Pool | PoolClient;
const getDb = (client?: PoolClient): DbExecutor => client ?? pool;

const tipoSelect = `
  SELECT tipo.id, tipo.nombre, tipo.descripcion, tipo.activo,
    tipo.requiere_imei, tipo.configuracion_formulario,
    tipo.familia_codigo_inventario_id,
    familia.nombre_familia AS familia_nombre,
    familia.prefijo AS familia_prefijo,
    familia.activo AS familia_activa,
    familia.estrategia_codigo AS familia_estrategia,
    familia.agrupa_tipos AS familia_agrupa_tipos,
    familia.etiqueta_operativa AS familia_etiqueta_operativa,
    tipo.creado_en, tipo.actualizado_en
  FROM itam.tipos_dispositivo AS tipo
  LEFT JOIN itam.familias_codigo_inventario AS familia
    ON familia.id = tipo.familia_codigo_inventario_id
`;

export const listarTiposDispositivo = async (
  filters: TipoDispositivoFilters,
  client?: PoolClient
): Promise<TipoDispositivoRow[]> => {
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters.activo !== undefined) {
    values.push(filters.activo);
    where.push(`tipo.activo = $${values.length}`);
  }
  const result = await getDb(client).query<TipoDispositivoRow>(
    `${tipoSelect}
     ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY tipo.nombre ASC`,
    values
  );
  return result.rows;
};

export const obtenerTipoDispositivoPorId = async (
  id: number,
  client?: PoolClient
): Promise<TipoDispositivoRow | null> => {
  const result = await getDb(client).query<TipoDispositivoRow>(
    `${tipoSelect} WHERE tipo.id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const obtenerTipoDispositivoPorNombre = async (
  nombre: string,
  client?: PoolClient
): Promise<TipoDispositivoRow | null> => {
  const result = await getDb(client).query<TipoDispositivoRow>(
    `${tipoSelect}
     WHERE LOWER(BTRIM(tipo.nombre)) = LOWER(BTRIM($1))
     LIMIT 1`,
    [nombre]
  );
  return result.rows[0] ?? null;
};

export const obtenerFamiliaDispositivoPorId = async (
  id: number,
  client?: PoolClient
): Promise<FamiliaDispositivoRow | null> => {
  const result = await getDb(client).query<FamiliaDispositivoRow>(
    `SELECT id, tipo_entidad, nombre_familia, prefijo, activo,
       estrategia_codigo, agrupa_tipos, etiqueta_operativa
     FROM itam.familias_codigo_inventario WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const crearTipoDispositivo = async (
  input: CrearTipoDispositivoInput,
  client?: PoolClient
): Promise<TipoDispositivoRow> => {
  const result = await getDb(client).query<{ id: string }>(
    `INSERT INTO itam.tipos_dispositivo
      (nombre, descripcion, familia_codigo_inventario_id, activo, requiere_imei)
     VALUES ($1, $2, $3, COALESCE($4, TRUE), COALESCE($5, FALSE)) RETURNING id`,
    [input.nombre, input.descripcion ?? null,
      input.familiaCodigoInventarioId ?? null, input.activo ?? null,
      input.requiereImei ?? null]
  );
  return (await obtenerTipoDispositivoPorId(Number(result.rows[0]!.id), client))!;
};

export const actualizarTipoDispositivo = async (
  id: number,
  input: ActualizarTipoDispositivoInput,
  client?: PoolClient
): Promise<TipoDispositivoRow | null> => {
  const result = await getDb(client).query<{ id: string }>(
    `UPDATE itam.tipos_dispositivo SET
       nombre = COALESCE($2, nombre),
       descripcion = CASE WHEN $3::boolean THEN $4 ELSE descripcion END,
       familia_codigo_inventario_id = CASE WHEN $5::boolean THEN $6 ELSE familia_codigo_inventario_id END,
       activo = COALESCE($7, activo),
       requiere_imei = COALESCE($8, requiere_imei)
     WHERE id = $1 RETURNING id`,
    [id, input.nombre ?? null, input.descripcion !== undefined,
      input.descripcion ?? null, input.familiaCodigoInventarioId !== undefined,
      input.familiaCodigoInventarioId ?? null, input.activo ?? null,
      input.requiereImei ?? null]
  );
  return result.rows[0] ? obtenerTipoDispositivoPorId(id, client) : null;
};

export const contarDispositivosPorTipo = async (
  id: number,
  client?: PoolClient
): Promise<number> => {
  const result = await getDb(client).query<{ cantidad: string }>(
    "SELECT COUNT(*) AS cantidad FROM itam.dispositivos WHERE tipo_dispositivo_id = $1",
    [id]
  );
  return Number(result.rows[0]?.cantidad ?? 0);
};
