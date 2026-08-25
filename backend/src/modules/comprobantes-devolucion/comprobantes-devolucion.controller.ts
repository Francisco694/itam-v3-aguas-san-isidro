import type {Request,Response} from "express";
import {asyncHandler} from "../../shared/async-handler";
import {sendCollection,sendItem} from "../../shared/responses";
import {parsePositiveInteger} from "../../shared/validation";
import {generarPdfComprobante,obtenerComprobante,obtenerComprobantes} from "./comprobantes-devolucion.service";
export const listarComprobantesController=asyncHandler(async(_req:Request,res:Response)=>sendCollection(res,await obtenerComprobantes()));
export const obtenerComprobanteController=asyncHandler(async(req:Request,res:Response)=>sendItem(res,await obtenerComprobante(parsePositiveInteger(req.params.id,"id"))));
export const pdfComprobanteController=asyncHandler(async(req:Request,res:Response)=>{const result=await generarPdfComprobante(parsePositiveInteger(req.params.id,"id"));res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`inline; filename="${result.filename}"`);res.status(200).send(result.buffer)});

