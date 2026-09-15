import { pool } from "../../config/database";
import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "../../shared/errors";
import { toIsoDateTime } from "../../shared/dates";
import { asignarDispositivoAColaborador, cambiarEstadoDispositivo, devolverDispositivo, insertarHistorialDispositivo, obtenerDispositivoPorCodigo, obtenerEstadoDispositivoPorCodigo } from "../dispositivos/dispositivos.repository";
import { assertAsignadoConCustodioUnico, assertColaboradorActivo, darDeBajaDispositivo } from "../dispositivos/dispositivos.service";
import { obtenerColaboradorPorId } from "../colaboradores/colaboradores.repository";
import type { MotivoBaja } from "../dispositivos/dispositivos.types";
import { listarEntregasTemporales, listarOrdenes, obtenerEntregaTemporal, obtenerOrden, obtenerOrdenAbiertaPorDispositivo } from "./servicio-tecnico.repository";
import type { CerrarOrdenInput, CerrarTemporalInput, CotizacionInput, CrearOrdenServicioInput, DecisionServicioInput, EntregaTemporalRow, EntregarTemporalInput, OrdenServicioRow } from "./servicio-tecnico.types";

const mapTemporal=(r:EntregaTemporalRow)=>({id:r.id,ordenServicioId:r.orden_servicio_id,
 dispositivo:{id:r.dispositivo_temporal_id,codigoInventario:r.codigo_inventario,tipo:r.tipo_dispositivo,marca:r.marca,modelo:r.modelo},
 colaborador:{id:r.colaborador_id,nombre:r.colaborador_nombre,rut:r.colaborador_rut},
 fechaEntrega:toIsoDateTime(r.fecha_entrega),responsableEntrega:r.responsable_entrega,
 observacionesEntrega:r.observaciones_entrega,fechaDevolucion:r.fecha_devolucion?toIsoDateTime(r.fecha_devolucion):null,
 responsableDevolucion:r.responsable_devolucion,observacionesDevolucion:r.observaciones_devolucion,estado:r.estado});

const mapOrden=(r:OrdenServicioRow,temporales:EntregaTemporalRow[]=[])=>({
  id:r.id,dispositivo:{id:r.dispositivo_id,codigoInventario:r.codigo_inventario,
    tipo:r.tipo_dispositivo,marca:r.marca,modelo:r.modelo,valorComercial:Number(r.valor_comercial)},
  proveedor:r.proveedor,fechaEnvio:serviceDateInput(r.fecha_envio),fallaReportada:r.falla_reportada,observacionesEnvio:r.observaciones_envio,
  tipoServicio:r.tipo_servicio,accesoriosEntregados:r.accesorios_entregados,plazoInformado:r.plazo_informado,
  diagnostico:r.diagnostico,descripcionReparacion:r.descripcion_reparacion,
  montoCotizacion:r.monto_cotizacion===null?null:Number(r.monto_cotizacion),decision:r.decision,
  motivoDecision:r.motivo_decision,observacionDecision:r.observacion_decision,
  fechaDecision:r.fecha_decision?toIsoDateTime(r.fecha_decision):null,
  responsableDecision:r.responsable_decision,costoFinal:r.costo_final===null?null:Number(r.costo_final),
  fechaRetorno:r.fecha_retorno?serviceDateInput(r.fecha_retorno):null,resultado:r.resultado,
  estadoFinal:r.estado_final,observacionesRetorno:r.observaciones_retorno,
  estado:r.estado,responsableEnvio:r.responsable_envio,
  reparacionesAnteriores:Number(r.reparaciones_anteriores),costoAcumulado:Number(r.costo_acumulado),
  custodiaAlIngreso:r.custodio_tipo_al_ingreso?{tipo:r.custodio_tipo_al_ingreso,
    colaborador:r.colaborador_id_al_ingreso?{id:r.colaborador_id_al_ingreso,nombre:r.colaborador_nombre_al_ingreso!,rut:r.colaborador_rut_al_ingreso!}:null,
    departamento:r.departamento_id_al_ingreso?{id:r.departamento_id_al_ingreso,nombre:r.departamento_nombre_al_ingreso!}:null,
    recibidoPor:r.recibido_por_id_al_ingreso?{id:r.recibido_por_id_al_ingreso,nombre:r.recibido_por_nombre_al_ingreso!}:null}:null,
  entregasTemporales:temporales.map(mapTemporal),
  creadoEn:toIsoDateTime(r.creado_en),actualizadoEn:toIsoDateTime(r.actualizado_en)
});

