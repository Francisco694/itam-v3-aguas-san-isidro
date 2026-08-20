export type EstadoOrdenServicio =
  | "PENDIENTE_DIAGNOSTICO" | "COTIZACION_RECIBIDA"
  | "REPARACION_APROBADA" | "REPARACION_RECHAZADA"
  | "EN_REPARACION" | "REPARACION_TERMINADA" | "CERRADA" | "BAJA";

export interface OrdenServicioRow {
  id:string; dispositivo_id:string; codigo_inventario:number;
  tipo_dispositivo:string; marca:string|null; modelo:string|null;
  valor_comercial:string|number; proveedor:string|null;
  fecha_envio:Date|string; falla_reportada:string; diagnostico:string|null;
  descripcion_reparacion:string|null; monto_cotizacion:string|number|null;
  decision:string|null; motivo_decision:string|null;
  observacion_decision:string|null; fecha_decision:Date|string|null;
  responsable_decision:string|null; costo_final:string|number|null;
  fecha_retorno:Date|string|null; resultado:string|null;
  estado:EstadoOrdenServicio; responsable_envio:string;
  creado_en:Date|string; actualizado_en:Date|string;
  reparaciones_anteriores:string|number; costo_acumulado:string|number;
}

export interface CrearOrdenServicioInput {
  dispositivoCodigo:number; proveedor?:string|null;
  fallaReportada:string; responsable:string;
}
export interface CotizacionInput {
  diagnostico:string; descripcionReparacion:string;
  montoCotizacion:number; proveedor?:string|null; responsable:string;
}
export interface DecisionServicioInput {
  decision:"APROBAR"|"RECHAZAR"|"DAR_BAJA";
  motivo?:string|null; observaciones?:string|null; responsable:string;
}
export interface CerrarOrdenInput {
  costoFinal:number; fechaRetorno?:string|null; resultado:string; responsable:string;
}
