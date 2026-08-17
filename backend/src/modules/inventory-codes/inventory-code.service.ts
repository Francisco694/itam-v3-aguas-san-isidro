import type { PoolClient } from "pg";
import { toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  isDatabaseBusinessRuleViolation,
  isUniqueViolation
} from "../../shared/errors";
import { formatInventoryCode } from "./inventory-code";
import {
  inventoryCodeExists,
  createInventoryCodeFamily,
  getInventoryCodeFamilyById,
  getInventoryCodeFamilyByName,
  getInventoryCodeFamilyByPrefix,
  listUsedInventoryCodePrefixes,
  listInventoryCodeFamilies,
  lockInventoryCodeFamily,
  lockInventoryCodeFamilyById,
  updateInventoryCodeFamily,
  updateInventoryCodeOrdinal
} from "./inventory-code.repository";
import type {
  CreateInventoryCodeFamilyInput,
  InventoryCodeFamily,
  InventoryCodeFamilyFilters,
  InventoryCodeFamilyRow,
  InventoryCodeStrategy,
  InventoryEntityType,
  UpdateInventoryCodeFamilyInput
} from "./inventory-code.types";

const normalizeAssetType = (value: string): string =>
  value.trim().toUpperCase();

const formatInventoryCodeForFamily = (
  family: Pick<InventoryCodeFamilyRow, "prefijo" | "estrategia_codigo">,
  ordinal: number
): number => {
  switch (family.estrategia_codigo) {
    case "REPEAT_PREFIX":
      return formatInventoryCode(family.prefijo, ordinal);
  }
};

const mapFamily = (row: InventoryCodeFamilyRow): InventoryCodeFamily => {
  let nextCode: number | null = null;
  try {
    nextCode = formatInventoryCodeForFamily(row, row.ultimo_ordinal + 1);
  } catch {
    nextCode = null;
  }
  return {
    id: row.id,
    tipoEntidad: row.tipo_entidad,
    tipoActivo: row.tipo_activo_normalizado,
    nombreFamilia: row.nombre_familia,
    prefijo: row.prefijo,
    activo: row.activo,
    estrategiaCodigo: row.estrategia_codigo,
    versionEsquema: row.version_esquema,
    ultimoOrdinal: row.ultimo_ordinal,
    proximoCodigoEstimado: nextCode,
    tiposAsociados: row.tipos_asociados,
    creadoEn: toIsoDateTime(row.creado_en),
    actualizadoEn: toIsoDateTime(row.actualizado_en),
    tieneCodigosEmitidos: row.tiene_codigos_emitidos,
    agrupaTipos: row.agrupa_tipos,
    etiquetaOperativa: row.etiqueta_operativa
  };
};

const normalizeFamilyKey = (value: string): string =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const validatePrefix = (prefix: string): void => {
  if (!/^[1-9]$/.test(prefix)) {
    throw new ValidationError(
      "El prefijo debe ser un dígito simple entre 1 y 9 para REPEAT_PREFIX."
    );
  }
};

const validateStrategy = (strategy: InventoryCodeStrategy): void => {
  if (strategy !== "REPEAT_PREFIX") {
    throw new ValidationError(
      "La única estrategia disponible actualmente es REPEAT_PREFIX."
    );
  }
};

const normalizeFamilyError = (error: unknown): never => {
  if (isDatabaseBusinessRuleViolation(error)) {
    throw new ConflictError(
      error instanceof Error ? error.message : "La familia está protegida por reglas históricas."
    );
  }
  if (isUniqueViolation(error)) {
    throw new ConflictError("Ya existe una familia con ese nombre o prefijo.");
  }
  throw error;
};

export const getInventoryCodeFamilies = async (
  filters: InventoryCodeFamilyFilters = {}
): Promise<
  InventoryCodeFamily[]
> => {
  return (await listInventoryCodeFamilies(filters)).map(mapFamily);
};

export const getInventoryCodeFamily = async (
  id: number
): Promise<InventoryCodeFamily> => {
  const row = await getInventoryCodeFamilyById(id);
  if (!row) throw new NotFoundError("Familia de código no encontrada.");
  return mapFamily(row);
};

export const suggestInventoryCodePrefix = async (): Promise<{
  prefijo: string | null;
  disponible: boolean;
  mensaje: string;
}> => {
  const used = new Set(await listUsedInventoryCodePrefixes());
  const prefix = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
    .find((candidate) => !used.has(candidate)) ?? null;
  return prefix
    ? { prefijo: prefix, disponible: true,
        mensaje: `El prefijo ${prefix} está disponible; debe ser confirmado por el administrador.` }
    : { prefijo: null, disponible: false,
        mensaje: "No existen prefijos simples disponibles para la estrategia de codificación actual. Debe configurarse una nueva estrategia/versionado de códigos." };
};

