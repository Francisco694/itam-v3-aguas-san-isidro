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
  gestionarLineaSimController,
  registrarSimNuevaController,
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
import {
  agregarCatalogosTecnicosController,
  obtenerArchivoCatalogoTecnicoController,
  obtenerCatalogoTecnicoController,
} from "./catalogo-tecnico.controller";
import { technicalCatalogUpload } from "./catalogo-tecnico.upload";

const router = Router();

router.get("/", listarDispositivosController);
router.get("/resumen-gerencial", resumenGerencialController);
router.get("/validar-identificador", validarIdentificadorController);
router.post("/:codigo/asociar-linea", asociarLineaController);
router.post("/:codigo/gestionar-linea-sim", gestionarLineaSimController);
router.post("/:codigo/registrar-sim", registrarSimNuevaController);
router.get("/:codigo/historial", historialDispositivoController);
router.get("/:codigo/trazabilidad", trazabilidadDispositivoController);
router.get("/:codigo/verificaciones-fisicas", listarVerificacionesFisicasController);
router.get("/:codigo/catalogo-tecnico/archivo", obtenerArchivoCatalogoTecnicoController);
router.get("/:codigo/catalogo-tecnico/:catalogoId/archivo", obtenerArchivoCatalogoTecnicoController);
router.get("/:codigo/catalogo-tecnico", obtenerCatalogoTecnicoController);
router.post("/:codigo/catalogo-tecnico", technicalCatalogUpload, agregarCatalogosTecnicosController);
router.put("/:codigo/catalogo-tecnico", technicalCatalogUpload, agregarCatalogosTecnicosController);
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
