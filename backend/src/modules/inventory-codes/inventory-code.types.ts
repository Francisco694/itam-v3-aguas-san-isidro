export type InventoryEntityType = "DISPOSITIVO" | "SIM";
export type InventoryCodeStrategy = "REPEAT_PREFIX";

export interface AssociatedDeviceType {
  id: string;
  nombre: string;
  activo: boolean;
}

export interface InventoryCodeFamilyRow {
  id: string;
  tipo_entidad: InventoryEntityType;
  tipo_activo_normalizado: string | null;
  nombre_familia: string;
  prefijo: string;
  ultimo_ordinal: number;
  activo: boolean;
  estrategia_codigo: InventoryCodeStrategy;
  version_esquema: number;
  creado_en: Date | string;
  actualizado_en: Date | string;
  tiene_codigos_emitidos: boolean;
  agrupa_tipos: boolean;
  etiqueta_operativa: string | null;
  tipos_asociados: AssociatedDeviceType[];
}

export interface InventoryCodeFamily {
  id: string;
  tipoEntidad: InventoryEntityType;
  tipoActivo: string | null;
  nombreFamilia: string;
  prefijo: string;
  activo: boolean;
  estrategiaCodigo: InventoryCodeStrategy;
  versionEsquema: number;
  ultimoOrdinal: number;
  proximoCodigoEstimado: number | null;
  tiposAsociados: AssociatedDeviceType[];
  creadoEn: string;
  actualizadoEn: string;
  tieneCodigosEmitidos: boolean;
  agrupaTipos: boolean;
  etiquetaOperativa: string | null;
}

export interface InventoryCodeFamilyFilters {
  activo?: boolean;
  tipoEntidad?: InventoryEntityType;
}

export interface CreateInventoryCodeFamilyInput {
  nombreFamilia: string;
  prefijo: string;
  estrategiaCodigo: InventoryCodeStrategy;
  activo?: boolean;
  tipoActivoNormalizado: string;
}

export interface UpdateInventoryCodeFamilyInput {
  nombreFamilia?: string;
  prefijo?: string;
  estrategiaCodigo?: InventoryCodeStrategy;
  activo?: boolean;
  tipoActivoNormalizado?: string;
}
