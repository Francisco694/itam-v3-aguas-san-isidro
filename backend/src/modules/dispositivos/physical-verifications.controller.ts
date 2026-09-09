import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { authenticatedActorName } from "../../shared/authenticated-actor";
import { parseBodyObject, parseOptionalString } from "../../shared/validation";
import { ValidationError } from "../../shared/errors";
import { sendCollection, sendItem } from "../../shared/responses";
import { parseCodigoItam } from "./dispositivos.controller";
import {
  obtenerVerificacionesFisicas,
  registrarVerificacionFisica
} from "./physical-verifications.service";
import type { RegistrarVerificacionFisicaInput } from "./physical-verifications.types";

export const registrarVerificacionFisicaController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const body = parseBodyObject(req.body);
    if (typeof body.encontrado !== "boolean") {
      throw new ValidationError("encontrado debe ser boolean.");
    }
    const input: RegistrarVerificacionFisicaInput = {
      encontrado: body.encontrado,
      identificadorComprobado: parseOptionalString(
        body.identificadorComprobado,
        "identificadorComprobado",
        150
      ),
      observacion: parseOptionalString(body.observacion, "observacion"),
      responsable: authenticatedActorName(req)
    };
    sendItem(
      res,
      await registrarVerificacionFisica(parseCodigoItam(req.params.codigo), input),
      201
    );
  }
);

export const listarVerificacionesFisicasController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    sendCollection(
      res,
      await obtenerVerificacionesFisicas(parseCodigoItam(req.params.codigo))
    );
  }
);
