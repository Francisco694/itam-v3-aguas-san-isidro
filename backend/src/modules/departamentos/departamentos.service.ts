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
import type { DispositivoResumen } from "../dispositivos/dispositivos.types";
import { obtenerDispositivos } from "../dispositivos/dispositivos.service";

const ACTIVE_DEPARTMENT_DEVICE_STATE_CODES = new Set([
  "ASIGNADO",
  "DISPONIBLE",
  "EN_BODEGA",
  "PRESTAMO_TEMPORAL",
  "RETENIDO_REVISION",
  "SERVICIO_TECNICO",
  "EN_SERVICIO_TECNICO"
]);

const uniqueActiveDevices = (
  devices: readonly DispositivoResumen[],
  excludedIds = new Set<string>()
): DispositivoResumen[] => {
  const seen = new Set(excludedIds);
  return devices.filter((device) => {
    if (!ACTIVE_DEPARTMENT_DEVICE_STATE_CODES.has(device.estado.codigo)) {
      return false;
    }
    if (seen.has(device.id)) return false;
    seen.add(device.id);
    return true;
  });
};

export const calcularResumenInventarioDepartamento = (
  custodiaDirecta: readonly DispositivoResumen[],
  activosColaboradores: readonly DispositivoResumen[]
): Pick<InventarioDepartamento, "resumen" | "custodiaDirecta" | "activosColaboradores"> => {
  const directosActivos = uniqueActiveDevices(custodiaDirecta);
  const directoIds = new Set(directosActivos.map((device) => device.id));
  const colaboradoresActivos = uniqueActiveDevices(
    activosColaboradores,
    directoIds
  );
  const valorDirectoDepartamento = directosActivos.reduce(
    (total, device) => total + device.valorComercial,
    0
  );
  const valorEquiposPersonal = colaboradoresActivos.reduce(
    (total, device) => total + device.valorComercial,
    0
  );

  return {
    resumen: {
      custodiaDirecta: directosActivos.length,
      conColaboradores: colaboradoresActivos.length,
      totalRelacionado: directosActivos.length + colaboradoresActivos.length,
      valorEconomico: {
        directoDepartamento: valorDirectoDepartamento,
        equiposPersonal: valorEquiposPersonal,
        totalRelacionado: valorDirectoDepartamento + valorEquiposPersonal
      }
    },
    custodiaDirecta: directosActivos,
    activosColaboradores: colaboradoresActivos
  };
};

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
    ...calcularResumenInventarioDepartamento(
      custodiaDirecta,
      activosColaboradores
    )
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
