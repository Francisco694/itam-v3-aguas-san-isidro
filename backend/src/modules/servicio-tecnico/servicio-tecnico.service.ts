import { pool } from "../../config/database";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "../../shared/errors";
import { toIsoDateTime } from "../../shared/dates";
import { cambiarEstadoDispositivo, insertarHistorialDispositivo, obtenerDispositivoPorCodigo, obtenerEstadoDispositivoPorCodigo, registrarBajaDispositivo } from "../dispositivos/dispositivos.repository";
import { listarOrdenes, obtenerOrden, obtenerOrdenAbiertaPorDispositivo } from "./servicio-tecnico.repository";
import type { CerrarOrdenInput, CotizacionInput, CrearOrdenServicioInput, DecisionServicioInput, OrdenServicioRow } from "./servicio-tecnico.types";

const mapOrden=(r:OrdenServicioRow)=>({
  id:r.id,dispositivo:{id:r.dispositivo_id,codigoInventario:r.codigo_inventario,
    tipo:r.tipo_dispositivo,marca:r.marca,modelo:r.modelo,valorComercial:Number(r.valor_comercial)},
  proveedor:r.proveedor,fechaEnvio:toIsoDateTime(r.fecha_envio),fallaReportada:r.falla_reportada,
  diagnostico:r.diagnostico,descripcionReparacion:r.descripcion_reparacion,
  montoCotizacion:r.monto_cotizacion===null?null:Number(r.monto_cotizacion),decision:r.decision,
  motivoDecision:r.motivo_decision,observacionDecision:r.observacion_decision,
  fechaDecision:r.fecha_decision?toIsoDateTime(r.fecha_decision):null,
  responsableDecision:r.responsable_decision,costoFinal:r.costo_final===null?null:Number(r.costo_final),
  fechaRetorno:r.fecha_retorno?toIsoDateTime(r.fecha_retorno):null,resultado:r.resultado,
  estado:r.estado,responsableEnvio:r.responsable_envio,
  reparacionesAnteriores:Number(r.reparaciones_anteriores),costoAcumulado:Number(r.costo_acumulado),
  creadoEn:toIsoDateTime(r.creado_en),actualizadoEn:toIsoDateTime(r.actualizado_en)
});

export const obtenerOrdenesServicio=async()=> (await listarOrdenes()).map(mapOrden);
export const obtenerOrdenServicio=async(id:number)=>{const row=await obtenerOrden(id);if(!row)throw new NotFoundError("Orden de servicio no encontrada.");return mapOrden(row)};

export const crearOrdenServicio=async(input:CrearOrdenServicioInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");
  const device=await obtenerDispositivoPorCodigo(input.dispositivoCodigo,client);
  if(!device)throw new NotFoundError("Dispositivo no encontrado.");
  if(await obtenerOrdenAbiertaPorDispositivo(device.dispositivo_id,client))throw new ConflictError("El dispositivo ya tiene una orden de servicio abierta.");
  const state=await obtenerEstadoDispositivoPorCodigo("SERVICIO_TECNICO",client);
  if(!state)throw new ConflictError("No existe el estado SERVICIO_TECNICO.");
  const inserted=await client.query<{id:string}>(`INSERT INTO itam.ordenes_servicio_tecnico(
    dispositivo_id,proveedor,falla_reportada,responsable_envio)
    VALUES($1,$2,$3,$4) RETURNING id`,[device.dispositivo_id,input.proveedor??null,input.fallaReportada,input.responsable]);
  await cambiarEstadoDispositivo(input.dispositivoCodigo,Number(state.id),client);
  await insertarHistorialDispositivo(device.dispositivo_id,"ENVIAR_SERVICIO_TECNICO",device.estado_id,state.id,
    input.responsable,input.fallaReportada,{ordenServicioId:inserted.rows[0]!.id,proveedor:input.proveedor??null},client);
  const row=await obtenerOrden(Number(inserted.rows[0]!.id),client);await client.query("COMMIT");return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");if(isUniqueViolation(error))throw new ConflictError("El dispositivo ya tiene una orden de servicio abierta.");throw error}finally{client.release()}
};

