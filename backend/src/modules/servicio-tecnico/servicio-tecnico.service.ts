import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "../../shared/errors";
import { toIsoDateTime } from "../../shared/dates";
import { asignarDispositivoAColaborador, cambiarEstadoDispositivo, devolverDispositivo, insertarHistorialDispositivo, obtenerDispositivoPorCodigo, obtenerEstadoDispositivoPorCodigo } from "../dispositivos/dispositivos.repository";
import { assertAsignadoConCustodioUnico, assertColaboradorActivo, darDeBajaDispositivo } from "../dispositivos/dispositivos.service";
import { obtenerColaboradorPorId } from "../colaboradores/colaboradores.repository";
import type { MotivoBaja } from "../dispositivos/dispositivos.types";
import { listarEntregasTemporales, listarOrdenes, obtenerCotizacionArchivo, obtenerEntregaTemporal, obtenerOrden, obtenerOrdenAbiertaPorDispositivo, obtenerOrdenParaActualizar } from "./servicio-tecnico.repository";
import { resolveTechnicalQuoteFilePath, removeTechnicalQuoteFile } from "./servicio-tecnico.upload";
import type { CerrarOrdenInput, CerrarTemporalInput, CotizacionArchivo, CotizacionArchivoAlmacenado, CotizacionArchivoRow, CotizacionInput, CrearOrdenServicioInput, DecisionServicioInput, EditarOrdenServicioInput, EntregaTemporalRow, EntregarTemporalInput, OrdenServicioRow } from "./servicio-tecnico.types";
import { buildTechnicalOrderPdf } from "./servicio-tecnico.pdf";

const mapTemporal=(r:EntregaTemporalRow)=>({id:r.id,ordenServicioId:r.orden_servicio_id,
 dispositivo:{id:r.dispositivo_temporal_id,codigoInventario:r.codigo_inventario,tipo:r.tipo_dispositivo,marca:r.marca,modelo:r.modelo},
 colaborador:{id:r.colaborador_id,nombre:r.colaborador_nombre,rut:r.colaborador_rut},
 fechaEntrega:toIsoDateTime(r.fecha_entrega),responsableEntrega:r.responsable_entrega,
 observacionesEntrega:r.observaciones_entrega,fechaDevolucion:r.fecha_devolucion?toIsoDateTime(r.fecha_devolucion):null,
 responsableDevolucion:r.responsable_devolucion,observacionesDevolucion:r.observaciones_devolucion,estado:r.estado});

const mapCotizacionArchivo=(r:CotizacionArchivoRow|null):CotizacionArchivo|null=>r?({id:r.id,ordenServicioTecnicoId:r.orden_servicio_tecnico_id,dispositivoId:r.dispositivo_id,proveedor:r.proveedor,nombreOriginal:r.nombre_original,mimeType:r.mime_type,tamanioBytes:Number(r.tamanio_bytes),version:r.version,activo:r.activo,subidoPor:r.subido_por,creadoEn:toIsoDateTime(r.creado_en)}):null;

