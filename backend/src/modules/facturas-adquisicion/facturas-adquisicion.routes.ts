import { Router } from "express";
import {
  actualizarFacturaController,
  crearFacturaController,
  listarFacturasController,
  obtenerDocumentoFacturaController,
  obtenerFacturaController
} from "./facturas-adquisicion.controller";
import { invoiceDocumentUpload } from "./facturas-adquisicion.upload";

const router = Router();

router.get("/", listarFacturasController);
router.get("/:id/documento", obtenerDocumentoFacturaController);
router.get("/:id", obtenerFacturaController);
router.post("/", invoiceDocumentUpload, crearFacturaController);
router.patch("/:id", invoiceDocumentUpload, actualizarFacturaController);

export default router;
