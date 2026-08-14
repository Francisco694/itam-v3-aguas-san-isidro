import { pool } from "../../config/database";
import type {
  ActualizarDepartamentoInput,
  CrearDepartamentoInput,
  DepartamentoRow
} from "./departamentos.types";

export const listarDepartamentos = async (): Promise<
  DepartamentoRow[]
> => {
  const result = await pool.query<DepartamentoRow>(
    `
      SELECT
        id,
        nombre,
        activo,
        observaciones,
        creado_en,
        actualizado_en
      FROM itam.departamentos
      ORDER BY nombre ASC
    `
  );

  return result.rows;
};

export const obtenerDepartamentoPorId = async (
  id: number
): Promise<DepartamentoRow | null> => {
  const result = await pool.query<DepartamentoRow>(
    `
      SELECT
        id,
        nombre,
        activo,
        observaciones,
        creado_en,
        actualizado_en
      FROM itam.departamentos
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  return result.rows[0] ?? null;
};

export const obtenerDepartamentoPorNombre = async (
  nombre: string
): Promise<DepartamentoRow | null> => {
  const result = await pool.query<DepartamentoRow>(
    `
      SELECT
        id,
        nombre,
        activo,
        observaciones,
        creado_en,
        actualizado_en
      FROM itam.departamentos
      WHERE LOWER(BTRIM(nombre)) = LOWER(BTRIM($1))
      LIMIT 1
    `,
    [nombre]
  );

  return result.rows[0] ?? null;
};

export const crearDepartamento = async (
  input: CrearDepartamentoInput
): Promise<DepartamentoRow> => {
  const result = await pool.query<DepartamentoRow>(
    `
      INSERT INTO itam.departamentos (
        nombre,
        activo,
        observaciones
      )
      VALUES ($1, COALESCE($2, TRUE), $3)
      RETURNING
        id,
        nombre,
        activo,
        observaciones,
        creado_en,
        actualizado_en
    `,
    [
      input.nombre,
      input.activo ?? null,
      input.observaciones ?? null
    ]
  );

  return result.rows[0]!;
};

export const actualizarDepartamento = async (
  id: number,
  input: ActualizarDepartamentoInput
): Promise<DepartamentoRow | null> => {
  const result = await pool.query<DepartamentoRow>(
    `
      UPDATE itam.departamentos
      SET
        nombre = COALESCE($2, nombre),
        activo = COALESCE($3, activo),
        observaciones = CASE
          WHEN $4::boolean THEN $5
          ELSE observaciones
        END
      WHERE id = $1
      RETURNING
        id,
        nombre,
        activo,
        observaciones,
        creado_en,
        actualizado_en
    `,
    [
      id,
      input.nombre ?? null,
      input.activo ?? null,
      input.observaciones !== undefined,
      input.observaciones ?? null
    ]
  );

  return result.rows[0] ?? null;
};
