import { Router } from "express";
import {
  crearReemplazoController,
  listarReemplazosColaboradorController,
  listarReemplazosPendientesController,
  recibirReemplazoController
} from "./reemplazos-dispositivo.controller";

const router = Router();

router.get("/pendientes", listarReemplazosPendientesController);
router.get("/colaborador/:colaboradorId", listarReemplazosColaboradorController);
router.post("/", crearReemplazoController);
router.post("/:id/recibir", recibirReemplazoController);

export default router;
