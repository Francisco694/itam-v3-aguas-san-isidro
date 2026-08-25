export type ResultadoRecepcion = "DEVUELTO" | "DANADO";
export type OrigenDevolucion = "INVENTARIO" | "OFFBOARDING";

export interface CrearComprobanteInput {
  dispositivoId: string;
  actaEntregaDetalleId: string | null;
  colaboradorId: string | null;
  departamentoId: string | null;
  devueltoPorId: string | null;
  condicion?: string | null;
  resultado: ResultadoRecepcion;
  observaciones?: string | null;
  responsableTi: string;
  origen: OrigenDevolucion;
}

export interface ComprobanteDevolucionRow {
  id: string;
  numero_comprobante: string;
  dispositivo_id: string;
  codigo_inventario: number;
  tipo_dispositivo: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  imei: string | null;
  acta_entrega_detalle_id: string | null;
  acta_entrega_id: string | null;
  numero_acta: string | null;
  colaborador_id: string | null;
  colaborador_nombre: string | null;
  colaborador_rut: string | null;
  departamento_id: string | null;
  departamento_nombre: string | null;
  devuelto_por_id: string | null;
  devuelto_por_nombre: string | null;
  devuelto_por_rut: string | null;
  fecha: Date | string;
  condicion: string | null;
  resultado: ResultadoRecepcion;
  observaciones: string | null;
  responsable_ti: string;
  origen: OrigenDevolucion;
  creado_en: Date | string;
}

