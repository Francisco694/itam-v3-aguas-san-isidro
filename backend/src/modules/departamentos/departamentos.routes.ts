import { Router } from "express";
import {
  actualizarDepartamentoController,
  crearDepartamentoController,
  listarDepartamentosController,
  obtenerDepartamentoController
} from "./departamentos.controller";

const router = Router();

router.get("/", listarDepartamentosController);
router.get("/:id", obtenerDepartamentoController);
router.post("/", crearDepartamentoController);
router.patch("/:id", actualizarDepartamentoController);

export default router;
