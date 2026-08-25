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
        departamento.id,
        departamento.nombre,
        departamento.activo,
        departamento.observaciones,
        departamento.dependencia_id,
        dependencia.nombre AS dependencia_nombre,
        departamento.creado_en,
        departamento.actualizado_en
      FROM itam.departamentos departamento
      LEFT JOIN itam.departamentos dependencia ON dependencia.id = departamento.dependencia_id
      ORDER BY departamento.nombre ASC
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
        departamento.id,
        departamento.nombre,
        departamento.activo,
        departamento.observaciones,
        departamento.dependencia_id,
        dependencia.nombre AS dependencia_nombre,
        departamento.creado_en,
        departamento.actualizado_en
      FROM itam.departamentos departamento
      LEFT JOIN itam.departamentos dependencia ON dependencia.id = departamento.dependencia_id
      WHERE departamento.id = $1
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
        departamento.id,
        departamento.nombre,
        departamento.activo,
        departamento.observaciones,
        departamento.dependencia_id,
        dependencia.nombre AS dependencia_nombre,
        departamento.creado_en,
        departamento.actualizado_en
      FROM itam.departamentos departamento
      LEFT JOIN itam.departamentos dependencia ON dependencia.id = departamento.dependencia_id
      WHERE LOWER(BTRIM(departamento.nombre)) = LOWER(BTRIM($1))
      LIMIT 1
    `,
    [nombre]
  );

  return result.rows[0] ?? null;
};

export const dependenciaGeneraCiclo = async (
  departamentoId: number,
  dependenciaId: number
): Promise<boolean> => {
  const result = await pool.query<{ genera_ciclo: boolean }>(
    `
      WITH RECURSIVE ascendencia AS (
        SELECT id, dependencia_id
        FROM itam.departamentos
        WHERE id = $2
        UNION ALL
        SELECT padre.id, padre.dependencia_id
        FROM itam.departamentos padre
        INNER JOIN ascendencia actual ON padre.id = actual.dependencia_id
      )
      SELECT EXISTS (SELECT 1 FROM ascendencia WHERE id = $1) AS genera_ciclo
    `,
    [departamentoId, dependenciaId]
  );
  return result.rows[0]?.genera_ciclo ?? false;
};

export const crearDepartamento = async (
  input: CrearDepartamentoInput
): Promise<DepartamentoRow> => {
  const result = await pool.query<DepartamentoRow>(
    `
      WITH inserted AS (INSERT INTO itam.departamentos (
        nombre,
        activo,
        observaciones,
        dependencia_id
      )
      VALUES ($1, COALESCE($2, TRUE), $3, $4)
      RETURNING *)
      SELECT inserted.id,inserted.nombre,inserted.activo,inserted.observaciones,
        inserted.dependencia_id,dependencia.nombre dependencia_nombre,
        inserted.creado_en,inserted.actualizado_en
      FROM inserted
      LEFT JOIN itam.departamentos dependencia ON dependencia.id=inserted.dependencia_id
    `,
    [
      input.nombre,
      input.activo ?? null,
      input.observaciones ?? null,
      input.dependencia_id ?? null
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
      WITH updated AS (UPDATE itam.departamentos
      SET
        nombre = COALESCE($2, nombre),
        activo = COALESCE($3, activo),
        observaciones = CASE
          WHEN $4::boolean THEN $5
          ELSE observaciones
        END,
        dependencia_id = CASE WHEN $6::boolean THEN $7 ELSE dependencia_id END
      WHERE id = $1
      RETURNING *)
      SELECT updated.id,updated.nombre,updated.activo,updated.observaciones,
        updated.dependencia_id,dependencia.nombre dependencia_nombre,
        updated.creado_en,updated.actualizado_en
      FROM updated
      LEFT JOIN itam.departamentos dependencia ON dependencia.id=updated.dependencia_id
    `,
    [
      id,
      input.nombre ?? null,
      input.activo ?? null,
      input.observaciones !== undefined,
      input.observaciones ?? null,
      input.dependencia_id !== undefined,
      input.dependencia_id ?? null
    ]
  );

  return result.rows[0] ?? null;
};
