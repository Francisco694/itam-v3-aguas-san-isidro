export type EstadoLineaMovil =
  | "ACTIVA"
  | "BLOQUEADA"
  | "SUSPENDIDA"
  | "DADA_BAJA"
  | "PENDIENTE_REPOSICION";

export type AccionLineaExtravio =
  | "CONSERVAR_BLOQUEAR"
  | "DAR_BAJA"
  | "PENDIENTE_CONFIRMAR"
  | "NO_APLICA";

export interface LineaMovilRow {
  id: string;
  numero_telefonico: string;
  estado: EstadoLineaMovil;
  colaborador_id: string | null;
  dispositivo_id: string | null;
  sim_id: string | null;
  observaciones: string | null;
  creado_en: Date | string;
  actualizado_en: Date | string;
}

export interface LineaMovilResumen {
  id: string;
  numeroTelefonico: string;
  estado: EstadoLineaMovil;
}

export interface LineaMovilLookupRow {
  linea_id: string;
  numero_telefonico: string;
  linea_estado: EstadoLineaMovil;
  sim_id: string | null;
  sim_codigo_inventario: number | null;
  sim_iccid: string | null;
  sim_compania: string | null;
  sim_estado_codigo: string | null;
  sim_estado_nombre: string | null;
  dispositivo_id: string | null;
  dispositivo_codigo_inventario: number | null;
  dispositivo_tipo: string | null;
  colaborador_id: string | null;
  colaborador_nombre: string | null;
  departamento_id: string | null;
  departamento_nombre: string | null;
}

export interface LineaMovilSimHistorialRow {
  id: string;
  linea_movil_id: string;
  sim_id: string;
  fecha_inicio: Date | string;
  fecha_fin: Date | string | null;
  motivo: string;
  usuario_id: string | null;
  sim_codigo_inventario: number;
  iccid_codigo_fabrica: string | null;
  numero_telefonico: string;
}

export interface LineaMovilSimHistorial {
  id: string;
  lineaMovilId: string;
  simId: string;
  codigoSim: number;
  iccid: string | null;
  numeroTelefonico: string;
  fechaInicio: string;
  fechaFin: string | null;
  motivo: string;
  usuarioId: string | null;
}