export const createNewInventoryCodeFamily = async (
  input: Omit<CreateInventoryCodeFamilyInput, "tipoActivoNormalizado">
): Promise<InventoryCodeFamily> => {
  validatePrefix(input.prefijo);
  validateStrategy(input.estrategiaCodigo);
  const [sameName, samePrefix] = await Promise.all([
    getInventoryCodeFamilyByName(input.nombreFamilia),
    getInventoryCodeFamilyByPrefix(input.prefijo)
  ]);
  if (sameName) {
    throw new ConflictError("Ya existe una familia con ese nombre.");
  }
  if (samePrefix) {
    throw new ConflictError(
      `El prefijo ${input.prefijo} ya está asignado a ${samePrefix.nombre_familia}.`
    );
  }
  const key = normalizeFamilyKey(input.nombreFamilia);
  if (!key) throw new ValidationError("El nombre de familia no es válido.");
  try {
    return mapFamily(await createInventoryCodeFamily({
      ...input,
      tipoActivoNormalizado: key
    }));
  } catch (error) {
    return normalizeFamilyError(error);
  }
};

export const updateExistingInventoryCodeFamily = async (
  id: number,
  input: Omit<UpdateInventoryCodeFamilyInput, "tipoActivoNormalizado">
): Promise<InventoryCodeFamily> => {
  const current = await getInventoryCodeFamilyById(id);
  if (!current) throw new NotFoundError("Familia de código no encontrada.");
  if (input.prefijo !== undefined) validatePrefix(input.prefijo);
  if (input.estrategiaCodigo !== undefined) validateStrategy(input.estrategiaCodigo);
  if (input.nombreFamilia !== undefined) {
    const sameName = await getInventoryCodeFamilyByName(input.nombreFamilia);
    if (sameName && sameName.id !== current.id) {
      throw new ConflictError("Ya existe una familia con ese nombre.");
    }
  }
  if (input.prefijo !== undefined) {
    const samePrefix = await getInventoryCodeFamilyByPrefix(input.prefijo);
    if (samePrefix && samePrefix.id !== current.id) {
      throw new ConflictError(
        `El prefijo ${input.prefijo} ya está asignado a ${samePrefix.nombre_familia}.`
      );
    }
  }
  try {
    const row = await updateInventoryCodeFamily(id, {
      ...input,
      tipoActivoNormalizado: input.nombreFamilia === undefined
        ? undefined
        : current.tipo_entidad === "DISPOSITIVO"
          ? normalizeFamilyKey(input.nombreFamilia)
          : undefined
    });
    if (!row) throw new NotFoundError("Familia de código no encontrada.");
    return mapFamily(row);
  } catch (error) {
    return normalizeFamilyError(error);
  }
};

export const generateInventoryCode = async (
  entityType: InventoryEntityType,
  assetType: string | null,
  client: PoolClient
): Promise<number> => {
  const normalizedType = assetType ? normalizeAssetType(assetType) : null;
  const family = await lockInventoryCodeFamily(
    entityType,
    normalizedType,
    client
  );

  if (!family) {
    const detail = normalizedType ? ` ${normalizedType}` : "";
    throw new ValidationError(
      `No existe una familia de código activa para ${entityType}${detail}.`
    );
  }

  let ordinal = family.ultimo_ordinal;
  let code: number;

  do {
    ordinal += 1;
    try {
      code = formatInventoryCodeForFamily(family, ordinal);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error ? error.message : "No fue posible generar el código ITAM."
      );
    }
  } while (await inventoryCodeExists(code, client));

  await updateInventoryCodeOrdinal(family.id, ordinal, client);
  return code;
};

export const generateInventoryCodeByFamilyId = async (
  familyId: string,
  entityType: InventoryEntityType,
  client: PoolClient
): Promise<number> => {
  const family = await lockInventoryCodeFamilyById(
    familyId,
    entityType,
    client
  );

  if (!family) {
    throw new ValidationError(
      "La familia de código seleccionada no existe, está inactiva o no corresponde al activo."
    );
  }

  let ordinal = family.ultimo_ordinal;
  let code: number;

  do {
    ordinal += 1;
    try {
      code = formatInventoryCodeForFamily(family, ordinal);
    } catch (error) {
      throw new ValidationError(
        error instanceof Error
          ? error.message
          : "No fue posible generar el código ITAM."
      );
    }
  } while (await inventoryCodeExists(code, client));

  await updateInventoryCodeOrdinal(family.id, ordinal, client);
  return code;
};
