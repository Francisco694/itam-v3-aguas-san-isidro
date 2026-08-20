import {Router} from "express";
import {cerrarOrdenController,cotizarOrdenController,crearOrdenController,decidirOrdenController,listarOrdenesController,obtenerOrdenController} from "./servicio-tecnico.controller";
const router=Router();
router.get("/",listarOrdenesController);router.get("/:id",obtenerOrdenController);
router.post("/",crearOrdenController);router.patch("/:id/cotizacion",cotizarOrdenController);
router.post("/:id/decision",decidirOrdenController);router.post("/:id/cerrar",cerrarOrdenController);
export default router;
