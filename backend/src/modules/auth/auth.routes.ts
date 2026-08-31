import { Router } from "express";
import { requireAuth } from "../../shared/auth.middleware";
import {
  changePasswordController,
  changePinController,
  loginController,
  loginPinController,
  logoutController,
  meController,
  refreshSessionController
} from "./auth.controller";

const router = Router();

router.post("/login", loginController);
router.post("/login-pin", loginPinController);
router.get("/me", requireAuth, meController);
router.post("/refresh-session", requireAuth, refreshSessionController);
router.post("/change-password", requireAuth, changePasswordController);
router.post("/change-pin", requireAuth, changePinController);
router.post("/logout", requireAuth, logoutController);

export default router;
