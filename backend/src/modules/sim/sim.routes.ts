import { Router } from "express";
import {
  actualizarSimController,
  asociarDispositivoController,
  asignarColaboradorController,
  cambiarEstadoSimController,
  crearSimController,
  desasociarLineaController,
  desasignarColaboradorController,
  desasociarDispositivoController,
  historialSimController,
  historialLineaSimController,
  listarSimController,
  obtenerSimController,
  obtenerSimPorIccidController,
  asociarLineaController
} from "./sim.controller";

const router = Router();

router.get("/", listarSimController);
router.get("/iccid/:iccid", obtenerSimPorIccidController);
router.get("/:codigo/historial", historialSimController);
router.get("/:codigo/lineas-historial", historialLineaSimController);
router.get("/:codigo", obtenerSimController);
router.post("/", crearSimController);
router.patch("/:codigo", actualizarSimController);
router.post(
  "/:codigo/asociar-dispositivo",
  asociarDispositivoController
);
router.post("/:codigo/asociar-linea", asociarLineaController);
router.post("/:codigo/desasociar-linea", desasociarLineaController);
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