const parseFechaEnvio = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new ValidationError("Fecha de envío inválida.");
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new ValidationError("Fecha de envío inválida.");
  }
  return trimmed;
};

const serviceDateOnly = (value: Date | string): string =>
  (()=>{const [year,month,day]=serviceDateInput(value).split("-");return `${day}/${month}/${year}`;})();

const serviceDateInput = (value: Date | string): string => {
  if (typeof value === "string") return value.slice(0, 10);
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Santiago",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(value);
  const part=(type:string)=>parts.find(item=>item.type===type)?.value||"";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const obtenerOrdenesServicio=async()=>Promise.all((await listarOrdenes()).map(async row=>mapOrden(row,await listarEntregasTemporales(row.id))));
export const obtenerOrdenServicio=async(id:number)=>{const row=await obtenerOrden(id);if(!row)throw new NotFoundError("Orden de servicio no encontrada.");return mapOrden(row,await listarEntregasTemporales(row.id))};

export const crearOrdenServicio=async(input:CrearOrdenServicioInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");
  const device=await obtenerDispositivoPorCodigo(input.dispositivoCodigo,client);
  if(!device)throw new NotFoundError("Dispositivo no encontrado.");
  if(["EXTRAVIADO","DADO_BAJA"].includes(device.estado_codigo))throw new ConflictError("Un dispositivo en estado terminal no puede ingresar a servicio técnico.");
  if(device.estado_codigo==="SERVICIO_TECNICO"||await obtenerOrdenAbiertaPorDispositivo(device.dispositivo_id,client))throw new ConflictError("El equipo ya se encuentra en servicio técnico.");
  const state=await obtenerEstadoDispositivoPorCodigo("SERVICIO_TECNICO",client);
  if(!state)throw new ConflictError("No existe el estado SERVICIO_TECNICO.");
  const custodioTipo=device.colaborador_id?"COLABORADOR":device.departamento_id?"DEPARTAMENTO":null;
  const fechaEnvio=parseFechaEnvio(input.fechaEnvio);
  if(!fechaEnvio)throw new ValidationError("La fecha de envío es obligatoria.");
  const inserted=await client.query<{id:string}>("INSERT INTO itam.ordenes_servicio_tecnico(dispositivo_id,proveedor,fecha_envio,tipo_servicio,falla_reportada,accesorios_entregados,observaciones_envio,responsable_envio,custodio_tipo_al_ingreso,colaborador_id_al_ingreso,departamento_id_al_ingreso,recibido_por_id_al_ingreso) VALUES($1,$2,COALESCE($3::date::timestamptz,NOW()),$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id",[device.dispositivo_id,input.proveedor??null,fechaEnvio,input.tipoServicio,input.fallaReportada,input.accesoriosEntregados??null,input.observaciones??null,input.responsable,custodioTipo,device.colaborador_id,device.departamento_id,device.recibido_por_id]);
  await cambiarEstadoDispositivo(input.dispositivoCodigo,Number(state.id),client);
  await insertarHistorialDispositivo(device.dispositivo_id,"ENVIAR_SERVICIO_TECNICO",device.estado_id,state.id,
    input.responsable,input.fallaReportada,{ordenServicioId:inserted.rows[0]!.id,proveedor:input.proveedor??null},client);
  const row=await obtenerOrden(Number(inserted.rows[0]!.id),client);await client.query("COMMIT");return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");if(isUniqueViolation(error))throw new ConflictError("El equipo ya se encuentra en servicio técnico.");throw error}finally{client.release()}
};

export const generarEnvioServicioPdf=async(id:number)=>{
 const row=await obtenerOrden(id);if(!row)throw new NotFoundError("Orden de servicio no encontrada.");
 const doc=new PDFDocument({size:"A4",margin:42,info:{Title:"Orden de Trabajo Servicio Técnico OT-"+row.id}});const chunks:Buffer[]=[];
 doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));const done=new Promise<Buffer>((resolve,reject)=>{doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject)});
 const navy="#123B6D",line="#CBD5E1",gray="#475569";
 const section=(title:string)=>{doc.moveDown(.7).fillColor(navy).font("Helvetica-Bold").fontSize(10).text(title).moveDown(.25);};
 const rule=()=>doc.strokeColor(line).moveTo(doc.page.margins.left,doc.y).lineTo(doc.page.width-doc.page.margins.right,doc.y).stroke().moveDown(.35);
 const field=(label:string,value:string)=>doc.fillColor(gray).font("Helvetica-Bold").fontSize(8).text(label+": ",{continued:true}).font("Helvetica").text(value||" ");
 const serviceType=(value:string)=>["GARANTIA","REPARACION","MANTENCION","DIAGNOSTICO"].map(item=>`[${item===value?"x":" "}] ${item[0]+item.slice(1).toLowerCase()}`).join("    ");
 const finalState=(value:string|null)=>["OPERATIVO","SIN_REPARACION","BAJA"].map(item=>`[${item===value?"x":" "}] ${item.replace("_"," ")}`).join("    ");
 const logoPath=resolve(__dirname,"../../../../frontend/public/assets/brand/itam-logo.png");const headerY=doc.y;const headerX=existsSync(logoPath)?doc.page.margins.left+58:doc.page.margins.left;if(existsSync(logoPath))doc.image(logoPath,doc.page.margins.left,headerY,{width:44});
 doc.fillColor(navy).font("Helvetica-Bold").fontSize(16).text("AGUAS SAN ISIDRO",headerX,headerY).fontSize(17).text("ORDEN DE TRABAJO",{align:"right"}).fontSize(10).text("ENVÍO DE EQUIPOS A SERVICIO TÉCNICO",{align:"right"}).moveDown(.25);rule();
 doc.fillColor(gray).font("Helvetica").fontSize(9).text("N° de orden: OT-"+row.id,{continued:true}).text("    Fecha: "+serviceDateOnly(row.fecha_envio),{align:"right"});
 section("1. ANTECEDENTES GENERALES");field("Área solicitante","Área TI — Aguas San Isidro");field("Responsable TI",row.responsable_envio);field("Tipo de servicio",serviceType(row.tipo_servicio));rule();
 section("2. SERVICIO TÉCNICO");field("Empresa",row.proveedor??"");field("Contacto","");rule();
 section("3. IDENTIFICACIÓN DE LOS EQUIPOS");
 doc.rect(doc.x,doc.y,doc.page.width-doc.page.margins.left-doc.page.margins.right,20).fillAndStroke("#EAF2F8",line).fillColor(navy).font("Helvetica-Bold").fontSize(8).text("N°     Tipo de equipo          Marca / modelo                 IMEI o serie                 Usuario asignado / Área",doc.x+5,doc.y+6);doc.moveDown(1.55);
 const identifier=row.imei??row.numero_serie??"";const holder=row.colaborador_nombre_al_ingreso??row.departamento_nombre_al_ingreso??"";
 doc.fillColor(gray).font("Helvetica").fontSize(8).text(`1      ${row.tipo_dispositivo}          ${[row.marca,row.modelo].filter(Boolean).join(" ")}                 ${identifier}                 ${holder}`);rule();
 section("4. CONDICIONES DE ENTREGA POR EQUIPO");
 doc.rect(doc.x,doc.y,doc.page.width-doc.page.margins.left-doc.page.margins.right,20).fillAndStroke("#EAF2F8",line).fillColor(navy).font("Helvetica-Bold").fontSize(8).text("N°     Falla o problema reportado                                      Accesorios entregados / Observaciones",doc.x+5,doc.y+6);doc.moveDown(1.55);
 doc.fillColor(gray).font("Helvetica").fontSize(8).text("1      "+row.falla_reportada).text("       "+(row.accesorios_entregados??"")).text("       "+(row.observaciones_envio??""));rule();
 section("5. RECEPCIÓN Y DEVOLUCIÓN");field("Fecha de recepción",serviceDateOnly(row.fecha_envio));field("N° OT / ticket proveedor","");field("Diagnóstico y plazo informado",[row.diagnostico,row.plazo_informado].filter(Boolean).join(" — "));field("Fecha de devolución",row.fecha_retorno?serviceDateOnly(row.fecha_retorno):"");field("Estado final",finalState(row.estado_final));field("Resultado / observaciones de retorno",[row.resultado,row.observaciones_retorno].filter(Boolean).join(" — "));rule();
 section("6. FIRMAS");doc.fillColor(gray).font("Helvetica").fontSize(8).text("RECEPCIÓN EN SERVICIO TÉCNICO",{continued:true}).text("RECEPCIÓN POST SERVICIO — ÁREA TI",{align:"right"}).moveDown(2).text("____________________________",{continued:true}).text("                         ____________________________",{align:"right"}).text("Firma / representante del servicio técnico                 Firma / Responsable TI — Aguas San Isidro").moveDown(.4).text("Nombre: ____________________________",{continued:true}).text("        Nombre: ____________________________",{align:"right"}).text("Fecha: ______________________________",{continued:true}).text("        Fecha: ______________________________",{align:"right"});
 doc.moveDown(2).fillColor(gray).fontSize(8).text("Área TI — Aguas San Isidro | Formulario TI-OT | v1.0",{align:"center"});
 doc.end();return{buffer:await done,filename:"OT-"+row.id+"-servicio-tecnico.pdf"};
};

