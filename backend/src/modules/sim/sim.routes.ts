import { Router } from "express";
import {
  actualizarSimController,
  asociarDispositivoController,
  asignarColaboradorController,
  cambiarEstadoSimController,
  crearSimController,
  desasignarColaboradorController,
  desasociarDispositivoController,
  historialSimController,
  listarSimController,
  obtenerSimController
} from "./sim.controller";

const router = Router();

router.get("/", listarSimController);
router.get("/:codigo/historial", historialSimController);
router.get("/:codigo", obtenerSimController);
router.post("/", crearSimController);
router.patch("/:codigo", actualizarSimController);
router.post(
  "/:codigo/asociar-dispositivo",
  asociarDispositivoController
);
router.post(
  "/:codigo/desasociar-dispositivo",
  desasociarDispositivoController
);
router.post(
  "/:codigo/asignar-colaborador",
  asignarColaboradorController
);
router.post(
  "/:codigo/desasignar-colaborador",
  desasignarColaboradorController
);
router.post("/:codigo/cambiar-estado", cambiarEstadoSimController);

export default router;
