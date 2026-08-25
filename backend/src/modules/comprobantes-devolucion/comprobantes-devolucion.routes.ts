import {Router} from "express";
import {listarComprobantesController,obtenerComprobanteController,pdfComprobanteController} from "./comprobantes-devolucion.controller";
const router=Router();router.get("/",listarComprobantesController);router.get("/:id/pdf",pdfComprobanteController);router.get("/:id",obtenerComprobanteController);export default router;