export const registrarCotizacion=async(id:number,input:CotizacionInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");const current=await obtenerOrden(id,client);
  if(!current)throw new NotFoundError("Orden de servicio no encontrada.");
  if(current.estado!=="PENDIENTE_DIAGNOSTICO")throw new ConflictError("La orden no admite una nueva cotización.");
  await client.query(`UPDATE itam.ordenes_servicio_tecnico SET diagnostico=$2,descripcion_reparacion=$3,
    monto_cotizacion=$4,plazo_informado=$5,proveedor=COALESCE($6,proveedor),estado='COTIZACION_RECIBIDA' WHERE id=$1`,
    [id,input.diagnostico,input.descripcionReparacion,input.montoCotizacion,input.plazoInformado??null,input.proveedor??null]);
  await insertarHistorialDispositivo(current.dispositivo_id,"COTIZACION_SERVICIO_TECNICO",null,null,input.responsable,
    input.diagnostico,{ordenServicioId:id,montoCotizacion:input.montoCotizacion,descripcionReparacion:input.descripcionReparacion},client);
  const row=await obtenerOrden(id,client);await client.query("COMMIT");return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};

const motivosRechazo=["REPARACION_DEMASIADO_COSTOSA","MULTIPLES_REPARACIONES","EQUIPO_OBSOLETO","SIN_REPUESTOS","OTRO"];
const motivoBajaDesdeServicio:Record<string,MotivoBaja>={
  REPARACION_DEMASIADO_COSTOSA:"REPARACION_NO_CONVENIENTE",
  MULTIPLES_REPARACIONES:"MULTIPLES_REPARACIONES",
  EQUIPO_OBSOLETO:"OBSOLESCENCIA",
  SIN_REPUESTOS:"SIN_REPUESTOS",
  OTRO:"OTRO"
};
export const decidirOrdenServicio=async(id:number,input:DecisionServicioInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");const current=await obtenerOrden(id,client);
  if(!current)throw new NotFoundError("Orden de servicio no encontrada.");
  if(current.estado!=="COTIZACION_RECIBIDA")throw new ConflictError("La orden no está pendiente de decisión.");
  if(input.decision!=="APROBAR"&&!input.motivo)throw new ValidationError("El motivo es obligatorio al rechazar o dar de baja.");
  if(input.decision==="RECHAZAR"&&input.motivo&&!motivosRechazo.includes(input.motivo))throw new ValidationError("Motivo de rechazo no válido.");
  if(input.decision==="DAR_BAJA"){
    const motivoBaja=motivoBajaDesdeServicio[input.motivo!];
    if(!motivoBaja)throw new ValidationError("Motivo de baja no valido.");
    await darDeBajaDispositivo(current.codigo_inventario,{
      motivo:motivoBaja,responsable:input.responsable,
      observaciones:input.observaciones
    },client,{ordenServicioMotivo:input.motivo!});
  }else{
    const target=input.decision==="APROBAR"?"REPARACION_APROBADA":"REPARACION_RECHAZADA";
    await client.query(`UPDATE itam.ordenes_servicio_tecnico SET decision=$2,motivo_decision=$3,
      observacion_decision=$4,fecha_decision=NOW(),responsable_decision=$5,estado=$6 WHERE id=$1`,
      [id,input.decision,input.motivo??null,input.observaciones??null,input.responsable,target]);
    await insertarHistorialDispositivo(current.dispositivo_id,input.decision==="APROBAR"?"APROBAR_REPARACION":"RECHAZAR_REPARACION",null,null,
      input.responsable,input.observaciones,{ordenServicioId:id,motivo:input.motivo??null,montoCotizacion:Number(current.monto_cotizacion)},client);
  }
  const row=await obtenerOrden(id,client);await client.query("COMMIT");return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};

