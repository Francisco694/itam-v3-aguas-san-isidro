import { Router } from "express";
import {
  closeOffboardingController,
  getOffboardingController,
  listOpenOffboardingController,
  searchOffboardingCollaboratorsController,
  startOffboardingController
} from "./offboarding.controller";

const router = Router();

router.get("/", listOpenOffboardingController);
router.get("/buscar", searchOffboardingCollaboratorsController);
router.get("/:id", getOffboardingController);
router.post("/", startOffboardingController);
router.post("/:id/cerrar", closeOffboardingController);

export default router;
