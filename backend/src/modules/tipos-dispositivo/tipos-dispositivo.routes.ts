import { Router } from "express";
import { actualizarTipoDispositivoController, crearTipoDispositivoController,
  listarTiposDispositivoController,
  obtenerTipoDispositivoController } from "./tipos-dispositivo.controller";

const router = Router();
router.get("/", listarTiposDispositivoController);
router.get("/:id", obtenerTipoDispositivoController);
router.post("/", crearTipoDispositivoController);
router.patch("/:id", actualizarTipoDispositivoController);
export default router;