export const cerrarOrdenServicio=async(id:number,input:CerrarOrdenInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");const current=await obtenerOrden(id,client);
  if(!current)throw new NotFoundError("Orden de servicio no encontrada.");
  if(current.estado!=="COTIZACION_RECIBIDA"&&! ["REPARACION_APROBADA","EN_REPARACION","REPARACION_TERMINADA"].includes(current.estado))throw new ConflictError("La orden no puede cerrarse en su estado actual.");
  if(!current.diagnostico)throw new ConflictError("Debe guardar el diagnóstico antes de finalizar la revisión.");
  const temporalAbierto=await client.query(`SELECT id FROM itam.entregas_temporales_servicio WHERE orden_servicio_id=$1 AND estado='ABIERTA' LIMIT 1`,[id]);
  if(temporalAbierto.rows[0])throw new ConflictError("Debe registrar la devolución del equipo temporal antes de cerrar la orden.");
  const fechaRetorno=parseFechaEnvio(input.fechaRetorno);
  if(!fechaRetorno)throw new ValidationError("La fecha de retorno es obligatoria.");
  const device=await obtenerDispositivoPorCodigo(current.codigo_inventario,client);if(!device)throw new NotFoundError("Dispositivo no encontrado.");
  let targetCode:string;
  if(input.estadoFinal==="BAJA"){
    await darDeBajaDispositivo(current.codigo_inventario,{motivo:"REPARACION_NO_CONVENIENTE",responsable:input.responsable,observaciones:input.observacionesRetorno},client,{ordenServicioMotivo:"REPARACION_NO_CONVENIENTE"});
    targetCode="DADO_BAJA";
  }else{
    targetCode=input.estadoFinal==="OPERATIVO"?(device.colaborador_id||device.departamento_id?"ASIGNADO":"DISPONIBLE"):"RETENIDO_REVISION";
    if(targetCode==="ASIGNADO")assertAsignadoConCustodioUnico(device.colaborador_id,device.departamento_id);
    const target=await obtenerEstadoDispositivoPorCodigo(targetCode,client);if(!target)throw new ConflictError(`No existe el estado ${targetCode}.`);
    await cambiarEstadoDispositivo(current.codigo_inventario,Number(target.id),client);
    await insertarHistorialDispositivo(current.dispositivo_id,"RETORNO_POST_SERVICIO_TECNICO",device.estado_id,target.id,input.responsable,input.resultado,
      {ordenServicioId:id,costoFinal:input.costoFinal,fechaRetorno:fechaRetorno,estadoFinal:input.estadoFinal,
      custodioAlIngreso:{tipo:current.custodio_tipo_al_ingreso,colaboradorId:current.colaborador_id_al_ingreso,departamentoId:current.departamento_id_al_ingreso},
      retornoAlMismoCustodio:Boolean(device.colaborador_id||device.departamento_id)},client);
  }
  await client.query(`UPDATE itam.ordenes_servicio_tecnico SET costo_final=$2,fecha_retorno=$3::date::timestamptz,
    resultado=$4,estado_final=$5,observaciones_retorno=$6,estado='CERRADA' WHERE id=$1`,[id,input.costoFinal,fechaRetorno,input.resultado,input.estadoFinal,input.observacionesRetorno??null]);
  const row=await obtenerOrden(id,client);const temporales=await listarEntregasTemporales(String(id),client);await client.query("COMMIT");return mapOrden(row!,temporales);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};