const mapOrden=(r:OrdenServicioRow,temporales:EntregaTemporalRow[]=[])=>({
  id:r.id,numeroOt:Number(r.numero_ot),dispositivo:{id:r.dispositivo_id,codigoInventario:r.codigo_inventario,
    tipo:r.tipo_dispositivo,marca:r.marca,modelo:r.modelo,imei:r.imei,numeroSerie:r.numero_serie,valorComercial:Number(r.valor_comercial)},
  proveedor:r.proveedor,areaSolicitante:r.area_solicitante,contactoServicio:r.contacto_servicio,ticketProveedor:r.ticket_proveedor,observacionesCotizacion:r.observaciones_cotizacion,
  fechaEnvio:serviceDateInput(r.fecha_envio),fallaReportada:r.falla_reportada,observacionesEnvio:r.observaciones_envio,
  tipoServicio:r.tipo_servicio,accesoriosEntregados:r.accesorios_entregados,plazoInformado:r.plazo_informado,
  diagnostico:r.diagnostico,descripcionReparacion:r.descripcion_reparacion,
  montoCotizacion:r.monto_cotizacion===null?null:Number(r.monto_cotizacion),decision:r.decision,
  motivoDecision:r.motivo_decision,observacionDecision:r.observacion_decision,
  fechaDecision:r.fecha_decision?toIsoDateTime(r.fecha_decision):null,
  responsableDecision:r.responsable_decision,costoFinal:r.costo_final===null?null:Number(r.costo_final),
  fechaRetorno:r.fecha_retorno?serviceDateInput(r.fecha_retorno):null,resultado:r.resultado,
  estadoFinal:r.estado_final,observacionesRetorno:r.observaciones_retorno,
  cotizacionArchivo:r.cotizacion_archivo_id?{id:r.cotizacion_archivo_id,ordenServicioTecnicoId:r.id,dispositivoId:r.dispositivo_id,proveedor:r.cotizacion_archivo_proveedor,nombreOriginal:r.cotizacion_archivo_nombre_original!,mimeType:r.cotizacion_archivo_mime_type!,tamanioBytes:Number(r.cotizacion_archivo_tamanio_bytes),version:r.cotizacion_archivo_version!,activo:r.cotizacion_archivo_activo!,subidoPor:r.cotizacion_archivo_subido_por!,creadoEn:toIsoDateTime(r.cotizacion_archivo_creado_en!)}:null,
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

const parseFechaRetorno = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new ValidationError("Fecha de retorno inválida.");
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) {
    throw new ValidationError("Fecha de retorno inválida.");
  }
  return trimmed;
};

const serviceDateOnly = (value: Date | string): string =>
  (()=>{const [year,month,day]=serviceDateInput(value).split("-");return `${day}/${month}/${year}`;})();

const technicalOrderNumber = (value:string|number):string => String(value).padStart(3,"0");

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
  if(!input.proveedor?.trim())throw new ValidationError("Falta proveedor, técnico o destino.");
  if(!input.fallaReportada.trim())throw new ValidationError("Falta falla reportada.");
  if(!input.responsable.trim())throw new ValidationError("El responsable TI es obligatorio.");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('itam.ordenes_servicio_tecnico.numero_ot'))");
  const nextNumber=await client.query<{numero_ot:string}>("SELECT COALESCE(MAX(numero_ot),0)+1 AS numero_ot FROM itam.ordenes_servicio_tecnico");
  const numeroOt=Number(nextNumber.rows[0]?.numero_ot??1);
  const inserted=await client.query<{id:string}>("INSERT INTO itam.ordenes_servicio_tecnico(numero_ot,dispositivo_id,proveedor,fecha_envio,area_solicitante,contacto_servicio,tipo_servicio,falla_reportada,accesorios_entregados,observaciones_envio,responsable_envio,custodio_tipo_al_ingreso,colaborador_id_al_ingreso,departamento_id_al_ingreso,recibido_por_id_al_ingreso) VALUES($1,$2,$3,COALESCE($4::date::timestamptz,NOW()),$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id",[numeroOt,device.dispositivo_id,input.proveedor??null,fechaEnvio,input.areaSolicitante??null,input.contactoServicio??null,input.tipoServicio,input.fallaReportada,input.accesoriosEntregados??null,input.observaciones??null,input.responsable,custodioTipo,device.colaborador_id,device.departamento_id,device.recibido_por_id]);
  await cambiarEstadoDispositivo(input.dispositivoCodigo,Number(state.id),client);
  await insertarHistorialDispositivo(device.dispositivo_id,"ENVIAR_SERVICIO_TECNICO",device.estado_id,state.id,
    input.responsable,input.fallaReportada,{ordenServicioId:inserted.rows[0]!.id,proveedor:input.proveedor??null},client);
  await generarEnvioServicioPdf(Number(inserted.rows[0]!.id),client);
  const row=await obtenerOrden(Number(inserted.rows[0]!.id),client);await client.query("COMMIT");return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");if(isUniqueViolation(error))throw new ConflictError("El equipo ya se encuentra en servicio técnico.");throw error}finally{client.release()}
};

