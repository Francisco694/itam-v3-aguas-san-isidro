import {Router} from "express";import {crearActaController,listarActasController,obtenerActaController,pdfActaController} from "./actas-entrega.controller";
const router=Router();router.get("/",listarActasController);router.get("/:id/pdf",pdfActaController);router.get("/:id",obtenerActaController);router.post("/",crearActaController);export default router;
