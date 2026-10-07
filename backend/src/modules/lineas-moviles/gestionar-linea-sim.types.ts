import type { EstadoLineaMovil } from "./lineas-moviles.types";

export type GestionarLineaSimOperacion =
  | "MANTENER_SIM_MANTENER_NUMERO"
  | "MANTENER_SIM_CAMBIAR_NUMERO"
  | "CAMBIAR_SIM_MANTENER_NUMERO"
  | "CAMBIAR_SIM_CAMBIAR_NUMERO";

export interface GestionarLineaSimInput {
  mantenerSim: boolean;
  mantenerNumero: boolean;
  simDestinoCodigo: number | null;
  numeroNuevo: string | null;
  responsable: string;
  observaciones?: string | null;
}

export interface GestionarLineaSimSnapshot {
  id: string;
  codigoInventario: number;
  iccid: string | null;
  estado: string;
  dispositivoId: string | null;
  lineaMovilId: string | null;
  colaboradorId: string | null;
}

export interface GestionarLineaSimResult {
  operacion: GestionarLineaSimOperacion;
  dispositivo: {
    id: string;
    codigoInventario: number;
  };
  linea: {
    id: string;
    numeroTelefonico: string;
    estado: EstadoLineaMovil;
    dispositivoId: string | null;
    simId: string | null;
  } | null;
  simAnterior: GestionarLineaSimSnapshot | null;
  simActual: GestionarLineaSimSnapshot | null;
  numeroAnterior: string | null;
  numeroNuevo: string | null;
}
