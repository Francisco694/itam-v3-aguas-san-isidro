export type EstadoOrdenServicio =
  | "PENDIENTE_DIAGNOSTICO" | "COTIZACION_RECIBIDA"
  | "REPARACION_APROBADA" | "REPARACION_RECHAZADA"
  | "EN_REPARACION" | "REPARACION_TERMINADA" | "CERRADA" | "BAJA";

export interface OrdenServicioRow {
  id:string; numero_ot:string|number; dispositivo_id:string; codigo_inventario:number;
  tipo_dispositivo:string; marca:string|null; modelo:string|null;
  numero_serie:string|null;imei:string|null;observaciones_envio:string|null;
  area_solicitante:string|null; contacto_servicio:string|null;
  ticket_proveedor:string|null; observaciones_cotizacion:string|null;
  tipo_servicio:"GARANTIA"|"REPARACION"|"MANTENCION"|"DIAGNOSTICO";
  accesorios_entregados:string|null;plazo_informado:string|null;
  valor_comercial:string|number; proveedor:string|null;
  fecha_envio:Date|string; falla_reportada:string; diagnostico:string|null;
  descripcion_reparacion:string|null; monto_cotizacion:string|number|null;
  decision:string|null; motivo_decision:string|null;
  observacion_decision:string|null; fecha_decision:Date|string|null;
  responsable_decision:string|null; costo_final:string|number|null;
  fecha_retorno:Date|string|null; resultado:string|null;
  estado_final:"OPERATIVO"|"SIN_REPARACION"|"BAJA"|null; observaciones_retorno:string|null;
  cotizacion_archivo_id:string|null; cotizacion_archivo_proveedor:string|null;
  cotizacion_archivo_nombre_original:string|null; cotizacion_archivo_mime_type:CotizacionArchivoMime|null;
  cotizacion_archivo_tamanio_bytes:string|number|null; cotizacion_archivo_version:number|null;
  cotizacion_archivo_activo:boolean|null; cotizacion_archivo_subido_por:string|null;
  cotizacion_archivo_creado_en:Date|string|null;
  estado:EstadoOrdenServicio; responsable_envio:string;
  creado_en:Date|string; actualizado_en:Date|string;
  reparaciones_anteriores:string|number; costo_acumulado:string|number;
  custodio_tipo_al_ingreso:"COLABORADOR"|"DEPARTAMENTO"|null;
  colaborador_id_al_ingreso:string|null;colaborador_nombre_al_ingreso:string|null;
  colaborador_rut_al_ingreso:string|null;departamento_id_al_ingreso:string|null;
  departamento_nombre_al_ingreso:string|null;recibido_por_id_al_ingreso:string|null;
  recibido_por_nombre_al_ingreso:string|null;
}

export interface EntregaTemporalRow {
  id:string;orden_servicio_id:string;dispositivo_temporal_id:string;
  codigo_inventario:number;tipo_dispositivo:string;marca:string|null;modelo:string|null;
  colaborador_id:string;colaborador_nombre:string;colaborador_rut:string;
  fecha_entrega:Date|string;responsable_entrega:string;observaciones_entrega:string|null;
  fecha_devolucion:Date|string|null;responsable_devolucion:string|null;
  observaciones_devolucion:string|null;estado:"ABIERTA"|"CERRADA"|"CANCELADA";
}

export interface CrearOrdenServicioInput {
  dispositivoCodigo:number; proveedor?:string|null;
  fechaEnvio?:string|null;
  areaSolicitante?:string|null; contactoServicio?:string|null;
  tipoServicio:"GARANTIA"|"REPARACION"|"MANTENCION"|"DIAGNOSTICO";
  fallaReportada:string; accesoriosEntregados?:string|null; observaciones?:string|null; responsable:string;
}
export interface EditarOrdenServicioInput {
  proveedor?:string|null; fechaEnvio?:string|null; areaSolicitante?:string|null;
  contactoServicio?:string|null;
  tipoServicio:"GARANTIA"|"REPARACION"|"MANTENCION"|"DIAGNOSTICO";
  fallaReportada:string; accesoriosEntregados?:string|null; observaciones?:string|null;
  responsable:string;
}
export interface CotizacionInput {
  diagnostico:string; descripcionReparacion:string;
  montoCotizacion:number; plazoInformado?:string|null; proveedor?:string|null;
  ticketProveedor?:string|null; observacionesCotizacion?:string|null; responsable:string;
}
export type CotizacionArchivoMime = "application/pdf"|"image/jpeg"|"image/png"|"application/msword"|"application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export interface CotizacionArchivoAlmacenado {nombreOriginal:string;nombreArchivo:string;mimeType:CotizacionArchivoMime;tamanioBytes:number;rutaArchivo:string;}
export interface CotizacionArchivo {id:string;ordenServicioTecnicoId:string;dispositivoId:string;proveedor:string|null;nombreOriginal:string;mimeType:CotizacionArchivoMime;tamanioBytes:number;version:number;activo:boolean;subidoPor:string;creadoEn:string;}
export interface CotizacionArchivoRow {id:string;orden_servicio_tecnico_id:string;dispositivo_id:string;proveedor:string|null;nombre_original:string;nombre_archivo:string;mime_type:CotizacionArchivoMime;tamanio_bytes:string|number;ruta_archivo:string;version:number;activo:boolean;subido_por:string;creado_en:Date|string;}
export interface DecisionServicioInput {
  decision:"APROBAR"|"RECHAZAR"|"DAR_BAJA";
  motivo?:string|null; observaciones?:string|null; responsable:string;
}
export interface CerrarOrdenInput {
  costoFinal:number; fechaRetorno?:string|null; resultado:string;
  estadoFinal:"OPERATIVO"|"SIN_REPARACION"|"BAJA";
  observacionesRetorno?:string|null; responsable:string;
}
export interface EntregarTemporalInput {dispositivoCodigo:number;responsable:string;observaciones?:string|null;}
export interface CerrarTemporalInput {responsable:string;observaciones?:string|null;}
