import PDFDocument from "pdfkit";
import { consultarMovimientosReporte,consultarOrganizacionReporte,consultarResumenReporte } from "./reportes.repository";
import type { ReporteInventario } from "./reportes.types";

const n=(value:unknown)=>Number(value??0);
export const obtenerReporteInventario=async(desde:string,hasta:string):Promise<ReporteInventario>=>{
 const [r,m,o]=await Promise.all([consultarResumenReporte(),consultarMovimientosReporte(desde,hasta),consultarOrganizacionReporte()]);
 return {periodo:{desde,hasta},generadoEn:new Date().toISOString(),resumen:{
  total:{cantidad:n(r.cantidad_total),valor:n(r.valor_total)},disponibles:{cantidad:n(r.cantidad_disponible),valor:n(r.valor_disponible)},
  asignados:{cantidad:n(r.cantidad_asignada),valor:n(r.valor_asignado)},asignadosColaboradores:{cantidad:n(r.cantidad_colaborador),valor:n(r.valor_colaborador)},
  asignadosDepartamentos:{cantidad:n(r.cantidad_departamento),valor:n(r.valor_departamento)},servicioTecnico:{cantidad:n(r.cantidad_servicio),valor:n(r.valor_servicio)},
  extraviados:{cantidad:n(r.cantidad_extraviada),valor:n(r.valor_extraviado)},bajas:{cantidad:n(r.cantidad_baja),valor:n(r.valor_baja)}
 },movimientos:{registrados:n(m.registrados),asignaciones:n(m.asignaciones),devoluciones:n(m.devoluciones),enviosServicioTecnico:n(m.envios_servicio),retornosServicioTecnico:n(m.retornos_servicio),bajas:n(m.bajas)},
 organizacion:o.map((row)=>({departamentoId:String(row.departamento_id),departamento:String(row.departamento),dependencia:row.dependencia?String(row.dependencia):null,cantidad:n(row.cantidad),valor:n(row.valor)}))};
};
const money=(value:number)=>new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0}).format(value);
export const generarReporteInventarioPdf=async(desde:string,hasta:string)=>{
 const reporte=await obtenerReporteInventario(desde,hasta);const doc=new PDFDocument({size:"A4",margin:48,info:{Title:"Reporte de Inventario TI"}});const chunks:Buffer[]=[];
 doc.on("data",chunk=>chunks.push(Buffer.from(chunk)));const done=new Promise<Buffer>((resolve,reject)=>{doc.on("end",()=>resolve(Buffer.concat(chunks)));doc.on("error",reject)});
 doc.fillColor("#03045E").fontSize(16).font("Helvetica-Bold").text("EMPRESA DE SERVICIOS SANITARIOS SAN ISIDRO",{align:"center"});
 doc.fontSize(12).text("ITAM v3.0 · Reporte de Inventario TI",{align:"center"}).moveDown(.4).fontSize(9).font("Helvetica").fillColor("#334155").text(`Periodo: ${desde} al ${hasta} · Generado: ${new Date(reporte.generadoEn).toLocaleString("es-CL")}`,{align:"center"}).moveDown(1.5);
 doc.fillColor("#03045E").font("Helvetica-Bold").fontSize(11).text("RESUMEN");doc.moveDown(.5);
 for(const [label,item] of [["Total",reporte.resumen.total],["Disponibles",reporte.resumen.disponibles],["Asignados",reporte.resumen.asignados],["Servicio Técnico",reporte.resumen.servicioTecnico],["Extraviados",reporte.resumen.extraviados],["Dados de baja",reporte.resumen.bajas]] as const){doc.fillColor("#1E293B").font("Helvetica").fontSize(9).text(`${label}: ${item.cantidad} activos · ${money(item.valor)}`)}
 doc.moveDown().fillColor("#03045E").font("Helvetica-Bold").fontSize(11).text("MOVIMIENTOS DEL PERÍODO").moveDown(.5).fillColor("#1E293B").font("Helvetica").fontSize(9);
 doc.text(`Altas: ${reporte.movimientos.registrados} · Asignaciones: ${reporte.movimientos.asignaciones} · Devoluciones: ${reporte.movimientos.devoluciones}`);
 doc.text(`Envíos ST: ${reporte.movimientos.enviosServicioTecnico} · Retornos ST: ${reporte.movimientos.retornosServicioTecnico} · Bajas: ${reporte.movimientos.bajas}`);
 doc.moveDown().fillColor("#03045E").font("Helvetica-Bold").fontSize(11).text("ORGANIZACIÓN (INCLUYE DESCENDIENTES)").moveDown(.5);
 for(const item of reporte.organizacion.filter(item=>item.cantidad>0)){if(doc.y>740)doc.addPage();doc.fillColor("#1E293B").font("Helvetica").fontSize(8).text(`${item.departamento}: ${item.cantidad} activos · ${money(item.valor)}`)}
 doc.end();return{buffer:await done,filename:`reporte-itam-${desde}-${hasta}.pdf`};
};
