import { Router } from "express";
import { listarCustodiasDispositivoController } from "./custodias.controller";

const router = Router();

router.get("/dispositivos/:codigo", listarCustodiasDispositivoController);

export default router;