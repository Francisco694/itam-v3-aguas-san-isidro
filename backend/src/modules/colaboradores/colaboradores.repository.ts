import { pool } from "../../config/database";
import type {
  ActualizarColaboradorInput,
  ColaboradorFilters,
  ColaboradorRow,
  CrearColaboradorInput
} from "./colaboradores.types";

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
  id: number
): Promise<ColaboradorRow | null> => {
  const result = await pool.query<ColaboradorRow>(
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
