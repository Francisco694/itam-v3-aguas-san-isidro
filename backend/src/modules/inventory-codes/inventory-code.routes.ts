import { Router } from "express";
import {
  createInventoryCodeFamilyController,
  getInventoryCodeFamilyController,
  listInventoryCodeFamiliesController,
  suggestInventoryCodePrefixController,
  updateInventoryCodeFamilyController
} from "./inventory-code.controller";

const router = Router();
router.get("/", listInventoryCodeFamiliesController);
router.get("/prefijo-sugerido", suggestInventoryCodePrefixController);
router.get("/:id", getInventoryCodeFamilyController);
router.post("/", createInventoryCodeFamilyController);
router.patch("/:id", updateInventoryCodeFamilyController);
export default router;
