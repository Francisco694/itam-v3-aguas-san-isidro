import { Router } from "express";
import { requireRole } from "../../shared/auth.middleware";
import { listStockAlertsController, updateStockAlertController } from "./stock-alerts.controller";

const router = Router();
router.get("/", listStockAlertsController);
router.patch("/:tipoId", requireRole("SUPER_USUARIO"), updateStockAlertController);
export default router;
