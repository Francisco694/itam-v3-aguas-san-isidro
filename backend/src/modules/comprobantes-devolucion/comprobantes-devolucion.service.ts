import PDFDocument from "pdfkit";
import { toIsoDateTime } from "../../shared/dates";
import { NotFoundError } from "../../shared/errors";
import { listarComprobantes,obtenerComprobantePorId } from "./comprobantes-devolucion.repository";
import type { ComprobanteDevolucionRow } from "./comprobantes-devolucion.types";

export const mapComprobante=(row:ComprobanteDevolucionRow)=>({
 id:row.id,numeroComprobante:row.numero_comprobante,fecha:toIsoDateTime(row.fecha),
 resultado:row.resultado,condicion:row.condicion,observaciones:row.observaciones,
 responsableTi:row.responsable_ti,origen:row.origen,
 actaEntrega:row.acta_entrega_id?{id:row.acta_entrega_id,numeroActa:row.numero_acta!}:null,
 colaborador:row.colaborador_id?{id:row.colaborador_id,nombre:row.colaborador_nombre!,rut:row.colaborador_rut!}:null,
 departamento:row.departamento_id?{id:row.departamento_id,nombre:row.departamento_nombre!}:null,
 devueltoPor:row.devuelto_por_id?{id:row.devuelto_por_id,nombre:row.devuelto_por_nombre!,rut:row.devuelto_por_rut!}:null,
 dispositivo:{id:row.dispositivo_id,codigoInventario:row.codigo_inventario,tipo:row.tipo_dispositivo,
  marca:row.marca,modelo:row.modelo,numeroSerie:row.numero_serie,imei:row.imei},
 creadoEn:toIsoDateTime(row.creado_en)
});
export const obtenerComprobantes=async()=>(await listarComprobantes()).map(mapComprobante);
export const obtenerComprobante=async(id:number)=>{const row=await obtenerComprobantePorId(String(id));if(!row)throw new NotFoundError("Comprobante de devolución no encontrado.");return mapComprobante(row)};

export const generarPdfComprobante=async(id:number):Promise<{buffer:Buffer;filename:string}>=>{
 const comprobante=await obtenerComprobante(id);const doc=new PDFDocument({size:"A4",margin:52,info:{Title:`Comprobante ${comprobante.numeroComprobante}`}});const chunks:Buffer[]=[];
 doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));const done=new Promise<Buffer>((resolve,reject)=>{doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject)});
 doc.fontSize(17).fillColor("#03045E").text("AGUAS SAN ISIDRO",{align:"center"});doc.fontSize(10).fillColor("#0077B6").text("DEPARTAMENTO DE TI",{align:"center"});
 doc.moveDown(1.3).fontSize(15).fillColor("#03045E").text("COMPROBANTE DE DEVOLUCIÓN",{align:"center"});doc.fontSize(10).fillColor("#111827").text(`N° ${comprobante.numeroComprobante}`,{align:"center"});
 doc.moveDown(1.5).text(`Fecha y hora: ${new Date(comprobante.fecha).toLocaleString("es-CL")}`);doc.text(`Acta de entrega de origen: ${comprobante.actaEntrega?.numeroActa??"Sin acta asociada"}`);
 doc.moveDown().fontSize(12).fillColor("#03045E").text("PERSONA QUE DEVUELVE");doc.fontSize(10).fillColor("#111827");const person=comprobante.colaborador??comprobante.devueltoPor;
 doc.text(`Nombre: ${person?.nombre??"—"}`);doc.text(`RUT: ${person?.rut??"—"}`);doc.text(`Departamento custodio: ${comprobante.departamento?.nombre??"—"}`);
 doc.moveDown().fontSize(12).fillColor("#03045E").text("ACTIVO RECIBIDO");doc.fontSize(10).fillColor("#111827");doc.text(`Código ITAM: ${comprobante.dispositivo.codigoInventario}`);doc.text(`Tipo: ${comprobante.dispositivo.tipo}`);doc.text(`Marca / modelo: ${comprobante.dispositivo.marca??"—"} ${comprobante.dispositivo.modelo??""}`);doc.text(`Serie / IMEI: ${comprobante.dispositivo.numeroSerie??comprobante.dispositivo.imei??"—"}`);
 doc.moveDown().text(`Resultado: ${comprobante.resultado}`);doc.text(`Condición de recepción: ${comprobante.condicion??"Sin observaciones de condición"}`);doc.text(`Observaciones: ${comprobante.observaciones??"—"}`);doc.text(`Responsable TI que recibe: ${comprobante.responsableTi}`);
 doc.moveDown(4).text("____________________________                  ____________________________",{align:"center"});doc.text("Firma de quien entrega                              Firma responsable TI",{align:"center"});doc.end();return{buffer:await done,filename:`${comprobante.numeroComprobante}.pdf`};
};

