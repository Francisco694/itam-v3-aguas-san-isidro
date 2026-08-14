import { Router } from "express";
import {
  actualizarColaboradorController,
  crearColaboradorController,
  listarColaboradoresController,
  obtenerColaboradorController,
  obtenerColaboradorPorRutController
} from "./colaboradores.controller";

const router = Router();

router.get("/", listarColaboradoresController);
router.get("/rut/:rut", obtenerColaboradorPorRutController);
router.get("/:id", obtenerColaboradorController);
router.post("/", crearColaboradorController);
router.patch("/:id", actualizarColaboradorController);

export default router;
