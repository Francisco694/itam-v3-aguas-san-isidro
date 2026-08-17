export interface FamiliaCodigoTipoDispositivo {
  id: string;
  nombre: string;
  prefijo: string;
  activo: boolean;
  estrategiaCodigo: "REPEAT_PREFIX";
  agrupaTipos: boolean;
  etiquetaOperativa: string | null;
}

export type TipoCampoFormulario = "text" | "select" | "number";

export interface CampoEspecificoFormulario {
  clave: string;
  etiqueta: string;
  tipo: TipoCampoFormulario;
  requerido: boolean;
  maxLength?: number;
  min?: number;
  max?: number;
  opciones?: string[];
}

export interface ConfiguracionFormularioTipo {
  mostrarMarca: boolean;
  mostrarModelo: boolean;
  mostrarNumeroSerie: boolean;
  camposEspecificos: CampoEspecificoFormulario[];
}

export interface TipoDispositivo {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  requiereImei: boolean;
  configuracionFormulario: ConfiguracionFormularioTipo;
  familiaCodigoInventario: FamiliaCodigoTipoDispositivo | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface TipoDispositivoRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  requiere_imei: boolean;
  configuracion_formulario: ConfiguracionFormularioTipo;
  familia_codigo_inventario_id: string | null;
  familia_nombre: string | null;
  familia_prefijo: string | null;
  familia_activa: boolean | null;
  familia_estrategia: "REPEAT_PREFIX" | null;
  familia_agrupa_tipos: boolean | null;
  familia_etiqueta_operativa: string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

export interface TipoDispositivoFilters {
  activo?: boolean;
}

export interface CrearTipoDispositivoInput {
  nombre: string;
  descripcion?: string | null;
  familiaCodigoInventarioId?: number | null;
  activo?: boolean;
  requiereImei?: boolean;
}

export interface ActualizarTipoDispositivoInput {
  nombre?: string;
  descripcion?: string | null;
  familiaCodigoInventarioId?: number | null;
  activo?: boolean;
  requiereImei?: boolean;
}

export interface FamiliaDispositivoRow {
  id: string;
  tipo_entidad: string;
  nombre_familia: string;
  prefijo: string;
  activo: boolean;
  estrategia_codigo: "REPEAT_PREFIX";
  agrupa_tipos: boolean;
  etiqueta_operativa: string | null;
}