export const editarOrdenServicio=async(id:number,input:EditarOrdenServicioInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");
  const current=await obtenerOrdenParaActualizar(id,client);
  if(!current)throw new NotFoundError("Orden de servicio no encontrada.");
  if(["CERRADA","BAJA","REPARACION_RECHAZADA"].includes(current.estado))throw new ConflictError("La revisiÃ³n tÃ©cnica ya estÃ¡ finalizada y no admite ediciÃ³n normal.");
  const fechaEnvio=parseFechaEnvio(input.fechaEnvio);if(!fechaEnvio)throw new ValidationError("La fecha de envÃ­o es obligatoria.");
  if(!input.proveedor?.trim())throw new ValidationError("Falta proveedor, tÃ©cnico o destino.");
  if(!input.fallaReportada.trim())throw new ValidationError("Falta falla reportada.");
  if(!input.responsable.trim())throw new ValidationError("El responsable TI es obligatorio.");
  const cambios=[
   {campo:"fechaEnvio",anterior:serviceDateInput(current.fecha_envio),nuevo:fechaEnvio},
   {campo:"proveedor",anterior:current.proveedor,nuevo:input.proveedor.trim()},
   {campo:"areaSolicitante",anterior:current.area_solicitante,nuevo:input.areaSolicitante??null},
   {campo:"contactoServicio",anterior:current.contacto_servicio,nuevo:input.contactoServicio??null},
   {campo:"tipoServicio",anterior:current.tipo_servicio,nuevo:input.tipoServicio},
   {campo:"fallaReportada",anterior:current.falla_reportada,nuevo:input.fallaReportada.trim()},
   {campo:"accesoriosEntregados",anterior:current.accesorios_entregados,nuevo:input.accesoriosEntregados??null},
   {campo:"observaciones",anterior:current.observaciones_envio,nuevo:input.observaciones??null},
   {campo:"responsable",anterior:current.responsable_envio,nuevo:input.responsable.trim()}
  ].filter(value=>String(value.anterior??"")!==String(value.nuevo??""));
  await client.query(`UPDATE itam.ordenes_servicio_tecnico SET proveedor=$2,fecha_envio=$3::date::timestamptz,
    area_solicitante=$4,contacto_servicio=$5,tipo_servicio=$6,falla_reportada=$7,
    accesorios_entregados=$8,observaciones_envio=$9,responsable_envio=$10 WHERE id=$1`,
    [id,input.proveedor.trim(),fechaEnvio,input.areaSolicitante??null,input.contactoServicio??null,input.tipoServicio,input.fallaReportada.trim(),input.accesoriosEntregados??null,input.observaciones??null,input.responsable.trim()]);
  if(cambios.length)await insertarHistorialDispositivo(current.dispositivo_id,"EDITAR_ORDEN_SERVICIO_TECNICO",null,null,input.responsable.trim(),"Orden de trabajo actualizada.",{ordenServicioId:id,cambios},client);
  const row=await obtenerOrden(id,client);const temporales=await listarEntregasTemporales(String(id),client);await client.query("COMMIT");return mapOrden(row!,temporales);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};