export const entregarEquipoTemporal=async(id:number,input:EntregarTemporalInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");
  const orden=await obtenerOrden(id,client);if(!orden)throw new NotFoundError("Orden de servicio no encontrada.");
  if(["CERRADA","BAJA","REPARACION_RECHAZADA"].includes(orden.estado))throw new ConflictError("La orden no admite una entrega temporal.");
  if(!orden.colaborador_id_al_ingreso)throw new ConflictError("La entrega temporal requiere que el activo original tuviera custodia de un colaborador.");
  const colaborador=await obtenerColaboradorPorId(Number(orden.colaborador_id_al_ingreso),client);
  assertColaboradorActivo(colaborador);
  const temporal=await obtenerDispositivoPorCodigo(input.dispositivoCodigo,client,true);if(!temporal)throw new NotFoundError("Equipo temporal no encontrado.");
  if(temporal.dispositivo_id===orden.dispositivo_id)throw new ValidationError("El activo original no puede utilizarse como equipo temporal.");
  if(temporal.colaborador_id||temporal.departamento_id)throw new ConflictError("El equipo temporal ya tiene un custodio vigente.");
  if(temporal.estado_codigo!=="DISPONIBLE")throw new ConflictError("Solo un equipo disponible puede entregarse temporalmente.");
  if(await obtenerOrdenAbiertaPorDispositivo(temporal.dispositivo_id,client))throw new ConflictError("El equipo temporal tiene una orden técnica abierta.");
  const existing=await client.query(`SELECT id FROM itam.entregas_temporales_servicio WHERE orden_servicio_id=$1 AND estado='ABIERTA' LIMIT 1`,[id]);
  if(existing.rows[0])throw new ConflictError("La orden ya tiene una entrega temporal abierta.");
  const inserted=await client.query<{id:string}>(`INSERT INTO itam.entregas_temporales_servicio(
    orden_servicio_id,dispositivo_temporal_id,colaborador_id,responsable_entrega,observaciones_entrega)
    VALUES($1,$2,$3,$4,$5) RETURNING id`,[id,temporal.dispositivo_id,orden.colaborador_id_al_ingreso,input.responsable,input.observaciones??null]);
  const asignado=await obtenerEstadoDispositivoPorCodigo("ASIGNADO",client);if(!asignado)throw new ConflictError("No existe el estado ASIGNADO.");
  const asignadoTemporal=await asignarDispositivoAColaborador(input.dispositivoCodigo,Number(orden.colaborador_id_al_ingreso),asignado.id,client);
  if(!asignadoTemporal)throw new ConflictError("El equipo temporal dejo de estar disponible para asignacion.");
  const detalle={ordenServicioId:id,entregaTemporalId:inserted.rows[0]!.id,activoOriginalCodigo:orden.codigo_inventario,
    activoTemporalCodigo:input.dispositivoCodigo,colaboradorId:orden.colaborador_id_al_ingreso};
  await insertarHistorialDispositivo(temporal.dispositivo_id,"ENTREGAR_EQUIPO_TEMPORAL",temporal.estado_id,asignado.id,input.responsable,input.observaciones,detalle,client);
  await insertarHistorialDispositivo(orden.dispositivo_id,"ASOCIAR_EQUIPO_TEMPORAL",null,null,input.responsable,input.observaciones,detalle,client);
  const row=await obtenerOrden(id,client);const temporales=await listarEntregasTemporales(String(id),client);await client.query("COMMIT");return mapOrden(row!,temporales);
 }catch(error){await client.query("ROLLBACK");if(isUniqueViolation(error))throw new ConflictError("La orden o el equipo ya tiene una entrega temporal abierta.");throw error}finally{client.release()}
};

