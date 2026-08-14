import { Router } from "express";
import {
  actualizarDispositivoController,
  asignarColaboradorController,
  asignarDepartamentoController,
  cambiarEstadoDispositivoController,
  crearDispositivoController,
  devolverDispositivoController,
  historialDispositivoController,
  listarDispositivosController,
  obtenerDispositivoController
} from "./dispositivos.controller";

const router = Router();

router.get("/", listarDispositivosController);
router.get("/:codigo/historial", historialDispositivoController);
router.get("/:codigo", obtenerDispositivoController);
router.post("/", crearDispositivoController);
router.patch("/:codigo", actualizarDispositivoController);
router.post(
  "/:codigo/asignar-colaborador",
  asignarColaboradorController
);
router.post(
  "/:codigo/asignar-departamento",
  asignarDepartamentoController
);
router.post("/:codigo/devolver", devolverDispositivoController);
router.post(
  "/:codigo/cambiar-estado",
  cambiarEstadoDispositivoController
);

export default router;