const generarEnvioServicioPdfLegacy=async(id:number,client?:PoolClient)=>{
 const row=await obtenerOrden(id,client);if(!row)throw new NotFoundError("Orden de servicio no encontrada.");
 const doc=new PDFDocument({size:"A4",margin:42,info:{Title:"Orden de Trabajo Servicio Técnico OT-"+technicalOrderNumber(row.numero_ot)}});const chunks:Buffer[]=[];
 doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));const done=new Promise<Buffer>((resolve,reject)=>{doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject)});
 const navy="#123B6D",line="#CBD5E1",gray="#475569";
 const section=(title:string)=>{doc.moveDown(.7).fillColor(navy).font("Helvetica-Bold").fontSize(10).text(title).moveDown(.25);};
 const rule=()=>doc.strokeColor(line).moveTo(doc.page.margins.left,doc.y).lineTo(doc.page.width-doc.page.margins.right,doc.y).stroke().moveDown(.35);
 const field=(label:string,value:string)=>doc.fillColor(gray).font("Helvetica-Bold").fontSize(8).text(label+": ",{continued:true}).font("Helvetica").text(value||" ");
 const serviceType=(value:string)=>["GARANTIA","REPARACION","MANTENCION","DIAGNOSTICO"].map(item=>`[${item===value?"x":" "}] ${item[0]+item.slice(1).toLowerCase()}`).join("    ");
 const finalState=(value:string|null)=>["OPERATIVO","SIN_REPARACION","BAJA"].map(item=>`[${item===value?"x":" "}] ${item.replace("_"," ")}`).join("    ");
 const logoPath=resolve(__dirname,"../../../../frontend/public/assets/brand/itam-logo.png");const headerY=doc.y;const headerX=existsSync(logoPath)?doc.page.margins.left+58:doc.page.margins.left;if(existsSync(logoPath))doc.image(logoPath,doc.page.margins.left,headerY,{width:44});
 doc.fillColor(navy).font("Helvetica-Bold").fontSize(16).text("AGUAS SAN ISIDRO",headerX,headerY).fontSize(17).text("ORDEN DE TRABAJO",{align:"right"}).fontSize(10).text("ENVÍO DE EQUIPOS A SERVICIO TÉCNICO",{align:"right"}).moveDown(.25);rule();
 doc.fillColor(gray).font("Helvetica").fontSize(9).text("N° de orden: OT-"+technicalOrderNumber(row.numero_ot),{continued:true}).text("    Fecha: "+serviceDateOnly(row.fecha_envio),{align:"right"});
 section("1. ANTECEDENTES GENERALES");field("Área solicitante",row.area_solicitante??"Área TI — Aguas San Isidro");field("Responsable TI",row.responsable_envio);field("Tipo de servicio",serviceType(row.tipo_servicio));rule();
 section("2. SERVICIO TÉCNICO");field("Empresa",row.proveedor??"");field("Contacto",row.contacto_servicio??"");rule();
 section("3. IDENTIFICACIÓN DE LOS EQUIPOS");
 doc.rect(doc.x,doc.y,doc.page.width-doc.page.margins.left-doc.page.margins.right,20).fillAndStroke("#EAF2F8",line).fillColor(navy).font("Helvetica-Bold").fontSize(8).text("N°     Tipo de equipo          Marca / modelo                 IMEI o serie                 Usuario asignado / Área",doc.x+5,doc.y+6);doc.moveDown(1.55);
 const identifier=row.imei??row.numero_serie??"";const holder=row.colaborador_nombre_al_ingreso??row.departamento_nombre_al_ingreso??"";
 doc.fillColor(gray).font("Helvetica").fontSize(8).text(`1      ${row.tipo_dispositivo}          ${[row.marca,row.modelo].filter(Boolean).join(" ")}                 ${identifier}                 ${holder}`);rule();
 section("4. CONDICIONES DE ENTREGA POR EQUIPO");
 doc.rect(doc.x,doc.y,doc.page.width-doc.page.margins.left-doc.page.margins.right,20).fillAndStroke("#EAF2F8",line).fillColor(navy).font("Helvetica-Bold").fontSize(8).text("N°     Falla o problema reportado                                      Accesorios entregados / Observaciones",doc.x+5,doc.y+6);doc.moveDown(1.55);
 doc.fillColor(gray).font("Helvetica").fontSize(8).text("1      "+row.falla_reportada).text("       "+(row.accesorios_entregados??"")).text("       "+(row.observaciones_envio??""));rule();
 section("5. RECEPCIÓN Y DEVOLUCIÓN (INTERNO)");field("Fecha de recepción",serviceDateOnly(row.fecha_envio));field("N° OT / ticket proveedor","");field("Diagnóstico y plazo informado",[row.diagnostico,row.plazo_informado].filter(Boolean).join(" — "));field("Fecha de devolución",row.fecha_retorno?serviceDateOnly(row.fecha_retorno):"");field("Estado final",finalState(row.estado_final));field("Resultado / observaciones de retorno",[row.resultado,row.observaciones_retorno].filter(Boolean).join(" — "));rule();
 section("6. FIRMAS");doc.fillColor(gray).font("Helvetica").fontSize(8).text("RECEPCIÓN EN SERVICIO TÉCNICO",{continued:true}).text("RECEPCIÓN POST SERVICIO — ÁREA TI",{align:"right"}).moveDown(2).text("____________________________",{continued:true}).text("                         ____________________________",{align:"right"}).text("Firma / representante del servicio técnico                 Firma / Responsable TI — Aguas San Isidro").moveDown(.4).text("Nombre: ____________________________",{continued:true}).text("        Nombre: ____________________________",{align:"right"}).text("Fecha: ______________________________",{continued:true}).text("        Fecha: ______________________________",{align:"right"});
 doc.moveDown(2).fillColor(gray).fontSize(8).text("Área TI — Aguas San Isidro | Formulario TI-OT | v1.0",{align:"center"});
 doc.end();return{buffer:await done,filename:"ST-"+technicalOrderNumber(row.numero_ot)+"-envio.pdf"};
};

