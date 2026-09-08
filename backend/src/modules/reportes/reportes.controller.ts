import type { Request,Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { ValidationError } from "../../shared/errors";
import { sendItem } from "../../shared/responses";
import { generarReporteInventarioPdf,obtenerReporteInventario } from "./reportes.service";
const rango=(req:Request)=>{const desde=String(req.query.desde??"");const hasta=String(req.query.hasta??"");if(!/^\d{4}-\d{2}-\d{2}$/.test(desde)||!/^\d{4}-\d{2}-\d{2}$/.test(hasta)||desde>hasta)throw new ValidationError("desde y hasta deben formar un rango válido YYYY-MM-DD.");return{desde,hasta}};
export const reporteInventarioController=asyncHandler(async(req:Request,res:Response)=>{const{desde,hasta}=rango(req);sendItem(res,await obtenerReporteInventario(desde,hasta))});
export const reporteInventarioPdfController=asyncHandler(async(req:Request,res:Response)=>{const{desde,hasta}=rango(req);const pdf=await generarReporteInventarioPdf(desde,hasta);res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`attachment; filename="${pdf.filename}"`);res.send(pdf.buffer)});

