import { obtenerDepartamentoPorId } from "../departamentos/departamentos.repository";
import { toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  isForeignKeyViolation,
  isUniqueViolation
} from "../../shared/errors";
import {
  actualizarColaborador,
  crearColaborador,
  listarColaboradores,
  obtenerColaboradorPorId,
  obtenerColaboradorPorRut
} from "./colaboradores.repository";
import type {
  ActualizarColaboradorInput,
  Colaborador,
  ColaboradorFilters,
  ColaboradorRow,
  CrearColaboradorInput
} from "./colaboradores.types";

const mapColaborador = (row: ColaboradorRow): Colaborador => ({
  id: row.id,
  rut: row.rut,
  nombre: row.nombre,
  cargo: row.cargo,
  departamento:
    row.departamento_id && row.departamento_nombre
      ? {
          id: row.departamento_id,
          nombre: row.departamento_nombre
        }
      : null,
  localidad: row.localidad,
  activo: row.activo,
  observaciones: row.observaciones,
  creadoEn: toIsoDateTime(row.creado_en),
  actualizadoEn: toIsoDateTime(row.actualizado_en)
});

const validarRutDisponible = async (
  rut: string,
  currentId?: string
): Promise<void> => {
  const existing = await obtenerColaboradorPorRut(rut);

  if (existing && existing.id !== currentId) {
    throw new ConflictError("Ya existe un colaborador con ese RUT.");
  }
};

const validarDepartamentoExiste = async (
  departamentoId: number | null | undefined
): Promise<void> => {
  if (departamentoId === undefined || departamentoId === null) {
    return;
  }

  const departamento = await obtenerDepartamentoPorId(departamentoId);

  if (!departamento) {
    throw new NotFoundError("Departamento no encontrado.");
  }
};

export const obtenerColaboradores = async (
  filters: ColaboradorFilters
): Promise<Colaborador[]> => {
  const rows = await listarColaboradores(filters);

  return rows.map(mapColaborador);
};

export const obtenerColaborador = async (
  id: number
): Promise<Colaborador> => {
  const row = await obtenerColaboradorPorId(id);

  if (!row) {
    throw new NotFoundError("Colaborador no encontrado.");
  }

  return mapColaborador(row);
};

export const obtenerColaboradorPorRutExistente = async (
  rut: string
): Promise<Colaborador> => {
  const row = await obtenerColaboradorPorRut(rut);

  if (!row) {
    throw new NotFoundError("Colaborador no encontrado.");
  }

  return mapColaborador(row);
};

export const crearNuevoColaborador = async (
  input: CrearColaboradorInput
): Promise<Colaborador> => {
  await validarRutDisponible(input.rut);
  await validarDepartamentoExiste(input.departamentoId);

  try {
    const row = await crearColaborador(input);
    return mapColaborador(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Ya existe un colaborador con ese RUT."
      );
    }

    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Departamento no encontrado.");
    }

    throw error;
  }
};

export const actualizarColaboradorExistente = async (
  id: number,
  input: ActualizarColaboradorInput
): Promise<Colaborador> => {
  const current = await obtenerColaboradorPorId(id);

  if (!current) {
    throw new NotFoundError("Colaborador no encontrado.");
  }

  if (input.rut !== undefined) {
    await validarRutDisponible(input.rut, current.id);
  }

  await validarDepartamentoExiste(input.departamentoId);

  try {
    const row = await actualizarColaborador(id, input);

    if (!row) {
      throw new NotFoundError("Colaborador no encontrado.");
    }

    return mapColaborador(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Ya existe un colaborador con ese RUT."
      );
    }

    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Departamento no encontrado.");
    }

    throw error;
  }
};
