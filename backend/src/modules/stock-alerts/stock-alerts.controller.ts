import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { ValidationError } from "../../shared/errors";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseOptionalBoolean,
  parseOptionalNonNegativeInteger,
  parsePositiveInteger
} from "../../shared/validation";
import { listStockAlerts, updateStockAlert } from "./stock-alerts.service";

export const listStockAlertsController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    sendCollection(res, await listStockAlerts());
  }
);

export const updateStockAlertController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);
    const minimoDisponible = parseOptionalNonNegativeInteger(
      body.minimoDisponible,
      "minimoDisponible"
    );
    const alertaActiva = parseOptionalBoolean(body.alertaActiva, "alertaActiva");
    if (minimoDisponible === undefined || minimoDisponible === null) {
      throw new ValidationError("minimoDisponible es obligatorio.");
    }
    if (alertaActiva === undefined) {
      throw new ValidationError("alertaActiva es obligatorio.");
    }
    sendItem(res, await updateStockAlert(
      parsePositiveInteger(req.params.tipoId, "tipoId"),
      {
        minimoDisponible,
        alertaActiva,
        usuarioId: parsePositiveInteger(req.authUser?.id, "usuarioId")
      }
    ));
  }
);
