export interface DepartamentoResumen {
  id: string;
  nombre: string;
}

export interface ColaboradorRow {
  id: string;
  rut: string;
  nombre: string;
  cargo: string | null;
  departamento_id: string | null;
  departamento_nombre: string | null;
  localidad: string | null;
  activo: boolean;
  observaciones: string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

export interface Colaborador {
  id: string;
  rut: string;
  nombre: string;
  cargo: string | null;
  departamento: DepartamentoResumen | null;
  localidad: string | null;
  activo: boolean;
  observaciones: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ColaboradorFilters {
  nombre?: string;
  rut?: string;
  departamentoId?: number;
  activo?: boolean;
}

export interface CrearColaboradorInput {
  rut: string;
  nombre: string;
  cargo?: string | null;
  departamentoId?: number | null;
  localidad?: string | null;
  activo?: boolean;
  observaciones?: string | null;
}

export interface ActualizarColaboradorInput {
  rut?: string;
  nombre?: string;
  cargo?: string | null;
  departamentoId?: number | null;
  localidad?: string | null;
  activo?: boolean;
  observaciones?: string | null;
}

export interface ActivoColaboradorRow {
  dispositivo_id:string;codigo_inventario:number;tipo_dispositivo:string;
  marca:string|null;modelo:string|null;numero_serie:string|null;imei:string|null;
  valor_comercial:string|number;estado_codigo:string;estado_nombre:string;
}

export interface HistorialActivoColaboradorRow extends ActivoColaboradorRow {
  fecha_asignacion:Date|string;fecha_devolucion:Date|string|null;
  tipo_cierre:string|null;resultado:string;
}

export type ClasificacionConciliada =
  | "ACTUAL_CONFIRMADO"
  | "ACTUAL_PROBABLE"
  | "HISTORICO_CONFIRMADO"
  | "HISTORICO_PROBABLE"
  | "PENDIENTE_VALIDACION"
  | "CONFLICTO_DATOS";

export interface InventarioConciliableRow extends ActivoColaboradorRow {
  fecha_asignacion: Date | string;
  fecha_salida: Date | string | null;
  evento_asignacion_id: string | null;
  vinculo_actual: boolean;
  colaborador_actual_id: string | null;
  tipo_cierre: string | null;
  tiene_devolucion: boolean;
  tiene_baja: boolean;
  identidad_duplicada: boolean;
}

export interface ActivoConciliado {
  dispositivoId: string;
  codigoItam: number;
  tipoDispositivo: string;
  marca: string | null;
  modelo: string | null;
  imei: string | null;
  numeroSerie: string | null;
  fechaAsignacion: string;
  fechaSalida: string | null;
  estadoOriginal: { codigo: string; nombre: string };
  clasificacionConciliada: ClasificacionConciliada;
  motivoConciliacion: string;
  requiereValidacionManual: boolean;
  valorComercial: number;
}

export interface InventarioConciliado {
  colaborador: Colaborador;
  actuales: ActivoConciliado[];
  historicos: ActivoConciliado[];
  pendientes: ActivoConciliado[];
  valorTotalActual: number;
}

export interface PendienteOffboardingRow {
  colaborador_id:string;rut:string;nombre:string;cargo:string|null;localidad:string|null;
  activo:boolean;observaciones:string|null;creado_en:Date|string;actualizado_en:Date|string;
  departamento_id:string|null;departamento_nombre:string|null;
  activos_pendientes:string|number;valor_pendiente:string|number;
}

export interface PendienteOffboarding {
  colaborador:Colaborador;activosPendientes:number;valorPendiente:number;estado:"PENDIENTE";
}
