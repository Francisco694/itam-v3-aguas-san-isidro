import { toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  isForeignKeyViolation,
  isUniqueViolation
} from "../../shared/errors";
import {
  actualizarDepartamento,
  crearDepartamento,
  dependenciaGeneraCiclo,
  listarDepartamentos,
  obtenerDepartamentoPorId,
  obtenerDepartamentoPorNombre
} from "./departamentos.repository";
import type {
  ActualizarDepartamentoInput,
  CrearDepartamentoInput,
  Departamento,
  DepartamentoRow,
  InventarioDepartamento
} from "./departamentos.types";
import { obtenerDispositivos } from "../dispositivos/dispositivos.service";

const mapDepartamento = (
  row: DepartamentoRow
): Departamento => ({
  id: row.id,
  nombre: row.nombre,
  activo: row.activo,
  observaciones: row.observaciones,
  dependencia_id: row.dependencia_id === null ? null : Number(row.dependencia_id),
  dependencia_nombre: row.dependencia_nombre,
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

const validarDependencia = async (
  dependenciaId: number | null | undefined,
  departamentoId?: number
): Promise<void> => {
  if (dependenciaId === undefined || dependenciaId === null) return;
  if (dependenciaId === departamentoId) {
    throw new ValidationError("Un departamento no puede depender de sí mismo.");
  }
  if (!await obtenerDepartamentoPorId(dependenciaId)) {
    throw new NotFoundError("El departamento seleccionado como dependencia no existe.");
  }
  if (departamentoId !== undefined) {
    const generaCiclo = await dependenciaGeneraCiclo(departamentoId, dependenciaId);
    if (generaCiclo) {
      throw new ValidationError(
        "La dependencia seleccionada genera un ciclo organizacional."
      );
    }
  }
};

export const obtenerInventarioDepartamento = async (
  id: number
): Promise<InventarioDepartamento> => {
  const departamento = await obtenerDepartamento(id);
  const [custodiaDirecta, activosColaboradores] = await Promise.all([
    obtenerDispositivos({ departamentoId: id }),
    obtenerDispositivos({ departamentoColaboradorId: id })
  ]);

  return {
    departamento,
    resumen: {
      custodiaDirecta: custodiaDirecta.length,
      conColaboradores: activosColaboradores.length,
      totalRelacionado:
        custodiaDirecta.length + activosColaboradores.length
    },
    custodiaDirecta,
    activosColaboradores
  };
};

export const crearNuevoDepartamento = async (
  input: CrearDepartamentoInput
): Promise<Departamento> => {
  await validarNombreDisponible(input.nombre);
  await validarDependencia(input.dependencia_id);

  try {
    const row = await crearDepartamento(input);
    return mapDepartamento(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Ya existe un departamento con ese nombre."
      );
    }
    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("El departamento seleccionado como dependencia no existe.");
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
  await validarDependencia(input.dependencia_id, id);

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
    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("El departamento seleccionado como dependencia no existe.");
    }

    throw error;
  }
};
