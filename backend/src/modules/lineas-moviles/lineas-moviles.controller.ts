import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { NotFoundError } from "../../shared/errors";
import { parseRequiredString } from "../../shared/validation";
import { sendItem } from "../../shared/responses";
import { buscarLineaMovilPorNumero } from "./lineas-moviles.service";

export const buscarLineaPorNumeroController = asyncHandler(async (req: Request, res: Response) => {
  const numero = parseRequiredString(req.params.numero, "numero", 30);
  const dispositivoId = typeof req.query.dispositivoId === "string" ? req.query.dispositivoId : null;
  const simId = typeof req.query.simId === "string" ? req.query.simId : null;
  const linea = await buscarLineaMovilPorNumero(numero, dispositivoId, simId);
  if (!linea) throw new NotFoundError("Línea móvil no encontrada para el número informado.");
  sendItem(res, linea);
});