export const cerrarEquipoTemporal=async(id:number,entregaId:number,input:CerrarTemporalInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");
  const orden=await obtenerOrden(id,client);if(!orden)throw new NotFoundError("Orden de servicio no encontrada.");
  const entrega=await obtenerEntregaTemporal(entregaId,client);if(!entrega||entrega.orden_servicio_id!==String(id))throw new NotFoundError("Entrega temporal no encontrada.");
  if(entrega.estado!=="ABIERTA")throw new ConflictError("La entrega temporal ya está cerrada.");
  const temporal=await obtenerDispositivoPorCodigo(entrega.codigo_inventario,client);if(!temporal)throw new NotFoundError("Equipo temporal no encontrado.");
  if(temporal.colaborador_id!==entrega.colaborador_id)throw new ConflictError("La custodia actual del equipo temporal no coincide con la entrega registrada.");
  const retenido=await obtenerEstadoDispositivoPorCodigo("RETENIDO_REVISION",client);if(!retenido)throw new ConflictError("No existe el estado RETENIDO_REVISION.");
  await devolverDispositivo(entrega.codigo_inventario,retenido.id,client);
  await client.query(`UPDATE itam.entregas_temporales_servicio SET estado='CERRADA',fecha_devolucion=NOW(),
    responsable_devolucion=$2,observaciones_devolucion=$3 WHERE id=$1`,[entregaId,input.responsable,input.observaciones??null]);
  const detalle={ordenServicioId:id,entregaTemporalId:entrega.id,activoOriginalCodigo:orden.codigo_inventario,
    activoTemporalCodigo:entrega.codigo_inventario,colaboradorId:entrega.colaborador_id};
  await insertarHistorialDispositivo(temporal.dispositivo_id,"DEVOLVER_EQUIPO_TEMPORAL",temporal.estado_id,retenido.id,input.responsable,input.observaciones,detalle,client);
  await insertarHistorialDispositivo(orden.dispositivo_id,"CERRAR_EQUIPO_TEMPORAL",null,null,input.responsable,input.observaciones,detalle,client);
  const row=await obtenerOrden(id,client);const temporales=await listarEntregasTemporales(String(id),client);await client.query("COMMIT");return mapOrden(row!,temporales);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};
