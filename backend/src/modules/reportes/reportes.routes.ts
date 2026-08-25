import { Router } from "express";
import { reporteInventarioController,reporteInventarioPdfController } from "./reportes.controller";
const router=Router();
router.get("/inventario",reporteInventarioController);
router.get("/inventario/pdf",reporteInventarioPdfController);
export default router;
