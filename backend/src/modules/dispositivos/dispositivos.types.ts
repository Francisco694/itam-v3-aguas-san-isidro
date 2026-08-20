export interface EstadoResumen {
  id: string;
  codigo: string;
  nombre: string;
}

export interface ColaboradorResumen {
  id: string;
  rut: string;
  nombre: string;
  cargo: string | null;
  localidad: string | null;
  departamento: DepartamentoResumen | null;
}

export interface DepartamentoResumen {
  id: string;
  nombre: string;
}

export interface SimAsociadaResumen {
  id: string;
  codigoInventario: number;
  iccidCodigoFabrica: string;
  numeroAsociado: string | null;
  compania: string | null;
  estado: EstadoResumen | null;
}

export interface TipoDispositivoResumen {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  requiereImei: boolean;
  configuracionFormulario: import("../tipos-dispositivo/tipos-dispositivo.types").ConfiguracionFormularioTipo;
  familiaCodigoInventario: {
    id: string;
    nombre: string;
    prefijo: string;
    activo: boolean;
    estrategiaCodigo: "REPEAT_PREFIX";
    agrupaTipos: boolean;
    etiquetaOperativa: string | null;
  } | null;
}

export interface DispositivoResumen {
  id: string;
  codigoInventario: number;
  tipoDispositivo: string;
  tipo: TipoDispositivoResumen;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  imei: string | null;
  localidad: string | null;
  ubicacionDetalle: string | null;
  observaciones: string | null;
  atributosEspecificos: Record<string, string | number | null>;
  valorComercial: number;
  fechaRegistro: string;
  creadoEn: string;
  actualizadoEn: string;
  estado: EstadoResumen;
  colaborador: ColaboradorResumen | null;
  departamento: DepartamentoResumen | null;
  recibidoPor: ColaboradorResumen | null;
  simAsociada: SimAsociadaResumen | null;
  tipoCustodia: "NONE" | "COLABORADOR" | "DEPARTAMENTO";
  ultimoResultadoOffboarding: ResultadoOffboarding | null;
}

export interface DispositivoRow {
  dispositivo_id: string;
  dispositivo_codigo_inventario: number;
  tipo_dispositivo: string;
  tipo_dispositivo_id: string;
  tipo_dispositivo_nombre: string;
  tipo_dispositivo_descripcion: string | null;
  tipo_dispositivo_activo: boolean;
  tipo_dispositivo_requiere_imei: boolean;
  tipo_dispositivo_configuracion_formulario: import("../tipos-dispositivo/tipos-dispositivo.types").ConfiguracionFormularioTipo;
  tipo_familia_id: string | null;
  tipo_familia_nombre: string | null;
  tipo_familia_prefijo: string | null;
  tipo_familia_activa: boolean | null;
  tipo_familia_estrategia: "REPEAT_PREFIX" | null;
  tipo_familia_agrupa_tipos: boolean | null;
  tipo_familia_etiqueta_operativa: string | null;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  imei: string | null;
  localidad: string | null;
  ubicacion_detalle: string | null;
  observaciones: string | null;
  atributos_especificos: Record<string, string | number | null>;
  valor_comercial: string | number;
  fecha_registro: Date | string;
  creado_en: Date | string;
  actualizado_en: Date | string;
  estado_id: string;
  estado_codigo: string;
  estado_nombre: string;
  colaborador_id: string | null;
  colaborador_rut: string | null;
  colaborador_nombre: string | null;
  colaborador_cargo: string | null;
  colaborador_localidad: string | null;
  colaborador_departamento_id: string | null;
  colaborador_departamento_nombre: string | null;
  departamento_id: string | null;
  departamento_nombre: string | null;
  recibido_por_id: string | null;
  recibido_por_rut: string | null;
  recibido_por_nombre: string | null;
  recibido_por_cargo: string | null;
  recibido_por_localidad: string | null;
  sim_id: string | null;
  sim_codigo_inventario: number | null;
  iccid_codigo_fabrica: string | null;
  numero_asociado: string | null;
  compania: string | null;
  sim_estado_id: string | null;
  sim_estado_codigo: string | null;
  sim_estado_nombre: string | null;
  ultimo_resultado_offboarding: ResultadoOffboarding | null;
}

