import { Router } from "express";
import { listarEstadosController } from "./estados.controller";

const router = Router();

router.get("/", listarEstadosController);

export default router;