const generarEnvioServicioPdfLegacy2=async(id:number,client?:PoolClient)=>{
 const row=await obtenerOrden(id,client);if(!row)throw new NotFoundError("Orden de servicio no encontrada.");
 const doc=new PDFDocument({size:"A4",margin:36,info:{Title:"Orden de Trabajo Servicio Técnico OT-"+technicalOrderNumber(row.numero_ot)}});const chunks:Buffer[]=[];
 doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));const done=new Promise<Buffer>((resolve,reject)=>{doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject)});
 const navy="#123B6D",line="#CBD5E1",gray="#334155",muted="#64748B",pageWidth=doc.page.width-doc.page.margins.left-doc.page.margins.right;
 const textValue=(value:unknown,blank="____________________________")=>typeof value==="string"&&value.trim()?value.trim():blank;
 const moneyValue=(value:number)=>`$${value.toLocaleString("es-CL")}`;
 const serviceLabels:Record<string,string>={GARANTIA:"Garantía",REPARACION:"Reparación",MANTENCION:"Mantención",DIAGNOSTICO:"Diagnóstico"};
 const serviceType=(value:string)=>Object.entries(serviceLabels).map(([key,label])=>`${key===value?"[x]":"[ ]"} ${label}`).join("    ");
 const finalState=(value:string|null)=>["OPERATIVO","SIN_REPARACION","BAJA"].map(key=>`${key===value?"[x]":"[ ]"} ${key==="OPERATIVO"?"Operativo":key==="SIN_REPARACION"?"Sin reparación":"Baja"}`).join("    ");
 const section=(title:string)=>{doc.moveDown(.45);const y=doc.y;doc.rect(doc.page.margins.left,y,pageWidth,18).fill(navy);doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(9).text(title,doc.page.margins.left+6,y+5,{width:pageWidth-12});doc.y=y+22;};
 const drawTable=(headers:string[],rows:string[][],widths:number[])=>{
  const drawRow=(values:string[],y:number,header:boolean)=>{const height=Math.max(header?22:18,...values.map((value,index)=>doc.heightOfString(value||" ",{width:widths[index]-8})+8));let x=doc.page.margins.left;values.forEach((value,index)=>{doc.rect(x,y,widths[index],height).fillAndStroke(header?navy:"#FFFFFF",line);doc.fillColor(header?"#FFFFFF":gray).font(header?"Helvetica-Bold":"Helvetica").fontSize(header?7:7.2).text(value||" ",x+4,y+4,{width:widths[index]-8,height:height-6,ellipsis:false});x+=widths[index];});return height;};
  let y=doc.y;y+=drawRow(headers,y,true);for(const values of rows)y+=drawRow(values,y,false);doc.y=y;return y;
 };
 const logoPath=resolve(__dirname,"../../../../frontend/public/assets/brand/itam-logo.png");const headerY=36;if(existsSync(logoPath))doc.image(logoPath,doc.page.margins.left,headerY,{width:42});
 doc.fillColor(navy).font("Helvetica-Bold").fontSize(15).text("AGUAS SAN ISIDRO",doc.page.margins.left+52,headerY+4);doc.fontSize(17).text("ORDEN DE TRABAJO",300,headerY+1,{width:doc.page.width-336,align:"right"});doc.fontSize(9).text("ENVÍO DE EQUIPOS A SERVICIO TÉCNICO",300,headerY+24,{width:doc.page.width-336,align:"right"});
 const headerBottom=headerY+52;doc.strokeColor("#38BDF8").lineWidth(2).moveTo(doc.page.margins.left,headerBottom).lineTo(doc.page.width-doc.page.margins.right,headerBottom).stroke();doc.y=headerBottom+8;doc.fillColor(gray).font("Helvetica").fontSize(8).text("N° de orden: OT-"+technicalOrderNumber(row.numero_ot),{continued:true}).text("Fecha: "+serviceDateOnly(row.fecha_envio),{align:"right"});
 section("1. ANTECEDENTES GENERALES");drawTable(["Campo","Detalle"],[["Área solicitante",textValue(row.area_solicitante,"Área TI - Aguas San Isidro")],["Responsable TI",textValue(row.responsable_envio)],["Tipo de servicio",serviceType(row.tipo_servicio)]],[128,pageWidth-128]);
 section("2. SERVICIO TÉCNICO");drawTable(["Campo","Detalle"],[["Empresa",textValue(row.proveedor)],["Contacto",textValue(row.contacto_servicio)]],[128,pageWidth-128]);
 section("3. IDENTIFICACIÓN DE LOS EQUIPOS");drawTable(["N°","Tipo de equipo","Marca","Modelo","IMEI o serie","Usuario asignado / Área"],[["1",textValue(row.tipo_dispositivo,"-"),textValue(row.marca,"-"),textValue(row.modelo,"-"),textValue(row.imei??row.numero_serie,"-"),textValue(row.colaborador_nombre_al_ingreso??row.departamento_nombre_al_ingreso??row.area_solicitante,"-")]], [25,84,82,96,110,pageWidth-397]);
 section("4. CONDICIONES DE ENTREGA POR EQUIPO");drawTable(["N°","Falla o problema reportado","Accesorios entregados","Observaciones"],[["1",textValue(row.falla_reportada,"-"),textValue(row.accesorios_entregados,"-"),textValue(row.observaciones_envio,"-")]], [25,220,128,pageWidth-373]);
 section("5. RECEPCIÓN Y DEVOLUCIÓN (INTERNO)");const reviewFinalized=["CERRADA","BAJA","REPARACION_RECHAZADA"].includes(row.estado);const diagnostic=row.diagnostico&&row.plazo_informado?[row.diagnostico,row.plazo_informado].join(" - "):row.diagnostico??"";drawTable(["Campo","Detalle"],[["Fecha de recepción",serviceDateOnly(row.fecha_envio)],["N° OT / ticket proveedor",textValue(row.ticket_proveedor)],["Diagnóstico y plazo informado",reviewFinalized||row.diagnostico?textValue(diagnostic):"____________________________"],["Costo cotizado",row.monto_cotizacion===null?"____________________________":moneyValue(Number(row.monto_cotizacion))],["Observaciones de cotización",textValue(row.observaciones_cotizacion)],["Fecha de devolución",row.fecha_retorno?serviceDateOnly(row.fecha_retorno):"____________________________"],["Estado final",finalState(row.estado_final)],["Resultado / observaciones de retorno",reviewFinalized?textValue([row.resultado,row.observaciones_retorno].filter(Boolean).join(" - ")):"____________________________"]],[190,pageWidth-190]);
 section("6. FIRMAS");const signatureY=doc.y,signatureGap=24,signatureWidth=(pageWidth-signatureGap)/2;const signature=(x:number,title:string,role:string)=>{doc.fillColor(gray).font("Helvetica-Bold").fontSize(7.5).text(title,x,signatureY,{width:signatureWidth,align:"center"});doc.strokeColor(line).lineWidth(1).moveTo(x+12,signatureY+30).lineTo(x+signatureWidth-12,signatureY+30).stroke();doc.fillColor(muted).font("Helvetica").fontSize(7).text(role,x,signatureY+35,{width:signatureWidth,align:"center"});doc.text("Nombre: __________________________",x,signatureY+54,{width:signatureWidth,align:"center"});doc.text("Fecha: ___________________________",x,signatureY+70,{width:signatureWidth,align:"center"});};signature(doc.page.margins.left,"RECEPCIÓN EN SERVICIO TÉCNICO","Representante del servicio técnico");signature(doc.page.margins.left+signatureWidth+signatureGap,"RECEPCIÓN POST SERVICIO - ÁREA TI","Responsable TI - Aguas San Isidro");doc.y=signatureY+91;doc.fillColor(muted).font("Helvetica").fontSize(7).text("Área TI - Aguas San Isidro | Formulario TI-OT | v1.0",{align:"center"});
 doc.end();return{buffer:await done,filename:"ST-"+technicalOrderNumber(row.numero_ot)+"-envio.pdf"};
};

