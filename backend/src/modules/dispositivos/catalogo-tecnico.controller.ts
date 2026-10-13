import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { authenticatedActorName } from "../../shared/authenticated-actor";
import { ValidationError } from "../../shared/errors";
import { parsePositiveInteger } from "../../shared/validation";
import { sendItem } from "../../shared/responses";
import {
  obtenerArchivoCatalogoTecnico,
  obtenerCatalogoTecnico,
  reemplazarCatalogoTecnico
} from "./catalogo-tecnico.service";
import {
  catalogoTecnicoFromUpload,
  removeTechnicalCatalogFile,
  validateTechnicalCatalogSignature
} from "./catalogo-tecnico.upload";

export const obtenerCatalogoTecnicoController = asyncHandler(
  async (request: Request, response: Response): Promise<void> => {
    sendItem(
      response,
      await obtenerCatalogoTecnico(
        parsePositiveInteger(request.params.codigo, "codigo")
      )
    );
  }
);

export const reemplazarCatalogoTecnicoController = asyncHandler(
  async (request: Request, response: Response): Promise<void> => {
    const document = catalogoTecnicoFromUpload(request.file);
    if (!document) {
      throw new ValidationError("Debe adjuntar un archivo PDF de catálogo técnico.");
    }

    try {
      await validateTechnicalCatalogSignature(document);
      sendItem(
        response,
        await reemplazarCatalogoTecnico(
          parsePositiveInteger(request.params.codigo, "codigo"),
          document,
          authenticatedActorName(request)
        )
      );
    } catch (error) {
      await removeTechnicalCatalogFile(document.ruta);
      throw error;
    }
  }
);

const contentDisposition = (filename: string, download: boolean): string => {
  const asciiName = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  return `${download ? "attachment" : "inline"}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

export const obtenerArchivoCatalogoTecnicoController = asyncHandler(
  async (request: Request, response: Response): Promise<void> => {
    const document = await obtenerArchivoCatalogoTecnico(
      parsePositiveInteger(request.params.codigo, "codigo")
    );
    response.setHeader("Content-Type", document.mimeType);
    response.setHeader("Content-Length", document.tamanoBytes);
    response.setHeader(
      "Content-Disposition",
      contentDisposition(document.nombreOriginal, request.query.download === "true")
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.sendFile(document.absolutePath);
  }
);
