import type { EstadoResumen } from "../dispositivos/dispositivos.types";

export interface ColaboradorResumen {
  id: string;
  rut: string;
  nombre: string;
  cargo: string | null;
}

export interface DispositivoResumen {
  id: string;
  codigoInventario: number;
  tipoDispositivo: string;
  marca: string | null;
  modelo: string | null;
  estado: EstadoResumen | null;
}

export interface SimRow {
  sim_id: string;
  sim_codigo_inventario: number;
  iccid_codigo_fabrica: string | null;
  numero_asociado: string | null;
  compania: string | null;
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
  dispositivo_id: string | null;
  dispositivo_codigo_inventario: number | null;
  tipo_dispositivo: string | null;
  dispositivo_marca: string | null;
  dispositivo_modelo: string | null;
  dispositivo_estado_id: string | null;
  dispositivo_estado_codigo: string | null;
  dispositivo_estado_nombre: string | null;
}

export interface SimResumen {
  id: string;
  codigoInventario: number;
  iccidCodigoFabrica: string | null;
  numeroAsociado: string | null;
  compania: string | null;
  estado: EstadoResumen;
  colaborador: ColaboradorResumen | null;
  dispositivo: DispositivoResumen | null;
  observaciones: string | null;
  fechaRegistro: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearSimInput {
  iccidCodigoFabrica: string;
  numeroAsociado?: string | null;
  compania?: string | null;
  observaciones?: string | null;
  responsable: string;
}

export interface ActualizarSimInput {
  iccidCodigoFabrica?: string;
  numeroAsociado?: string | null;
  compania?: string | null;
  observaciones?: string | null;
}

export interface AsociarDispositivoInput {
  dispositivoCodigoInventario: number;
  responsable: string;
  observaciones?: string | null;
}

export interface ResponsableInput {
  responsable: string;
  observaciones?: string | null;
}

export interface AsignarColaboradorSimInput {
  colaboradorId: number;
  responsable: string;
  observaciones?: string | null;
}

export interface CambiarEstadoSimInput {
  estadoId: number;
  responsable: string;
  observaciones?: string | null;
}

export interface EstadoSimRow {
  id: string;
  codigo: string;
  nombre: string;
}

export interface HistorialSimRow {
  id: string;
  tipo_entidad: "SIM";
  sim_id: string;
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

export interface HistorialSim {
  id: string;
  tipoEntidad: "SIM";
  simId: string;
  tipoEvento: string;
  estadoAnterior: EstadoResumen | null;
  estadoNuevo: EstadoResumen | null;
  responsable: string;
  observaciones: string | null;
  detalle: Record<string, unknown>;
  fechaEvento: string;
}
