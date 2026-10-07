import { Router } from "express";
import { buscarLineaPorNumeroController } from "./lineas-moviles.controller";

const router = Router();

router.get("/numero/:numero", buscarLineaPorNumeroController);

export default router;
