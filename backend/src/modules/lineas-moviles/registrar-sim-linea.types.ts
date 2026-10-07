import type { EstadoLineaMovil } from "./lineas-moviles.types";

export type RegistrarSimNuevaAccionLinea = "USAR_LINEA_EXISTENTE" | "CREAR_LINEA_NUEVA" | "SIN_LINEA";

export interface RegistrarSimNuevaInput {
  iccidCodigoFabrica: string;
  compania?: string | null;
  observaciones?: string | null;
  accionLinea: RegistrarSimNuevaAccionLinea;
  lineaMovilId?: number | null;
  numeroNuevo?: string | null;
  responsable: string;
}

export interface RegistrarSimNuevaResult {
  operacion: "REGISTRAR_SIM_NUEVA";
  sim: {
    id: string;
    codigoInventario: number;
    iccid: string | null;
    estado: string;
    dispositivoId: string | null;
    colaboradorId: string | null;
    lineaMovilId: string | null;
  };
  linea: { id: string; numeroTelefonico: string; estado: EstadoLineaMovil } | null;
  dispositivo: { id: string; codigoInventario: number };
}
