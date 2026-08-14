import { pool } from "../../config/database";
import type {
  EstadoFilters,
  EstadoRow,
  TipoEntidad
} from "./estados.types";

export const listarEstados = async (
  filters: EstadoFilters
): Promise<EstadoRow[]> => {
  const values: unknown[] = [];
  const where: string[] = [];

  if (filters.tipoEntidad !== undefined) {
    values.push(filters.tipoEntidad);
    where.push(`tipo_entidad = $${values.length}`);
  }

  const result = await pool.query<EstadoRow>(
    `
      SELECT
        id,
        tipo_entidad,
        codigo,
        nombre,
        descripcion,
        es_terminal,
        activo,
        creado_en
      FROM itam.estados
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY tipo_entidad ASC, codigo ASC
    `,
    values
  );

  return result.rows;
};

export const obtenerEstadoActivoPorCodigo = async (
  tipoEntidad: TipoEntidad,
  codigo: string
): Promise<EstadoRow | null> => {
  const result = await pool.query<EstadoRow>(
    `
      SELECT
        id,
        tipo_entidad,
        codigo,
        nombre,
        descripcion,
        es_terminal,
        activo,
        creado_en
      FROM itam.estados
      WHERE tipo_entidad = $1
        AND codigo = $2
        AND activo = TRUE
      LIMIT 1
    `,
    [tipoEntidad, codigo]
  );

  return result.rows[0] ?? null;
};

export const obtenerEstadoActivoPorId = async (
  tipoEntidad: TipoEntidad,
  estadoId: number
): Promise<EstadoRow | null> => {
  const result = await pool.query<EstadoRow>(
    `
      SELECT
        id,
        tipo_entidad,
        codigo,
        nombre,
        descripcion,
        es_terminal,
        activo,
        creado_en
      FROM itam.estados
      WHERE tipo_entidad = $1
        AND id = $2
        AND activo = TRUE
      LIMIT 1
    `,
    [tipoEntidad, estadoId]
  );

  return result.rows[0] ?? null;
};
