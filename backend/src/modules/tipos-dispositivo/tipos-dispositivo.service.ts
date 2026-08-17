import type { PoolClient } from "pg";
import { toIsoDateTime } from "../../shared/dates";
import { ConflictError, NotFoundError, ValidationError,
  isDatabaseBusinessRuleViolation, isForeignKeyViolation,
  isUniqueViolation } from "../../shared/errors";
import { actualizarTipoDispositivo, crearTipoDispositivo,
  contarDispositivosPorTipo, listarTiposDispositivo,
  obtenerFamiliaDispositivoPorId,
  obtenerTipoDispositivoPorId, obtenerTipoDispositivoPorNombre
} from "./tipos-dispositivo.repository";
import type { ActualizarTipoDispositivoInput, CrearTipoDispositivoInput,
  TipoDispositivo, TipoDispositivoFilters, TipoDispositivoRow
} from "./tipos-dispositivo.types";

export const mapTipoDispositivo = (row: TipoDispositivoRow): TipoDispositivo => ({
  id: row.id, nombre: row.nombre, descripcion: row.descripcion, activo: row.activo,
  requiereImei: row.requiere_imei,
  configuracionFormulario: row.configuracion_formulario,
  familiaCodigoInventario:
    row.familia_codigo_inventario_id && row.familia_nombre &&
    row.familia_prefijo && row.familia_activa !== null
      ? { id: row.familia_codigo_inventario_id, nombre: row.familia_nombre,
          prefijo: row.familia_prefijo, activo: row.familia_activa,
          estrategiaCodigo: row.familia_estrategia!,
          agrupaTipos: row.familia_agrupa_tipos ?? false,
          etiquetaOperativa: row.familia_etiqueta_operativa }
      : null,
  creadoEn: toIsoDateTime(row.creado_en),
  actualizadoEn: toIsoDateTime(row.actualizado_en)
});

const validarFamilia = async (
  familiaId: number | null | undefined,
  client?: PoolClient
): Promise<void> => {
  if (familiaId === undefined || familiaId === null) return;
  const familia = await obtenerFamiliaDispositivoPorId(familiaId, client);
  if (!familia) throw new NotFoundError("Familia de código no encontrada.");
  if (familia.tipo_entidad !== "DISPOSITIVO") {
    throw new ValidationError("La familia seleccionada no corresponde a dispositivos.");
  }
  if (!familia.activo) {
    throw new ValidationError("La familia seleccionada está inactiva.");
  }
};

const validarNombreDisponible = async (
  nombre: string,
  currentId?: string,
  client?: PoolClient
): Promise<void> => {
  const existing = await obtenerTipoDispositivoPorNombre(nombre, client);
  if (existing && existing.id !== currentId) {
    throw new ConflictError("Ya existe un tipo de dispositivo con ese nombre.");
  }
};

const normalizarError = (error: unknown): never => {
  if (isUniqueViolation(error)) {
    throw new ConflictError("Ya existe un tipo de dispositivo con ese nombre.");
  }
  if (isForeignKeyViolation(error)) {
    throw new ConflictError("La familia de código está en uso o no es válida.");
  }
  if (isDatabaseBusinessRuleViolation(error)) {
    throw new ConflictError(
      error instanceof Error ? error.message : "La relación histórica impide este cambio."
    );
  }
  throw error;
};

export const obtenerTiposDispositivo = async (
  filters: TipoDispositivoFilters
): Promise<TipoDispositivo[]> =>
  (await listarTiposDispositivo(filters)).map(mapTipoDispositivo);

export const obtenerTipoDispositivo = async (id: number): Promise<TipoDispositivo> => {
  const row = await obtenerTipoDispositivoPorId(id);
  if (!row) throw new NotFoundError("Tipo de dispositivo no encontrado.");
  return mapTipoDispositivo(row);
};

export const crearNuevoTipoDispositivo = async (
  input: CrearTipoDispositivoInput
): Promise<TipoDispositivo> => {
  await validarNombreDisponible(input.nombre);
  await validarFamilia(input.familiaCodigoInventarioId);
  try { return mapTipoDispositivo(await crearTipoDispositivo(input)); }
  catch (error) { return normalizarError(error); }
};

export const actualizarTipoDispositivoExistente = async (
  id: number,
  input: ActualizarTipoDispositivoInput
): Promise<TipoDispositivo> => {
  const current = await obtenerTipoDispositivoPorId(id);
  if (!current) throw new NotFoundError("Tipo de dispositivo no encontrado.");
  if (input.nombre !== undefined) {
    await validarNombreDisponible(input.nombre, current.id);
  }
  if (
    input.familiaCodigoInventarioId !== undefined &&
    String(input.familiaCodigoInventarioId ?? "") !==
      String(current.familia_codigo_inventario_id ?? "") &&
    await contarDispositivosPorTipo(id) > 0
  ) {
    throw new ConflictError(
      "No se puede mover este tipo a otra familia porque existen activos con códigos históricos asociados."
    );
  }
  await validarFamilia(input.familiaCodigoInventarioId);
  try {
    const row = await actualizarTipoDispositivo(id, input);
    if (!row) throw new NotFoundError("Tipo de dispositivo no encontrado.");
    return mapTipoDispositivo(row);
  } catch (error) { return normalizarError(error); }
};

export const resolverTipoActivoParaAlta = async (
  id: number,
  client: PoolClient
): Promise<TipoDispositivoRow> => {
  const tipo = await obtenerTipoDispositivoPorId(id, client);
  if (!tipo) throw new NotFoundError("Tipo de dispositivo no encontrado.");
  if (!tipo.activo) throw new ValidationError("El tipo de dispositivo está inactivo.");
  if (!tipo.familia_codigo_inventario_id || !tipo.familia_activa) {
    throw new ValidationError(
      `El tipo ${tipo.nombre} no tiene una familia de código activa configurada.`
    );
  }
  return tipo;
};

export const resolverTipoActivo = async (
  id: number,
  client?: PoolClient
): Promise<TipoDispositivoRow> => {
  const tipo = await obtenerTipoDispositivoPorId(id, client);
  if (!tipo) throw new NotFoundError("Tipo de dispositivo no encontrado.");
  if (!tipo.activo) throw new ValidationError("El tipo de dispositivo está inactivo.");
  return tipo;
};
