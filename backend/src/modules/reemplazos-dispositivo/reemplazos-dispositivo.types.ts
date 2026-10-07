import type { MotivoBaja } from "../dispositivos/dispositivos.types";

export type EstadoReemplazo = "PENDIENTE_DEVOLUCION" | "COMPLETADO" | "CANCELADO";
export type DestinoDispositivoAnterior = "DISPONIBLE" | "RETENIDO_REVISION" | "DADO_BAJA";
export type AccionSimReemplazo = "MOVER_SIM_ACTUAL" | "USAR_SIM_EXISTENTE" | "REGISTRAR_SIM_NUEVA" | "SIN_SIM";
export type LineaSimNuevaReemplazo = "CONSERVAR_NUMERO" | "NUMERO_NUEVO" | "SIN_LINEA";

export interface RegistrarSimNuevaReemplazoInput {
  iccidCodigoFabrica: string;
  compania?: string | null;
  observaciones?: string | null;
  linea: LineaSimNuevaReemplazo;
  numeroTelefonico?: string | null;
}

export interface CrearReemplazoInput {
  colaboradorId: number;
  dispositivoAnteriorCodigo: number;
  dispositivoNuevoCodigo: number;
  entregaAnterior: boolean;
  destinoDispositivoAnterior?: DestinoDispositivoAnterior;
  motivoBaja?: MotivoBaja;
  condicion?: string | null;
  resultado?: "DEVUELTO" | "DANADO";
  accionSim?: AccionSimReemplazo;
  simDestinoCodigo?: number;
  conservarNumero?: boolean;
  simNueva?: RegistrarSimNuevaReemplazoInput;
  observaciones?: string | null;
  responsable: string;
}

export interface RecibirReemplazoInput {
  destinoDispositivoAnterior: DestinoDispositivoAnterior;
  simEntregada?: boolean;
  motivoBaja?: MotivoBaja;
  condicion?: string | null;
  resultado?: "DEVUELTO" | "DANADO";
  observaciones?: string | null;
  responsable: string;
}

export interface ReemplazoDispositivoRow {
  id: string;
  colaborador_id: string;
  colaborador_nombre: string;
  colaborador_rut: string;
  dispositivo_anterior_id: string;
  dispositivo_anterior_codigo: number;
  dispositivo_anterior_tipo: string;
  dispositivo_anterior_marca: string | null;
  dispositivo_anterior_modelo: string | null;
  dispositivo_anterior_estado_codigo: string;
  dispositivo_anterior_estado_nombre: string;
  dispositivo_nuevo_id: string;
  dispositivo_nuevo_codigo: number;
  dispositivo_nuevo_tipo: string;
  dispositivo_nuevo_marca: string | null;
  dispositivo_nuevo_modelo: string | null;
  dispositivo_nuevo_estado_codigo: string;
  dispositivo_nuevo_estado_nombre: string;
  estado_operacion: EstadoReemplazo;
  fecha_inicio: Date | string;
  fecha_recepcion_anterior: Date | string | null;
  fecha_cierre: Date | string | null;
  usuario_inicio_id: string;
  usuario_inicio_nombre: string | null;
  usuario_cierre_id: string | null;
  usuario_cierre_nombre: string | null;
  comprobante_devolucion_id: string | null;
  destino_dispositivo_anterior: DestinoDispositivoAnterior | null;
  observacion: string | null;
  motivo_cancelacion: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface ReemplazoDispositivo {
  id: string;
  estadoOperacion: EstadoReemplazo;
  fechaInicio: string;
  fechaRecepcionAnterior: string | null;
  fechaCierre: string | null;
  observacion: string | null;
  motivoCancelacion: string | null;
  destinoDispositivoAnterior: DestinoDispositivoAnterior | null;
  colaborador: { id: string; nombre: string; rut: string };
  dispositivoAnterior: {
    id: string;
    codigoInventario: number;
    tipo: string;
    marca: string | null;
    modelo: string | null;
    estado: { codigo: string; nombre: string };
  };
  dispositivoNuevo: {
    id: string;
    codigoInventario: number;
    tipo: string;
    marca: string | null;
    modelo: string | null;
    estado: { codigo: string; nombre: string };
  };
  usuarioInicio: { id: string; nombre: string } | null;
  usuarioCierre: { id: string; nombre: string } | null;
  comprobanteDevolucionId: string | null;
  comprobante?: { id: string; numeroComprobante: string; fecha: string; resultado: "DEVUELTO" | "DANADO" };
}
