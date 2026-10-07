import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { NotFoundError } from "../../shared/errors";
import { parseRequiredString } from "../../shared/validation";
import { sendItem } from "../../shared/responses";
import { buscarLineaMovilPorNumero } from "./lineas-moviles.service";

export const buscarLineaPorNumeroController = asyncHandler(async (req: Request, res: Response) => {
  const numero = parseRequiredString(req.params.numero, "numero", 30);
  const linea = await buscarLineaMovilPorNumero(numero);
  if (!linea) throw new NotFoundError("Línea móvil no encontrada para el número informado.");
  sendItem(res, linea);
});
