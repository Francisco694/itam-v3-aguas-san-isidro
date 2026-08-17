export type TipoEntidad = 'DISPOSITIVO' | 'SIM';
export interface EstadoResumen { id: string; codigo: string; nombre: string; }
export interface DepartamentoResumen { id: string; nombre: string; }
export interface ColaboradorResumen { id: string; rut: string; nombre: string; cargo: string | null; localidad?: string | null; departamento?: DepartamentoResumen | null; }
export type InventoryCodeStrategy = 'REPEAT_PREFIX';
export interface AssociatedDeviceType { id: string; nombre: string; activo: boolean; }
export interface InventoryCodeFamily {
  id: string; tipoEntidad: TipoEntidad; tipoActivo: string | null; nombreFamilia: string;
  prefijo: string; activo: boolean; estrategiaCodigo: InventoryCodeStrategy; versionEsquema: number;
  ultimoOrdinal: number; proximoCodigoEstimado: number | null; tiposAsociados: AssociatedDeviceType[];
  creadoEn: string; actualizadoEn: string; tieneCodigosEmitidos: boolean;
  agrupaTipos: boolean; etiquetaOperativa: string | null;
}
export interface InventoryCodeFamilyInput { nombreFamilia: string; prefijo: string; estrategiaCodigo: InventoryCodeStrategy; activo?: boolean; }
export interface PrefixSuggestion { prefijo: string | null; disponible: boolean; mensaje: string; }
export type TipoCampoFormulario = 'text' | 'select' | 'number';
export interface CampoEspecificoFormulario { clave: string; etiqueta: string; tipo: TipoCampoFormulario; requerido: boolean; maxLength?: number; min?: number; max?: number; opciones?: string[]; }
export interface ConfiguracionFormularioTipo { mostrarMarca: boolean; mostrarModelo: boolean; mostrarNumeroSerie: boolean; camposEspecificos: CampoEspecificoFormulario[]; }
export interface FamiliaCodigoTipoDispositivo { id: string; nombre: string; prefijo: string; activo: boolean; estrategiaCodigo: InventoryCodeStrategy; agrupaTipos: boolean; etiquetaOperativa: string | null; }
export interface TipoDispositivo { id: string; nombre: string; descripcion: string | null; activo: boolean; requiereImei: boolean; configuracionFormulario: ConfiguracionFormularioTipo; familiaCodigoInventario: FamiliaCodigoTipoDispositivo | null; creadoEn: string; actualizadoEn: string; }
export interface TipoDispositivoInput { nombre: string; descripcion?: string | null; familiaCodigoInventarioId?: number | null; activo?: boolean; requiereImei?: boolean; }

export interface Estado extends EstadoResumen { tipoEntidad: TipoEntidad; descripcion: string | null; esTerminal: boolean; activo: boolean; creadoEn: string; }
export interface Departamento { id: string; nombre: string; activo: boolean; observaciones: string | null; creadoEn: string; actualizadoEn: string; }
export interface DepartamentoInput { nombre: string; activo?: boolean; observaciones?: string | null; }

export interface Colaborador {
  id: string; rut: string; nombre: string; cargo: string | null; departamento: DepartamentoResumen | null;
  localidad: string | null; activo: boolean; observaciones: string | null; creadoEn: string; actualizadoEn: string;
}
export interface ColaboradorFilters { nombre?: string; rut?: string; departamentoId?: number; activo?: boolean; }
export interface ColaboradorInput { rut: string; nombre: string; cargo?: string | null; departamentoId?: number | null; localidad?: string | null; activo?: boolean; observaciones?: string | null; }

export interface SimAsociadaResumen { id: string; codigoInventario: number; iccidCodigoFabrica: string; numeroAsociado: string | null; compania: string | null; estado: EstadoResumen | null; }
export interface Dispositivo {
  id: string; codigoInventario: number; tipoDispositivo: string; marca: string | null; modelo: string | null;
  tipo: TipoDispositivo;
  numeroSerie: string | null; imei: string | null; localidad: string | null; ubicacionDetalle: string | null;
  observaciones: string | null; fechaRegistro: string; creadoEn: string; actualizadoEn: string; estado: EstadoResumen;
  atributosEspecificos: Record<string, string | number | null>;
  colaborador: ColaboradorResumen | null; departamento: DepartamentoResumen | null; recibidoPor: ColaboradorResumen | null; simAsociada: SimAsociadaResumen | null; tipoCustodia: 'NONE'|'COLABORADOR'|'DEPARTAMENTO';
}
export interface DispositivoFilters { q?: string; tipo?: string; tipoDispositivoId?: number; familiaCodigoInventarioId?: number; estado?: string; colaboradorId?: number; departamentoId?: number; localidad?: string; }
export interface DispositivoInput { codigoInventario?: number; tipoDispositivoId: number; marca?: string | null; modelo?: string | null; numeroSerie?: string | null; imei?: string | null; localidad?: string | null; ubicacionDetalle?: string | null; observaciones?: string | null; atributosEspecificos?: Record<string, string | number | null>; responsable?: string; }
export interface ResponsableInput { responsable: string; observaciones?: string | null; }
export interface AsignarDispositivoColaboradorInput extends ResponsableInput { colaboradorId: number; }
export interface AsignarDispositivoDepartamentoInput extends ResponsableInput { departamentoId: number; localidad?: string | null; ubicacionDetalle?: string | null; }
export interface CambiarEstadoInput extends ResponsableInput { estadoId: number; }

export interface SimDispositivoResumen { id: string; codigoInventario: number; tipoDispositivo: string; marca: string | null; modelo: string | null; estado: EstadoResumen | null; }
export interface Sim {
  id: string; codigoInventario: number; iccidCodigoFabrica: string; numeroAsociado: string | null; compania: string | null;
  estado: EstadoResumen; colaborador: ColaboradorResumen | null; dispositivo: SimDispositivoResumen | null;
  observaciones: string | null; fechaRegistro: string; creadoEn: string; actualizadoEn: string;
}
export interface SimInput { codigoInventario?: number; iccidCodigoFabrica: string; numeroAsociado?: string | null; compania?: string | null; observaciones?: string | null; responsable?: string; }
export interface AsociarDispositivoInput extends ResponsableInput { dispositivoCodigoInventario: number; }
export interface AsignarSimColaboradorInput extends ResponsableInput { colaboradorId: number; }

export interface HistorialEvento {
  id: string; tipoEntidad: TipoEntidad; dispositivoId?: string; simId?: string; tipoEvento: string;
  estadoAnterior: EstadoResumen | null; estadoNuevo: EstadoResumen | null; responsable: string;
  observaciones: string | null; detalle: Record<string, unknown>; fechaEvento: string;
}

export interface InventarioDepartamento { departamento: Departamento; resumen: { custodiaDirecta: number; conColaboradores: number; totalRelacionado: number }; custodiaDirecta: Dispositivo[]; activosColaboradores: Dispositivo[]; }
