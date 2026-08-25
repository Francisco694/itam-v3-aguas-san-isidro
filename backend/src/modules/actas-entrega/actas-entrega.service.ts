import PDFDocument from "pdfkit";
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

const mapActa=(row:ActaRow,details:ActaDetalleRow[])=>({id:row.id,numeroActa:row.numero_acta,
 colaborador:row.colaborador_id?{id:row.colaborador_id,nombre:row.colaborador_nombre!,rut:row.colaborador_rut!,cargo:row.colaborador_cargo}:null,
 departamento:row.departamento_id?{id:row.departamento_id,nombre:row.departamento_nombre!}:null,
 recepcionante:row.recepcionante_id?{id:row.recepcionante_id,nombre:row.recepcionante_nombre!,rut:row.recepcionante_rut!,cargo:row.recepcionante_cargo}:null,
 localidad:row.localidad,fecha:toIsoDateTime(row.fecha),estado:row.estado,responsableTi:row.responsable_ti,
 observaciones:row.observaciones,declaracion:row.declaracion,valorTotal:details.reduce((sum,d)=>sum+Number(d.valor_comercial),0),
 estadoDocumental:row.estado==='ANULADA'?'ANULADA':details.every(d=>d.comprobante_id||d.devuelto_historico)?'CERRADA':details.some(d=>d.comprobante_id||d.devuelto_historico)?'DEVOLUCION_PARCIAL':'VIGENTE',
 dispositivos:details.map(d=>({id:d.dispositivo_id,codigoInventario:d.codigo_inventario,tipo:d.tipo_dispositivo,
  marca:d.marca,modelo:d.modelo,numeroSerie:d.numero_serie,imei:d.imei,valorComercial:Number(d.valor_comercial),
  devuelto:Boolean(d.comprobante_id||d.devuelto_historico),devolucion:d.comprobante_id?{id:d.comprobante_id,numeroComprobante:d.numero_comprobante!,fecha:toIsoDateTime(d.fecha_devolucion!),resultado:d.resultado_devolucion!}:null})),
 creadoEn:toIsoDateTime(row.creado_en),actualizadoEn:toIsoDateTime(row.actualizado_en)});

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
 const acta=await obtenerActaEntrega(id);const doc=new PDFDocument({size:"A4",margin:48,info:{Title:`Acta ${acta.numeroActa}`}});const chunks:Buffer[]=[];
 doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));const done=new Promise<Buffer>((resolve,reject)=>{doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject)});
 doc.fontSize(16).fillColor("#03045E").text("AGUAS SAN ISIDRO",{align:"center"});doc.fontSize(10).text("Departamento de Tecnología",{align:"center"});
 doc.moveDown().fontSize(15).text("ACTA DE ENTREGA DE EQUIPOS",{align:"center"});doc.fontSize(10).fillColor("#111827").text(`N° ${acta.numeroActa}`,{align:"center"});
 doc.moveDown().text(`Fecha: ${new Date(acta.fecha).toLocaleDateString("es-CL")}    Localidad: ${acta.localidad??"—"}`);
 const person=acta.colaborador??acta.recepcionante;doc.moveDown().fontSize(12).fillColor("#03045E").text("FUNCIONARIO RESPONSABLE");doc.fontSize(10).fillColor("#111827").text(`Nombre: ${person?.nombre??"—"}\nRUT: ${person?.rut??"—"}\nCargo: ${person?.cargo??"—"}\nDepartamento: ${acta.departamento?.nombre??"—"}`);
 doc.moveDown().fontSize(12).fillColor("#03045E").text("EQUIPOS ENTREGADOS");doc.fontSize(9).fillColor("#111827");for(const device of acta.dispositivos){doc.moveDown(.4).text(`${device.codigoInventario} · ${device.tipo} · ${device.marca??"—"} ${device.modelo??""}\nSerie: ${device.numeroSerie??"—"} · IMEI: ${device.imei??"—"} · ${clp(device.valorComercial)}`)}
 doc.moveDown().fontSize(12).text(`VALOR COMERCIAL TOTAL: ${clp(acta.valorTotal)}`);
 doc.moveDown().fontSize(11).fillColor("#03045E").text("INFORMACIÓN IMPORTANTE / DECLARACIÓN DEL FUNCIONARIO");doc.fontSize(8.7).fillColor("#111827").text(acta.declaracion??"—",{align:"justify",lineGap:1.5});
 if(doc.y>doc.page.height-125){doc.addPage();}
 doc.moveDown(3).text("____________________________                  ____________________________",{align:"center"});doc.text("Firma funcionario                                      Firma responsable TI",{align:"center"});doc.end();return{buffer:await done,filename:`${acta.numeroActa}.pdf`};
};
