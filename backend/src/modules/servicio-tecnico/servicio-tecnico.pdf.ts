import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { OrdenServicioRow } from "./servicio-tecnico.types";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_LEFT = 28.3;
const MARGIN_RIGHT = 28.3;
const MARGIN_TOP = 29.1;
const MARGIN_BOTTOM = 14;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const BLUE = "#17365D";
const TEXT = "#404040";
const MUTED = "#666666";
const BORDER = "#CBD5E1";
const FOOTER = "Área TI - Aguas San Isidro | Formulario TI-OT | v1.0";

export interface OrdenEquipoPdf {
  codigoInventario?: number|string|null;
  tipo:string|null;
  marca:string|null;
  modelo:string|null;
  identificador:string|null;
  usuarioArea:string|null;
  falla:string|null;
  accesorios:string|null;
  observaciones:string|null;
}

type ExtendedOrdenServicioRow = OrdenServicioRow & {equipos?: OrdenEquipoPdf[]};

const value = (input:unknown):string => input === null || input === undefined ? "" : String(input).replace(/\u0000/g, "").trim();
const dateOnly = (input:Date|string|null):string => {
  if (!input) return "";
  if (typeof input === "string") {
    const match = input.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : input;
  }
  const parts = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Santiago", year:"numeric", month:"2-digit", day:"2-digit"}).formatToParts(input);
  const part = (type:string) => parts.find(item => item.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")}`;
};
const money = (input:string|number|null):string => input === null || input === undefined || input === "" ? "" : new Intl.NumberFormat("es-CL", {style:"currency", currency:"CLP", maximumFractionDigits:0}).format(Number(input));
const checked = (isChecked:boolean):string => isChecked ? "[x]" : "[ ]";

const serviceType = (selected:string):string => [
  ["GARANTIA", "Garantía"], ["REPARACION", "Reparación"], ["MANTENCION", "Mantención"], ["DIAGNOSTICO", "Diagnóstico"]
].map(([key, label]) => `${checked(key === selected)} ${label}`).join("  ");

const finalState = (selected:string|null):string => [
  ["OPERATIVO", "Operativo"], ["SIN_REPARACION", "Sin reparación"], ["BAJA", "Baja"]
].map(([key, label]) => `${checked(key === selected)} ${label}`).join("  ");

const logoPath = ():string|null => {
  const candidates = [
    process.env.ITAM_OT_LOGO_PATH,
    "E:\\portadada de aguas san isidro.jpg",
    resolve(__dirname, "../../../../frontend/public/assets/brand/aguas-san-isidro-oficial.jpg")
  ].filter((candidate):candidate is string => Boolean(candidate));
  return candidates.find(candidate => existsSync(candidate)) ?? null;
};

const fontPaths = () => ({
  regular: [process.env.ITAM_OT_FONT_REGULAR, "C:\\Windows\\Fonts\\arial.ttf"].filter(Boolean).find(path => existsSync(path!)) ?? null,
  bold: [process.env.ITAM_OT_FONT_BOLD, "C:\\Windows\\Fonts\\arialbd.ttf"].filter(Boolean).find(path => existsSync(path!)) ?? null
});

export const buildTechnicalOrderPdf = async (row:ExtendedOrdenServicioRow):Promise<{buffer:Buffer;filename:string}> => {
  const doc = new PDFDocument({size:[PAGE_WIDTH, PAGE_HEIGHT], margin:0, info:{Title:`Orden de Trabajo OT-${row.id}`}});
  const chunks:Buffer[] = [];
  doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>((resolvePromise, reject) => {
    doc.on("end", () => resolvePromise(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const fonts = fontPaths();
  const regularFont = fonts.regular ? "Arial" : "Helvetica";
  const boldFont = fonts.bold ? "Arial-Bold" : "Helvetica-Bold";
  if (fonts.regular) doc.registerFont("Arial", fonts.regular);
  if (fonts.bold) doc.registerFont("Arial-Bold", fonts.bold);

  let y = MARGIN_TOP;
  const bottomY = PAGE_HEIGHT - MARGIN_BOTTOM - 18;
  const drawHeader = () => {
    const path = logoPath();
    if (path) doc.image(path, MARGIN_LEFT, MARGIN_TOP, {fit:[58, 58], align:"center", valign:"center"});
    doc.fillColor(BLUE).font(boldFont).fontSize(17).text("ORDEN DE TRABAJO", 210, 36, {width:CONTENT_WIDTH - 210, align:"right"});
    doc.fillColor(BLUE).font(regularFont).fontSize(9.5).text("ENVÍO DE EQUIPOS A SERVICIO TÉCNICO", 210, 59, {width:CONTENT_WIDTH - 210, align:"right"});
    doc.fillColor(TEXT).font(regularFont).fontSize(8).text(`N° de orden: OT-${value(row.id)}`, MARGIN_LEFT, 93, {width:230});
    doc.text(`Fecha: ${dateOnly(row.fecha_envio)}`, PAGE_WIDTH - MARGIN_RIGHT - 190, 93, {width:190, align:"right"});
    y = 111;
  };
  const addPage = () => { doc.addPage({size:[PAGE_WIDTH, PAGE_HEIGHT], margin:0}); drawHeader(); };
  const ensureSpace = (height:number) => { if (y + height > bottomY && y > 111) addPage(); };
  const section = (title:string) => { ensureSpace(18); y += 3; doc.fillColor(BLUE).font(boldFont).fontSize(9).text(title, MARGIN_LEFT, y, {width:CONTENT_WIDTH}); y += 13; };

  const drawTable = (headers:string[], rows:string[][], widths:number[]) => {
    const drawRow = (cells:string[], header:boolean) => {
      doc.font(header ? boldFont : regularFont).fontSize(header ? 7.2 : 7.4);
      const height = Math.max(header ? 20 : 18, ...cells.map((cell, index) => doc.heightOfString(cell || " ", {width:Math.max(8, widths[index] - 8), lineGap:0}) + 7));
      ensureSpace(height);
      let x = MARGIN_LEFT;
      cells.forEach((cell, index) => {
        doc.lineWidth(0.55).fillColor("#FFFFFF").strokeColor(BORDER).rect(x, y, widths[index], height).fillAndStroke();
        doc.fillColor(header ? BLUE : TEXT).font(header ? boldFont : regularFont).fontSize(header ? 7.2 : 7.4).text(cell || " ", x + 4, y + 3.5, {width:Math.max(8, widths[index] - 8), lineGap:0});
        x += widths[index];
      });
      y += height;
    };
    drawRow(headers, true);
    rows.forEach(rowValues => drawRow(rowValues, false));
    y += 3;
  };

  const primaryEquipment:OrdenEquipoPdf = {
    codigoInventario:row.codigo_inventario, tipo:row.tipo_dispositivo, marca:row.marca, modelo:row.modelo,
    identificador:row.imei ?? row.numero_serie,
    usuarioArea:row.colaborador_nombre_al_ingreso ?? row.departamento_nombre_al_ingreso ?? row.area_solicitante,
    falla:row.falla_reportada, accesorios:row.accesorios_entregados, observaciones:row.observaciones_envio
  };
  const equipment = [primaryEquipment, ...((row as ExtendedOrdenServicioRow).equipos ?? [])];
  const equipmentRows = equipment.map((item, index) => [value(item.codigoInventario ?? (index + 1)), value(item.tipo), value(item.marca), value(item.modelo), value(item.identificador), value(item.usuarioArea)]);
  const conditionRows = equipment.map((item, index) => [value(item.codigoInventario ?? (index + 1)), value(item.falla), value(item.accesorios), value(item.observaciones)]);

  drawHeader();
  section("1. ANTECEDENTES GENERALES");
  drawTable(["Campo", "Detalle"], [["Área solicitante", value(row.area_solicitante)], ["Responsable TI", value(row.responsable_envio)], ["Tipo de servicio", serviceType(row.tipo_servicio)]], [128, CONTENT_WIDTH - 128]);
  section("2. SERVICIO TÉCNICO");
  drawTable(["Campo", "Detalle"], [["Empresa", value(row.proveedor)], ["Contacto", value(row.contacto_servicio)]], [128, CONTENT_WIDTH - 128]);
  section("3. IDENTIFICACIÓN DE LOS EQUIPOS");
  drawTable(["N°", "Tipo de equipo", "Marca", "Modelo", "IMEI o serie", "Usuario asignado / Área"], equipmentRows, [25, 84, 82, 96, 110, CONTENT_WIDTH - 397]);
  section("4. CONDICIONES DE ENTREGA POR EQUIPO");
  drawTable(["N°", "Falla o problema reportado", "Accesorios entregados", "Observaciones"], conditionRows, [25, 220, 128, CONTENT_WIDTH - 373]);
  section("5. RECEPCIÓN Y DEVOLUCIÓN (INTERNO)");
  const diagnostic = [row.diagnostico, row.plazo_informado].filter(Boolean).map(value).join(" - ");
  const returnResult = [row.resultado, row.observaciones_retorno].filter(Boolean).map(value).join(" - ");
  drawTable(["Campo", "Detalle"], [["Fecha de recepción", dateOnly(row.fecha_envio)], ["N° OT / ticket proveedor", value(row.ticket_proveedor)], ["Diagnóstico y plazo informado", value(diagnostic)], ["Costo cotizado", money(row.monto_cotizacion)], ["Observaciones de cotización", value(row.observaciones_cotizacion)], ["Fecha de devolución", dateOnly(row.fecha_retorno)], ["Estado final", finalState(row.estado_final)], ["Resultado / observaciones de retorno", value(returnResult)]], [190, CONTENT_WIDTH - 190]);
  section("6. FIRMAS");
  ensureSpace(102);
  const signatureGap = 24;
  const signatureWidth = (CONTENT_WIDTH - signatureGap) / 2;
  const signature = (x:number, title:string, role:string) => {
    doc.fillColor(TEXT).font(boldFont).fontSize(7.5).text(title, x, y, {width:signatureWidth, align:"center"});
    doc.lineWidth(0.55).strokeColor(BORDER).moveTo(x + 12, y + 30).lineTo(x + signatureWidth - 12, y + 30).stroke();
    doc.fillColor(MUTED).font(regularFont).fontSize(7).text(role, x, y + 35, {width:signatureWidth, align:"center"});
    doc.text("Nombre: __________________________", x, y + 54, {width:signatureWidth, align:"center"});
    doc.text("Fecha: ___________________________", x, y + 70, {width:signatureWidth, align:"center"});
  };
  signature(MARGIN_LEFT, "RECEPCIÓN EN SERVICIO TÉCNICO", "Representante del servicio técnico");
  signature(MARGIN_LEFT + signatureWidth + signatureGap, "RECEPCIÓN POST SERVICIO - ÁREA TI", "Responsable TI - Aguas San Isidro");
  y += 91;
  doc.fillColor(MUTED).font(regularFont).fontSize(7).text(FOOTER, MARGIN_LEFT, PAGE_HEIGHT - MARGIN_BOTTOM - 9, {width:CONTENT_WIDTH, align:"center"});
  doc.end();
  return {buffer:await completed, filename:`ST-${row.id}-envio.pdf`};
};
