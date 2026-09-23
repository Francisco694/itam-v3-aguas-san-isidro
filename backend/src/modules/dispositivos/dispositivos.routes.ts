import { Router } from "express";
import {
  actualizarDispositivoController,
  asociarLineaController,
  asignarColaboradorController,
  asignarDepartamentoController,
  cambiarEstadoDispositivoController,
  crearDispositivoController,
  devolverDispositivoController,
  darBajaDispositivoController,
  historialDispositivoController,
  listarVerificacionesFisicasController,
  listarDispositivosController,
  obtenerDispositivoController,
  resumenGerencialController,
  resultadoOffboardingController,
  trazabilidadDispositivoController,
  validarIdentificadorController,
  registrarVerificacionManualController,
  registrarVerificacionFisicaController
} from "./dispositivos.controller";

const router = Router();

router.get("/", listarDispositivosController);
router.get("/resumen-gerencial", resumenGerencialController);
router.get("/validar-identificador", validarIdentificadorController);
router.post("/:codigo/asociar-linea", asociarLineaController);
router.get("/:codigo/historial", historialDispositivoController);
router.get("/:codigo/trazabilidad", trazabilidadDispositivoController);
router.get("/:codigo/verificaciones-fisicas", listarVerificacionesFisicasController);
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
router.post("/:codigo/resultado-offboarding", resultadoOffboardingController);
router.post("/:codigo/dar-baja", darBajaDispositivoController);
router.post("/:codigo/verificaciones-fisicas", registrarVerificacionFisicaController);
router.post("/:codigo/verificacion-manual", registrarVerificacionManualController);
router.post(
  "/:codigo/cambiar-estado",
  cambiarEstadoDispositivoController
);

export default router;
