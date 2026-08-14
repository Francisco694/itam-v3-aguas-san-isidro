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

export interface DispositivoResumen {
  id: string;
  codigoInventario: number;
  tipoDispositivo: string;
  marca: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  imei: string | null;
  localidad: string | null;
  ubicacionDetalle: string | null;
  observaciones: string | null;
  fechaRegistro: string;
  creadoEn: string;
  actualizadoEn: string;
  estado: EstadoResumen;
  colaborador: ColaboradorResumen | null;
  departamento: DepartamentoResumen | null;
  recibidoPor: ColaboradorResumen | null;
  simAsociada: SimAsociadaResumen | null;
}

export interface DispositivoRow {
  dispositivo_id: string;
  dispositivo_codigo_inventario: number;
  tipo_dispositivo: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  imei: string | null;
  localidad: string | null;
  ubicacion_detalle: string | null;
  observaciones: string | null;
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
}

export interface DispositivoFilters {
  q?: string;
  tipo?: string;
  estado?: string;
  colaboradorId?: number;
  departamentoId?: number;
  localidad?: string;
}

export interface CrearDispositivoInput {
  codigoInventario: number;
  tipoDispositivo: string;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  imei?: string | null;
  localidad?: string | null;
  ubicacionDetalle?: string | null;
  observaciones?: string | null;
  responsable: string;
}

export interface ActualizarDispositivoInput {
  tipoDispositivo?: string;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  imei?: string | null;
  localidad?: string | null;
  ubicacionDetalle?: string | null;
  observaciones?: string | null;
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
}

export interface CambiarEstadoDispositivoInput {
  estadoId: number;
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