export const registrarCotizacion=async(id:number,input:CotizacionInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");const current=await obtenerOrden(id,client);
  if(!current)throw new NotFoundError("Orden de servicio no encontrada.");
  if(current.estado!=="PENDIENTE_DIAGNOSTICO")throw new ConflictError("La orden no admite una nueva cotización.");
  await client.query(`UPDATE itam.ordenes_servicio_tecnico SET diagnostico=$2,descripcion_reparacion=$3,
    monto_cotizacion=$4,proveedor=COALESCE($5,proveedor),estado='COTIZACION_RECIBIDA' WHERE id=$1`,
    [id,input.diagnostico,input.descripcionReparacion,input.montoCotizacion,input.proveedor??null]);
  await insertarHistorialDispositivo(current.dispositivo_id,"COTIZACION_SERVICIO_TECNICO",null,null,input.responsable,
    input.diagnostico,{ordenServicioId:id,montoCotizacion:input.montoCotizacion,descripcionReparacion:input.descripcionReparacion},client);
  const row=await obtenerOrden(id,client);await client.query("COMMIT");return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};

const motivosRechazo=["REPARACION_DEMASIADO_COSTOSA","MULTIPLES_REPARACIONES","EQUIPO_OBSOLETO","SIN_REPUESTOS","OTRO"];
export const decidirOrdenServicio=async(id:number,input:DecisionServicioInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");const current=await obtenerOrden(id,client);
  if(!current)throw new NotFoundError("Orden de servicio no encontrada.");
  if(current.estado!=="COTIZACION_RECIBIDA")throw new ConflictError("La orden no está pendiente de decisión.");
  if(input.decision!=="APROBAR"&&!input.motivo)throw new ValidationError("El motivo es obligatorio al rechazar o dar de baja.");
  if(input.decision==="RECHAZAR"&&input.motivo&&!motivosRechazo.includes(input.motivo))throw new ValidationError("Motivo de rechazo no válido.");
  const target=input.decision==="APROBAR"?"REPARACION_APROBADA":input.decision==="RECHAZAR"?"REPARACION_RECHAZADA":"BAJA";
  await client.query(`UPDATE itam.ordenes_servicio_tecnico SET decision=$2,motivo_decision=$3,
    observacion_decision=$4,fecha_decision=NOW(),responsable_decision=$5,estado=$6 WHERE id=$1`,
    [id,input.decision,input.motivo??null,input.observaciones??null,input.responsable,target]);
  if(input.decision==="DAR_BAJA"){
    const baja=await obtenerEstadoDispositivoPorCodigo("DADO_BAJA",client);if(!baja)throw new ConflictError("No existe el estado DADO_BAJA.");
    await cambiarEstadoDispositivo(current.codigo_inventario,Number(baja.id),client);
    await registrarBajaDispositivo(current.dispositivo_id,input.motivo!,input.observaciones,Number(current.valor_comercial),input.responsable,String(id),client);
    await insertarHistorialDispositivo(current.dispositivo_id,"DAR_BAJA_DESDE_SERVICIO",null,baja.id,input.responsable,input.observaciones,
      {ordenServicioId:id,motivo:input.motivo,valorComercial:Number(current.valor_comercial)},client);
  }else{
    await insertarHistorialDispositivo(current.dispositivo_id,input.decision==="APROBAR"?"APROBAR_REPARACION":"RECHAZAR_REPARACION",null,null,
      input.responsable,input.observaciones,{ordenServicioId:id,motivo:input.motivo??null,montoCotizacion:Number(current.monto_cotizacion)},client);
  }
  const row=await obtenerOrden(id,client);await client.query("COMMIT");return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};

export const cerrarOrdenServicio=async(id:number,input:CerrarOrdenInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");const current=await obtenerOrden(id,client);
  if(!current)throw new NotFoundError("Orden de servicio no encontrada.");
  if(!["REPARACION_APROBADA","EN_REPARACION","REPARACION_TERMINADA"].includes(current.estado))throw new ConflictError("La orden no puede cerrarse en su estado actual.");
  await client.query(`UPDATE itam.ordenes_servicio_tecnico SET costo_final=$2,fecha_retorno=COALESCE($3::timestamptz,NOW()),
    resultado=$4,estado='CERRADA' WHERE id=$1`,[id,input.costoFinal,input.fechaRetorno??null,input.resultado]);
  const review=await obtenerEstadoDispositivoPorCodigo("RETENIDO_REVISION",client);if(!review)throw new ConflictError("No existe el estado RETENIDO_REVISION.");
  await cambiarEstadoDispositivo(current.codigo_inventario,Number(review.id),client);
  await insertarHistorialDispositivo(current.dispositivo_id,"RECEPCION_SERVICIO_TECNICO",null,review.id,input.responsable,input.resultado,
    {ordenServicioId:id,costoFinal:input.costoFinal,fechaRetorno:input.fechaRetorno??null},client);
  const row=await obtenerOrden(id,client);await client.query("COMMIT");return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};
