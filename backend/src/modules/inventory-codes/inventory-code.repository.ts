import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import type {
  CreateInventoryCodeFamilyInput,
  InventoryCodeFamilyRow,
  InventoryCodeFamilyFilters,
  InventoryEntityType,
  UpdateInventoryCodeFamilyInput
} from "./inventory-code.types";

const familySelect = `
  SELECT familia.id, familia.tipo_entidad,
    familia.tipo_activo_normalizado, familia.nombre_familia,
    familia.prefijo, familia.ultimo_ordinal, familia.activo,
    familia.estrategia_codigo, familia.version_esquema,
    familia.agrupa_tipos, familia.etiqueta_operativa,
    familia.creado_en, familia.actualizado_en,
    (
      familia.ultimo_ordinal > 0
      OR (familia.tipo_entidad = 'SIM' AND EXISTS (
        SELECT 1 FROM itam.sim LIMIT 1
      ))
      OR EXISTS (
        SELECT 1
        FROM itam.dispositivos AS dispositivo
        JOIN itam.tipos_dispositivo AS tipo_emitido
          ON tipo_emitido.id = dispositivo.tipo_dispositivo_id
        WHERE tipo_emitido.familia_codigo_inventario_id = familia.id
      )
    ) AS tiene_codigos_emitidos,
    COALESCE(
      JSONB_AGG(
        JSONB_BUILD_OBJECT(
          'id', tipo.id,
          'nombre', tipo.nombre,
          'activo', tipo.activo
        ) ORDER BY tipo.nombre
      ) FILTER (WHERE tipo.id IS NOT NULL),
      '[]'::JSONB
    ) AS tipos_asociados
  FROM itam.familias_codigo_inventario AS familia
  LEFT JOIN itam.tipos_dispositivo AS tipo
    ON tipo.familia_codigo_inventario_id = familia.id
`;

const familyGroup = `
  GROUP BY familia.id
`;

export const listInventoryCodeFamilies = async (
  filters: InventoryCodeFamilyFilters = {}
): Promise<
  InventoryCodeFamilyRow[]
> => {
  const values: unknown[] = [];
  const where: string[] = [];
  if (filters.activo !== undefined) {
    values.push(filters.activo);
    where.push(`familia.activo = $${values.length}`);
  }
  if (filters.tipoEntidad !== undefined) {
    values.push(filters.tipoEntidad);
    where.push(`familia.tipo_entidad = $${values.length}`);
  }
  const result = await pool.query<InventoryCodeFamilyRow>(
    `${familySelect}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ${familyGroup}
     ORDER BY familia.prefijo`,
    values
  );
  return result.rows;
};

