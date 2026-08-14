import { toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  isUniqueViolation
} from "../../shared/errors";
import {
  actualizarDepartamento,
  crearDepartamento,
  listarDepartamentos,
  obtenerDepartamentoPorId,
  obtenerDepartamentoPorNombre
} from "./departamentos.repository";
import type {
  ActualizarDepartamentoInput,
  CrearDepartamentoInput,
  Departamento,
  DepartamentoRow
} from "./departamentos.types";

const mapDepartamento = (
  row: DepartamentoRow
): Departamento => ({
  id: row.id,
  nombre: row.nombre,
  activo: row.activo,
  observaciones: row.observaciones,
  creadoEn: toIsoDateTime(row.creado_en),
  actualizadoEn: toIsoDateTime(row.actualizado_en)
});

const validarNombreDisponible = async (
  nombre: string,
  currentId?: string
): Promise<void> => {
  const existing = await obtenerDepartamentoPorNombre(nombre);

  if (existing && existing.id !== currentId) {
    throw new ConflictError(
      "Ya existe un departamento con ese nombre."
    );
  }
};

export const obtenerDepartamentos = async (): Promise<
  Departamento[]
> => {
  const rows = await listarDepartamentos();

  return rows.map(mapDepartamento);
};

export const obtenerDepartamento = async (
  id: number
): Promise<Departamento> => {
  const row = await obtenerDepartamentoPorId(id);

  if (!row) {
    throw new NotFoundError("Departamento no encontrado.");
  }

  return mapDepartamento(row);
};

export const crearNuevoDepartamento = async (
  input: CrearDepartamentoInput
): Promise<Departamento> => {
  await validarNombreDisponible(input.nombre);

  try {
    const row = await crearDepartamento(input);
    return mapDepartamento(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Ya existe un departamento con ese nombre."
      );
    }

    throw error;
  }
};

export const actualizarDepartamentoExistente = async (
  id: number,
  input: ActualizarDepartamentoInput
): Promise<Departamento> => {
  const current = await obtenerDepartamentoPorId(id);

  if (!current) {
    throw new NotFoundError("Departamento no encontrado.");
  }

  if (input.nombre !== undefined) {
    await validarNombreDisponible(input.nombre, current.id);
  }

  try {
    const row = await actualizarDepartamento(id, input);

    if (!row) {
      throw new NotFoundError("Departamento no encontrado.");
    }

    return mapDepartamento(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Ya existe un departamento con ese nombre."
      );
    }

    throw error;
  }
};
