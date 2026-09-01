import { Router } from "express";
import {
  actualizarDispositivoController,
  asignarColaboradorController,
  asignarDepartamentoController,
  cambiarEstadoDispositivoController,
  crearDispositivoController,
  devolverDispositivoController,
  darBajaDispositivoController,
  historialDispositivoController,
  listarDispositivosController,
  obtenerDispositivoController,
  resumenGerencialController,
  resultadoOffboardingController,
  reasignarColaboradorController,
  reasignarDepartamentoController
} from "./dispositivos.controller";

const router = Router();

router.get("/", listarDispositivosController);
router.get("/resumen-gerencial", resumenGerencialController);
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
router.post("/:codigo/reasignar-colaborador", reasignarColaboradorController);
router.post("/:codigo/reasignar-departamento", reasignarDepartamentoController);
router.post("/:codigo/devolver", devolverDispositivoController);
router.post("/:codigo/resultado-offboarding", resultadoOffboardingController);
router.post("/:codigo/dar-baja", darBajaDispositivoController);
router.post(
  "/:codigo/cambiar-estado",
  cambiarEstadoDispositivoController
);

export default router;
