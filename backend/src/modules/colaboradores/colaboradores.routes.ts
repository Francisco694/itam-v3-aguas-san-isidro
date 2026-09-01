import { Router } from "express";
import {
  actualizarColaboradorController,
  crearColaboradorController,
  listarColaboradoresController,
  obtenerColaboradorController,
  obtenerColaboradorPorRutController
  ,obtenerInventarioConciliadoColaboradorController
  ,obtenerInventarioColaboradorController
  ,pendientesOffboardingController
} from "./colaboradores.controller";

const router = Router();

router.get("/", listarColaboradoresController);
router.get("/offboarding-pendientes", pendientesOffboardingController);
router.get("/rut/:rut", obtenerColaboradorPorRutController);
router.get("/:id/inventario", obtenerInventarioColaboradorController);
router.get("/:id/inventario-conciliado", obtenerInventarioConciliadoColaboradorController);
router.get("/:id", obtenerColaboradorController);
router.post("/", crearColaboradorController);
router.patch("/:id", actualizarColaboradorController);

export default router;
