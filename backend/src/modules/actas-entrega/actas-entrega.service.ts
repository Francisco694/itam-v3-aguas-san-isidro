import PDFDocument from "pdfkit";
import {existsSync} from "node:fs";
import {resolve} from "node:path";
import {pool} from "../../config/database";
import {ConflictError,NotFoundError,ValidationError} from "../../shared/errors";
import {toIsoDateTime} from "../../shared/dates";
import {obtenerColaboradorPorId} from "../colaboradores/colaboradores.repository";
import {obtenerDepartamentoPorId} from "../departamentos/departamentos.repository";
import {insertarHistorialDispositivo,obtenerDispositivoPorCodigo} from "../dispositivos/dispositivos.repository";
import {listarActas,listarDetalleActa,obtenerActa} from "./actas-entrega.repository";
import type {ActaDetalleRow,ActaRow,CrearActaInput} from "./actas-entrega.types";

export const DECLARACION_OBLIGATORIA_TRABAJADOR = `El trabajador declara saber que:

- El equipo que aquí se entrega es y será de la empresa en todo momento
  En caso de renuncia del trabajador o desvinculación del trabajador por alguna de las causales legales que den termino al
  contrato de trabajo, según código del trabajo, el trabajador individualizado debe hacer entrega del equipo asignado en este acto
  y su accesorio al término de la relación laboral.
- Debe prestar un buen uso y cuidado a las herramientas de trabajo entregadas por la empresa
- En caso de perdida, robo, hurto, se debe realizar la denuncia ante las autoridades competente (Carabineros o PDI), para
  acreditar que la perdida, no recae en la voluntad del trabajador.
- En caso de perdida, robo, hurto, mal uso o descuido de la herramienta entregada en este acto, el funcionario responsable
  deberá dar aviso al departamento de RRHH para que realicen el bloqueo respectivo del equipo.
  Se establece que la herramienta de trabajo entregada en este acto, son de uso exclusivo del trabajador individualizado, para
  efectuar las funciones de acuerdo con su cargo según contrato de trabajo.
- Tomo conocimiento que las aplicaciones autorizadas por la Empresa son: CAPSI (capturador de Aguas San Isidro), OPSI
  (operación San Isidro), enviar mensaje de texto de la empresa y telemetría, llamadas ilimitadas a la familia móvil, usar
  Whatsapp.
  El trabajador que use el servicios de datos o llamadas telefónicas mediante el aparato celular entregado por la empresa, que
  excedan el plan contratado por la empleadora, utilizado el aparato celular para asuntos personales y en nada vinculado a las
  funciones convenida en el contrato de trabajo, será contabilizado mensualmente y será informado para las respectivas
  sanciones y descuentos que deberá ser asumido por el trabajador y le será descontado de su remuneración, a efectos de lo
  dispuesto en dicho procedimiento, pudiendo el trabajador solicitar el pago en cuotas.`;

const mapActa=(row:ActaRow,details:ActaDetalleRow[])=>{const departamentoId=row.departamento_id??row.colaborador_departamento_id;return {id:row.id,numeroActa:row.numero_acta,
 colaborador:row.colaborador_id?{id:row.colaborador_id,nombre:row.colaborador_nombre!,rut:row.colaborador_rut!,cargo:row.colaborador_cargo}:null,
 departamento:departamentoId?{id:departamentoId,nombre:row.departamento_nombre!}:null,
 recepcionante:row.recepcionante_id?{id:row.recepcionante_id,nombre:row.recepcionante_nombre!,rut:row.recepcionante_rut!,cargo:row.recepcionante_cargo}:null,
 localidad:row.localidad,fecha:toIsoDateTime(row.fecha),estado:row.estado,responsableTi:row.responsable_ti,
 observaciones:row.observaciones,declaracion:row.declaracion,valorTotal:details.reduce((sum,d)=>sum+Number(d.valor_comercial),0),
 estadoDocumental:row.estado==='ANULADA'?'ANULADA':details.every(d=>d.comprobante_id||d.devuelto_historico)?'CERRADA':details.some(d=>d.comprobante_id||d.devuelto_historico)?'DEVOLUCION_PARCIAL':'VIGENTE',
 dispositivos:details.map(d=>({id:d.dispositivo_id,codigoInventario:d.codigo_inventario,tipo:d.tipo_dispositivo,
  marca:d.marca,modelo:d.modelo,numeroSerie:d.numero_serie,imei:d.imei,valorComercial:Number(d.valor_comercial),
  devuelto:Boolean(d.comprobante_id||d.devuelto_historico),devolucion:d.comprobante_id?{id:d.comprobante_id,numeroComprobante:d.numero_comprobante!,fecha:toIsoDateTime(d.fecha_devolucion!),resultado:d.resultado_devolucion!}:null})),
 creadoEn:toIsoDateTime(row.creado_en),actualizadoEn:toIsoDateTime(row.actualizado_en)};};

