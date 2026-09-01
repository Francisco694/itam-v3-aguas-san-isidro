import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { sendCollection } from "../../shared/responses";
import { parsePositiveInteger } from "../../shared/validation";
import { obtenerCustodiasDispositivo } from "./custodias.service";

export const listarCustodiasDispositivoController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codigo = parsePositiveInteger(req.params.codigo, "codigo");
    sendCollection(res, await obtenerCustodiasDispositivo(codigo));
  }
);