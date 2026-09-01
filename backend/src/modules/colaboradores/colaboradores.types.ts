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

export interface EvidenciaHistoricaPendienteRow {
  id:string;tipo_activo:string|null;descripcion_original:string|null;
  imei_original:string|null;serie_original:string|null;fecha_entrega:Date|string|null;
  estado_conciliacion:string;motivo_conflicto:string|null;nivel_confianza:string;
  fuente:string;hoja:string;fila_origen:number;
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