export const obtenerActas=async()=>Promise.all((await listarActas()).map(async row=>mapActa(row,await listarDetalleActa(Number(row.id)))));
export const obtenerActaEntrega=async(id:number)=>{const row=await obtenerActa(id);if(!row)throw new NotFoundError("Acta no encontrada.");return mapActa(row,await listarDetalleActa(id))};

export const crearActaEntrega=async(input:CrearActaInput)=>{
 if((input.colaboradorId?1:0)+(input.departamentoId?1:0)!==1)throw new ValidationError("Informe colaborador o departamento, no ambos.");
 if(input.departamentoId&&!input.recepcionanteId)throw new ValidationError("La persona que recepciona es obligatoria para un departamento.");
 if(!input.dispositivosCodigos.length)throw new ValidationError("El acta requiere al menos un dispositivo.");
 const client=await pool.connect();try{await client.query("BEGIN");
  let collaborator=null;let department=null;let receiver=null;
  if(input.colaboradorId){collaborator=await obtenerColaboradorPorId(input.colaboradorId);if(!collaborator)throw new NotFoundError("Colaborador no encontrado.");}
  if(input.departamentoId){department=await obtenerDepartamentoPorId(input.departamentoId);if(!department)throw new NotFoundError("Departamento no encontrado.");receiver=await obtenerColaboradorPorId(input.recepcionanteId!);if(!receiver||receiver.departamento_id!==department.id)throw new ValidationError("El recepcionante debe pertenecer al departamento.");}
  const year=new Date().getFullYear();const seq=await client.query<{ultimo_numero:number}>(`INSERT INTO itam.secuencias_acta_entrega(anio,ultimo_numero)
   VALUES($1,1) ON CONFLICT(anio) DO UPDATE SET ultimo_numero=itam.secuencias_acta_entrega.ultimo_numero+1 RETURNING ultimo_numero`,[year]);
  const number=`AE-${year}-${String(seq.rows[0]!.ultimo_numero).padStart(6,"0")}`;
  const declaracion=input.colaboradorId?DECLARACION_OBLIGATORIA_TRABAJADOR:(input.declaracion??null);
  const inserted=await client.query<{id:string}>(`INSERT INTO itam.actas_entrega(numero_acta,colaborador_id,departamento_id,recepcionante_id,localidad,responsable_ti,observaciones,declaracion)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,[number,input.colaboradorId??null,input.departamentoId??null,input.recepcionanteId??null,input.localidad??null,input.responsableTi,input.observaciones??null,declaracion]);
  for(const code of [...new Set(input.dispositivosCodigos)]){const device=await obtenerDispositivoPorCodigo(code,client);if(!device)throw new NotFoundError(`Dispositivo ${code} no encontrado.`);
   if(input.colaboradorId&&Number(device.colaborador_id)!==input.colaboradorId)throw new ConflictError(`El dispositivo ${code} no está bajo custodia del colaborador.`);
   if(input.departamentoId&&Number(device.departamento_id)!==input.departamentoId)throw new ConflictError(`El dispositivo ${code} no está bajo custodia del departamento.`);
   await client.query(`INSERT INTO itam.actas_entrega_detalle(acta_entrega_id,dispositivo_id,codigo_inventario,tipo_dispositivo,marca,modelo,numero_serie,imei,valor_comercial)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[inserted.rows[0]!.id,device.dispositivo_id,device.dispositivo_codigo_inventario,device.tipo_dispositivo_nombre,device.marca,device.modelo,device.numero_serie,device.imei,device.valor_comercial]);
   await insertarHistorialDispositivo(device.dispositivo_id,"GENERAR_ACTA_ENTREGA",device.estado_id,device.estado_id,input.responsableTi,input.observaciones,{actaEntregaId:inserted.rows[0]!.id,numeroActa:number},client);
  }
  const row=await obtenerActa(Number(inserted.rows[0]!.id),client);const details=await listarDetalleActa(Number(inserted.rows[0]!.id),client);await client.query("COMMIT");return mapActa(row!,details);
 }catch(error){await client.query("ROLLBACK");throw error}finally{client.release()}
};

