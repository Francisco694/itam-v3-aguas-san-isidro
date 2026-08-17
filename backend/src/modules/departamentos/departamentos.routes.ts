import { Router } from "express";
import {
  actualizarDepartamentoController,
  crearDepartamentoController,
  listarDepartamentosController,
  obtenerDepartamentoController,
  obtenerInventarioDepartamentoController
} from "./departamentos.controller";

const router = Router();

router.get("/", listarDepartamentosController);
router.get("/:id/inventario", obtenerInventarioDepartamentoController);
router.get("/:id", obtenerDepartamentoController);
router.post("/", crearDepartamentoController);
router.patch("/:id", actualizarDepartamentoController);

export default router;
