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