export const generarEnvioServicioPdf=async(id:number,client?:PoolClient)=>{
 const row=await obtenerOrden(id,client);if(!row)throw new NotFoundError("Orden de servicio no encontrada.");
 return buildTechnicalOrderPdf(row);
};

export const registrarCotizacion=async(id:number,input:CotizacionInput)=>{
 const client=await pool.connect();try{await client.query("BEGIN");const current=await obtenerOrden(id,client);
  if(!current)throw new NotFoundError("Orden de servicio no encontrada.");
  if(current.estado!=="PENDIENTE_DIAGNOSTICO")throw new ConflictError("La orden no admite una nueva cotización.");
  await client.query(`UPDATE itam.ordenes_servicio_tecnico SET diagnostico=$2,descripcion_reparacion=$3,
    monto_cotizacion=$4,plazo_informado=$5,ticket_proveedor=$6,observaciones_cotizacion=$7,
    proveedor=COALESCE($8,proveedor),estado='COTIZACION_RECIBIDA' WHERE id=$1`,
    [id,input.diagnostico,input.descripcionReparacion,input.montoCotizacion,input.plazoInformado??null,input.ticketProveedor??null,input.observacionesCotizacion??null,input.proveedor??null]);
  await insertarHistorialDispositivo(current.dispositivo_id,"COTIZACION_SERVICIO_TECNICO_REGISTRADA",null,null,input.responsable,
    "Cotización de servicio técnico registrada para el equipo.",{ordenServicioId:id,montoCotizacion:input.montoCotizacion,descripcionReparacion:input.descripcionReparacion,plazoInformado:input.plazoInformado??null,ticketProveedor:input.ticketProveedor??null,proveedor:input.proveedor??current.proveedor},client);
  const row=await obtenerOrden(id,client);await client.query("COMMIT");return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};

export const guardarCotizacionArchivo=async(id:number,documento:CotizacionArchivoAlmacenado,responsable:string)=>{
 const client=await pool.connect();let persisted=false;try{await client.query("BEGIN");const current=await obtenerOrdenParaActualizar(id,client);
  if(!current)throw new NotFoundError("No existe la revisión técnica indicada.");
  if(["CERRADA","BAJA","REPARACION_RECHAZADA"].includes(current.estado))throw new ConflictError("La revisión técnica ya se encuentra finalizada y no permite reemplazar la cotización.");
  const previous=await obtenerCotizacionArchivo(id,client);const version=(previous?.version??0)+1;
  if(previous)await client.query("UPDATE itam.servicio_tecnico_cotizaciones_archivos SET activo=FALSE WHERE id=$1",[previous.id]);
  const inserted=await client.query<CotizacionArchivoRow>(`INSERT INTO itam.servicio_tecnico_cotizaciones_archivos
    (orden_servicio_tecnico_id,dispositivo_id,proveedor,nombre_original,nombre_archivo,mime_type,tamanio_bytes,ruta_archivo,version,activo,subido_por)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,$10) RETURNING *`,
    [id,current.dispositivo_id,current.proveedor,documento.nombreOriginal,documento.nombreArchivo,documento.mimeType,documento.tamanioBytes,documento.rutaArchivo,version,responsable]);
  await insertarHistorialDispositivo(current.dispositivo_id,previous?"COTIZACION_SERVICIO_TECNICO_REEMPLAZADA":"COTIZACION_SERVICIO_TECNICO_REGISTRADA",null,null,responsable,
    previous?"Cotización de servicio técnico reemplazada por corrección o nueva versión del proveedor.":"Cotización de servicio técnico registrada para el equipo.",
    {ordenServicioId:id,archivoId:inserted.rows[0]!.id,nombreOriginal:documento.nombreOriginal,version,proveedor:current.proveedor,montoCotizacion:current.monto_cotizacion,ticketProveedor:current.ticket_proveedor},client);
  const row=await obtenerOrden(id,client);
  await client.query("COMMIT");persisted=true;return mapOrden(row!);
 }catch(error){await client.query("ROLLBACK");if(!persisted)await removeTechnicalQuoteFile(documento.rutaArchivo);throw error}finally{client.release()}
};

export const obtenerArchivoCotizacion=async(id:number)=>{
 const row=await obtenerCotizacionArchivo(id);if(!row)throw new NotFoundError("La revisión no tiene una cotización adjunta.");
 const absolutePath=resolveTechnicalQuoteFilePath(row.ruta_archivo);try{const file=await stat(absolutePath);if(!file.isFile()||file.size!==Number(row.tamanio_bytes))throw new Error("Archivo inconsistente.");}catch{throw new NotFoundError("El archivo de cotización no está disponible.");}
 return {absolutePath,nombreOriginal:row.nombre_original,mimeType:row.mime_type,tamanioBytes:Number(row.tamanio_bytes)};
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
  if(!current)throw new NotFoundError("No existe la revisión técnica indicada.");
  if(["CERRADA","BAJA","REPARACION_RECHAZADA"].includes(current.estado))throw new ConflictError("La revisión técnica ya se encuentra finalizada.");
  if(!current.diagnostico)throw new ConflictError("Debe registrar diagnóstico antes de finalizar la revisión.");
  if(current.estado!=="COTIZACION_RECIBIDA"&&! ["REPARACION_APROBADA","EN_REPARACION","REPARACION_TERMINADA"].includes(current.estado))throw new ConflictError("La orden no puede cerrarse en su estado actual.");
  const temporalAbierto=await client.query(`SELECT id FROM itam.entregas_temporales_servicio WHERE orden_servicio_id=$1 AND estado='ABIERTA' LIMIT 1`,[id]);
  if(temporalAbierto.rows[0])throw new ConflictError("Debe registrar la devolución del equipo temporal antes de cerrar la orden.");
  const fechaRetorno=parseFechaRetorno(input.fechaRetorno);
  if(!fechaRetorno)throw new ValidationError("Debe ingresar fecha de retorno.");
  const device=await obtenerDispositivoPorCodigo(current.codigo_inventario,client);if(!device)throw new NotFoundError("Dispositivo no encontrado.");
  let targetCode:string;
  let targetStateId:string|null=null;
  if(input.estadoFinal==="BAJA"){
    await darDeBajaDispositivo(current.codigo_inventario,{motivo:"REPARACION_NO_CONVENIENTE",responsable:input.responsable,observaciones:input.observacionesRetorno},client,{ordenServicioMotivo:"REPARACION_NO_CONVENIENTE"});
    targetCode="DADO_BAJA";
    const bajaState=await obtenerEstadoDispositivoPorCodigo(targetCode,client);
    targetStateId=bajaState?.id??null;
  }else{
    targetCode=input.estadoFinal==="OPERATIVO"?(device.colaborador_id||device.departamento_id?"ASIGNADO":"DISPONIBLE"):"RETENIDO_REVISION";
    if(targetCode==="ASIGNADO")assertAsignadoConCustodioUnico(device.colaborador_id,device.departamento_id);
    const target=await obtenerEstadoDispositivoPorCodigo(targetCode,client);if(!target)throw new ConflictError(`No existe el estado ${targetCode}.`);
    await cambiarEstadoDispositivo(current.codigo_inventario,Number(target.id),client);
    targetStateId=target.id;
    await insertarHistorialDispositivo(current.dispositivo_id,"RETORNO_POST_SERVICIO_TECNICO",device.estado_id,target.id,input.responsable,input.resultado,
      {ordenServicioId:id,costoFinal:input.costoFinal,fechaRetorno:fechaRetorno,estadoFinal:input.estadoFinal,
      custodioAlIngreso:{tipo:current.custodio_tipo_al_ingreso,colaboradorId:current.colaborador_id_al_ingreso,departamentoId:current.departamento_id_al_ingreso},
      retornoAlMismoCustodio:Boolean(device.colaborador_id||device.departamento_id)},client);
  }
  await insertarHistorialDispositivo(current.dispositivo_id,"SERVICIO_TECNICO_FINALIZADO",device.estado_id,targetStateId,input.responsable,
    "Servicio técnico finalizado.",{ordenServicioId:id,costoFinal:input.costoFinal,resultado:input.resultado,estadoFinal:input.estadoFinal,fechaRetorno},client);
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