const clp=(value:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(value);
export const generarPdfActa=async(id:number):Promise<{buffer:Buffer;filename:string}>=>{
 const acta=await obtenerActaEntrega(id);
 const doc=new PDFDocument({size:"LETTER",margin:48,info:{Title:`Acta ${acta.numeroActa}`}});const chunks:Buffer[]=[];
 doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));const done=new Promise<Buffer>((resolve,reject)=>{doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject)});
 const left=doc.page.margins.left;const width=doc.page.width-doc.page.margins.left-doc.page.margins.right;const right=left+width;const bottom=doc.page.height-doc.page.margins.bottom;
 const teal="#0B7180";const dark="#111111";const labelSize=7.1;const columnGap=28;const columnWidth=(width-columnGap)/2;const rightColumn=left+columnWidth+columnGap;
 const value=(input:unknown,fallback="—")=>{const text=String(input??fallback).replace(/[ \t]+/g," ").trim();return text||fallback};
 const date=new Date(acta.fecha).toISOString().slice(0,10);const person=acta.colaborador??acta.recepcionante;const logoPath=resolve(__dirname,"../../assets/icono_doc.png");
 const field=(x:number,y:number,label:string,text:string,labelWidth=108)=>{doc.font("Helvetica-Bold").fontSize(labelSize).fillColor(dark).text(label,x,y,{width:labelWidth});doc.font("Helvetica").fontSize(labelSize).text(text,x+labelWidth,y,{width:columnWidth-labelWidth});};
 const section=(title:string,y:number)=>{doc.font("Helvetica-Bold").fontSize(7.8).fillColor(dark).text(title.toUpperCase(),left,y,{width});return y+13};
 const rule=(y:number)=>{doc.save().strokeColor(dark).lineWidth(.7).moveTo(left,y).lineTo(right,y).stroke().restore()};

 const headerY=doc.page.margins.top;
 if(existsSync(logoPath))doc.image(logoPath,left,headerY,{fit:[34,34]});
 doc.font("Helvetica-Bold").fontSize(11).fillColor(teal).text("Aguas San Isidro",left+43,headerY+8,{width:165});
 doc.font("Helvetica-Bold").fontSize(9.5).fillColor(dark).text(`${value(acta.localidad,"TEMUCO").toUpperCase()} - OFICINA CENTRAL`,left+210,headerY+2,{width:width-210,align:"right"});
 doc.font("Helvetica").fontSize(8.8).text(`${date}`,left+210,headerY+17,{width:width-210,align:"right"});
 doc.font("Helvetica-Bold").fontSize(9).text(`ACTA ENTREGA DE EQUIPOS N° ${acta.numeroActa}`,left+210,headerY+31,{width:width-210,align:"right"});
 rule(headerY+49);let y=headerY+66;

 y=section("Información importante : Acta de entrega de equipos",y);
 doc.font("Helvetica").fontSize(7.2).fillColor(dark).text("Mediante el presente documento se realiza entrega formal de HERRAMIENTA DE TRABAJO - EQUIPOS",left,y,{width});
 doc.text("COMPUTACIONALES / CELULARES, asignado para el cumplimiento de las tareas asignadas por el funcionario responsable.",left,y+9,{width});y+=25;

 y=section("Funcionario responsable",y);
 field(left,y,"Nombre funcionario:",value(person?.nombre));field(rightColumn,y,"Rut funcionario:",value(person?.rut),108);y+=14;
 field(left,y,"Localidad:",value(acta.localidad));field(rightColumn,y,"Cargo funcionario:",value(person?.cargo),108);y+=18;

 y=section("Equipos asignados",y);
 const devices=acta.dispositivos.length?acta.dispositivos:[null];
 for(const device of devices){
   field(left,y,"Teléfono/Número:",value(device?.numeroSerie??device?.codigoInventario));field(rightColumn,y,"IMEI :",value(device?.imei),108);y+=14;
   field(left,y,"Tipo equipos:",value(device?.tipo));field(rightColumn,y,"Descripción equipos:",value([device?.marca,device?.modelo].filter(Boolean).join(" ")),108);y+=14;
   field(left,y,"Accesorios:","—");field(rightColumn,y,"Compañía:",value(device?.marca),108);y+=16;
 }

 y=section("Valor comercial",y);
 field(left,y,"Valor comercial:",clp(acta.valorTotal));field(rightColumn,y,"Documento correspondiente:","—",132);y+=23;

 const signatureTop=bottom-78; y=section("El trabajador declara saber que:",y);
 const declaration=(acta.declaracion??"—").replace(/[ \t]+\n/g,"\n").replace(/\n{2,}/g,"\n");
 const available=Math.max(32,signatureTop-y-6);let declarationSize=7.2;let declarationHeight=0;
 for(const candidate of [7.2,6.8,6.4,6]){declarationSize=candidate;doc.font("Helvetica").fontSize(candidate);declarationHeight=doc.heightOfString(declaration,{width,lineGap:.25});if(declarationHeight<=available)break;}
 doc.font("Helvetica").fontSize(declarationSize).fillColor(dark).text(declaration,left,y,{width,lineGap:.25});

 const lineY=signatureTop+23;const signatureWidth=155;doc.save().strokeColor(dark).lineWidth(.7).moveTo(left+12,lineY).lineTo(left+12+signatureWidth,lineY).moveTo(right-12-signatureWidth,lineY).lineTo(right-12,lineY).stroke().restore();
 doc.font("Helvetica").fontSize(7.2).text(value(person?.nombre),left+12,lineY-18,{width:signatureWidth,align:"center"});doc.font("Helvetica").fontSize(7.2).text(value(person?.rut),left+12,lineY-9,{width:signatureWidth,align:"center"});doc.text("Firma trabajador",left+12,lineY+5,{width:signatureWidth,align:"center"});
 doc.text(value(acta.responsableTi,"Responsable TI"),right-12-signatureWidth,lineY-18,{width:signatureWidth,align:"center"});doc.text("Firma encargada entrega",right-12-signatureWidth,lineY+5,{width:signatureWidth,align:"center"});
 doc.font("Helvetica-Bold").fontSize(6.8).text("EMPLEADOR",left+signatureWidth+12,lineY-10,{width:width-2*signatureWidth-24,align:"center"});doc.font("Helvetica").fontSize(6.4).text("EMPRESA DE SERVICIOS SANITARIOS\nSAN ISIDRO S.A.",left+signatureWidth+12,lineY+2,{width:width-2*signatureWidth-24,align:"center"});
 doc.end();return{buffer:await done,filename:`${acta.numeroActa}.pdf`};
};
