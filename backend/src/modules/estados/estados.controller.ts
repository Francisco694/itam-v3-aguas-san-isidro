import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { sendCollection } from "../../shared/responses";
import { parseOptionalEnum } from "../../shared/validation";
import { obtenerEstados } from "./estados.service";
import { tiposEntidad } from "./estados.types";

export const listarEstadosController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const tipoEntidad = parseOptionalEnum(
      req.query.tipoEntidad,
      "tipoEntidad",
      tiposEntidad
    );

    const estados = await obtenerEstados({ tipoEntidad });

    sendCollection(res, estados);
  }
);