export interface DispositivoFilters {
  q?: string;
  tipo?: string;
  tipoDispositivoId?: number;
  familiaCodigoInventarioId?: number;
  estado?: string;
  colaboradorId?: number;
  departamentoId?: number;
  departamentoColaboradorId?: number;
  localidad?: string;
}

export interface CrearDispositivoInput {
  tipoDispositivoId: number;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  imei?: string | null;
  localidad?: string | null;
  ubicacionDetalle?: string | null;
  observaciones?: string | null;
  atributosEspecificos?: Record<string, string | number | null>;
  valorComercial?: number;
  responsable: string;
}

export interface ActualizarDispositivoInput {
  tipoDispositivoId?: number;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  imei?: string | null;
  localidad?: string | null;
  ubicacionDetalle?: string | null;
  observaciones?: string | null;
  atributosEspecificos?: Record<string, string | number | null>;
  valorComercial?: number;
}

export interface ResumenGerencialRow {
  total_cantidad: string | number;
  total_valor: string | number;
  disponibles_cantidad: string | number;
  disponibles_valor: string | number;
  asignados_cantidad: string | number;
  asignados_valor: string | number;
  extraviados_cantidad: string | number;
  extraviados_valor: string | number;
  bajas_cantidad: string | number;
  bajas_valor: string | number;
}

export interface ResumenGerencial {
  inventario: { cantidad: number; valor: number };
  disponibles: { cantidad: number; valor: number };
  asignados: { cantidad: number; valor: number };
  extraviados: { cantidad: number; valor: number };
  bajas: { cantidad: number; valor: number };
}

export interface AsignarColaboradorInput {
  colaboradorId: number;
  responsable: string;
  observaciones?: string | null;
}

export interface AsignarDepartamentoInput {
  departamentoId: number;
  recibidoPorId: number;
  localidad?: string | null;
  ubicacionDetalle?: string | null;
  responsable: string;
  observaciones?: string | null;
}

export interface DevolverDispositivoInput {
  responsable: string;
  observaciones?: string | null;
  condicion?: string | null;
  resultado?: "DEVUELTO" | "DANADO";
}

export type ResultadoOffboarding =
  | "DEVUELTO"
  | "PENDIENTE"
  | "NO_ENTREGADO"
  | "EXTRAVIADO"
  | "ROBADO_HURTADO"
  | "DANADO";

export interface RegistrarResultadoOffboardingInput {
  resultado: ResultadoOffboarding;
  responsable: string;
  condicion?: string | null;
  observaciones?: string | null;
}

export interface CambiarEstadoDispositivoInput {
  estadoId: number;
  responsable: string;
  observaciones?: string | null;
}

export type MotivoBaja =
  | "IRREPARABLE"
  | "REPARACION_NO_CONVENIENTE"
  | "MULTIPLES_REPARACIONES"
  | "OBSOLESCENCIA"
  | "DANO_FISICO"
  | "SIN_REPUESTOS"
  | "OTRO";

export interface DarBajaDispositivoInput {
  motivo: MotivoBaja;
  responsable: string;
  observaciones?: string | null;
}

export interface EstadoRow {
  id: string;
  codigo: string;
  nombre: string;
}

export interface HistorialDispositivoRow {
  id: string;
  tipo_entidad: "DISPOSITIVO";
  dispositivo_id: string;
  tipo_evento: string;
  estado_anterior_id: string | null;
  estado_anterior_codigo: string | null;
  estado_anterior_nombre: string | null;
  estado_nuevo_id: string | null;
  estado_nuevo_codigo: string | null;
  estado_nuevo_nombre: string | null;
  responsable: string;
  observaciones: string | null;
  detalle: Record<string, unknown>;
  fecha_evento: Date | string;
}

export interface HistorialDispositivo {
  id: string;
  tipoEntidad: "DISPOSITIVO";
  dispositivoId: string;
  tipoEvento: string;
  estadoAnterior: EstadoResumen | null;
  estadoNuevo: EstadoResumen | null;
  responsable: string;
  observaciones: string | null;
  detalle: Record<string, unknown>;
  fechaEvento: string;
}