export const getInventoryCodeFamilyById = async (
  id: number,
  client?: PoolClient
): Promise<InventoryCodeFamilyRow | null> => {
  const executor = client ?? pool;
  const result = await executor.query<InventoryCodeFamilyRow>(
    `${familySelect} WHERE familia.id = $1 ${familyGroup} LIMIT 1`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const getInventoryCodeFamilyByName = async (
  name: string,
  client?: PoolClient
): Promise<InventoryCodeFamilyRow | null> => {
  const executor = client ?? pool;
  const result = await executor.query<InventoryCodeFamilyRow>(
    `${familySelect}
     WHERE LOWER(BTRIM(familia.nombre_familia)) = LOWER(BTRIM($1))
     ${familyGroup} LIMIT 1`,
    [name]
  );
  return result.rows[0] ?? null;
};

export const getInventoryCodeFamilyByPrefix = async (
  prefix: string,
  client?: PoolClient
): Promise<InventoryCodeFamilyRow | null> => {
  const executor = client ?? pool;
  const result = await executor.query<InventoryCodeFamilyRow>(
    `${familySelect} WHERE familia.prefijo = $1 ${familyGroup} LIMIT 1`,
    [prefix]
  );
  return result.rows[0] ?? null;
};

export const createInventoryCodeFamily = async (
  input: CreateInventoryCodeFamilyInput,
  client?: PoolClient
): Promise<InventoryCodeFamilyRow> => {
  const executor = client ?? pool;
  const result = await executor.query<{ id: string }>(
    `INSERT INTO itam.familias_codigo_inventario (
       tipo_entidad, tipo_activo_normalizado, nombre_familia,
       prefijo, estrategia_codigo, activo
     ) VALUES ('DISPOSITIVO', $1, $2, $3, $4, COALESCE($5, TRUE))
     RETURNING id`,
    [input.tipoActivoNormalizado, input.nombreFamilia, input.prefijo,
      input.estrategiaCodigo, input.activo ?? null]
  );
  return (await getInventoryCodeFamilyById(Number(result.rows[0]!.id), client))!;
};

export const updateInventoryCodeFamily = async (
  id: number,
  input: UpdateInventoryCodeFamilyInput,
  client?: PoolClient
): Promise<InventoryCodeFamilyRow | null> => {
  const executor = client ?? pool;
  const result = await executor.query<{ id: string }>(
    `UPDATE itam.familias_codigo_inventario SET
       nombre_familia = COALESCE($2, nombre_familia),
       tipo_activo_normalizado = COALESCE($3, tipo_activo_normalizado),
       prefijo = COALESCE($4, prefijo),
       estrategia_codigo = COALESCE($5, estrategia_codigo),
       activo = COALESCE($6, activo)
     WHERE id = $1 RETURNING id`,
    [id, input.nombreFamilia ?? null, input.tipoActivoNormalizado ?? null,
      input.prefijo ?? null, input.estrategiaCodigo ?? null,
      input.activo ?? null]
  );
  return result.rows[0] ? getInventoryCodeFamilyById(id, client) : null;
};

export const listUsedInventoryCodePrefixes = async (): Promise<string[]> => {
  const result = await pool.query<{ prefijo: string }>(
    "SELECT prefijo FROM itam.familias_codigo_inventario ORDER BY prefijo"
  );
  return result.rows.map((row) => row.prefijo);
};

export const lockInventoryCodeFamily = async (
  entityType: InventoryEntityType,
  assetType: string | null,
  client: PoolClient
): Promise<InventoryCodeFamilyRow | null> => {
  const result = await client.query<InventoryCodeFamilyRow>(
    `
      SELECT id, tipo_entidad, tipo_activo_normalizado,
        nombre_familia, prefijo, ultimo_ordinal, activo,
        estrategia_codigo, version_esquema, creado_en, actualizado_en,
        agrupa_tipos, etiqueta_operativa,
        (ultimo_ordinal > 0) AS tiene_codigos_emitidos,
        '[]'::JSONB AS tipos_asociados
      FROM itam.familias_codigo_inventario
      WHERE tipo_entidad = $1
        AND COALESCE(tipo_activo_normalizado, '') = COALESCE($2, '')
        AND activo = TRUE
      FOR UPDATE
    `,
    [entityType, assetType]
  );
  return result.rows[0] ?? null;
};

export const lockInventoryCodeFamilyById = async (
  familyId: string,
  entityType: InventoryEntityType,
  client: PoolClient
): Promise<InventoryCodeFamilyRow | null> => {
  const result = await client.query<InventoryCodeFamilyRow>(
    `
      SELECT id, tipo_entidad, tipo_activo_normalizado,
        nombre_familia, prefijo, ultimo_ordinal, activo,
        estrategia_codigo, version_esquema, creado_en, actualizado_en,
        agrupa_tipos, etiqueta_operativa,
        (ultimo_ordinal > 0) AS tiene_codigos_emitidos,
        '[]'::JSONB AS tipos_asociados
      FROM itam.familias_codigo_inventario
      WHERE id = $1
        AND tipo_entidad = $2
        AND activo = TRUE
      FOR UPDATE
    `,
    [familyId, entityType]
  );
  return result.rows[0] ?? null;
};

export const inventoryCodeExists = async (
  code: number,
  client: PoolClient
): Promise<boolean> => {
  const result = await client.query<{ existe: boolean }>(
    `
      SELECT EXISTS (
        SELECT 1 FROM itam.dispositivos WHERE codigo_inventario = $1
        UNION ALL
        SELECT 1 FROM itam.sim WHERE codigo_inventario = $1
      ) AS existe
    `,
    [code]
  );
  return result.rows[0]?.existe ?? false;
};

export const updateInventoryCodeOrdinal = async (
  familyId: string,
  ordinal: number,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `UPDATE itam.familias_codigo_inventario
     SET ultimo_ordinal = $2
     WHERE id = $1`,
    [familyId, ordinal]
  );
};
