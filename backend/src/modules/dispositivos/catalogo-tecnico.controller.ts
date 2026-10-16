import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { authenticatedActorName } from "../../shared/authenticated-actor";
import { ValidationError } from "../../shared/errors";
import { parsePositiveInteger } from "../../shared/validation";
import { sendItem } from "../../shared/responses";
import {
  agregarCatalogosTecnicos,
  eliminarCatalogoTecnico,
  obtenerArchivoCatalogoTecnico,
  obtenerCatalogosTecnicos,
  reemplazarCatalogoTecnico,
  removeUploadedTechnicalCatalogs
} from "./catalogo-tecnico.service";
import {
  catalogosTecnicosFromUpload,
  validateTechnicalCatalogSignature
} from "./catalogo-tecnico.upload";

export const obtenerCatalogoTecnicoController = asyncHandler(
  async (request: Request, response: Response): Promise<void> => {
    sendItem(
      response,
      await obtenerCatalogosTecnicos(parsePositiveInteger(request.params.codigo, "codigo"))
    );
  }
);

export const agregarCatalogosTecnicosController = asyncHandler(
  async (request: Request, response: Response): Promise<void> => {
    const documents = catalogosTecnicosFromUpload(request.files);
    if (!documents.length) {
      throw new ValidationError("Debe adjuntar al menos un archivo PDF de catálogo técnico.");
    }

    try {
      for (const document of documents) await validateTechnicalCatalogSignature(document);
      sendItem(
        response,
        await agregarCatalogosTecnicos(
          parsePositiveInteger(request.params.codigo, "codigo"),
          documents,
          authenticatedActorName(request)
        )
      );
    } catch (error) {
      await removeUploadedTechnicalCatalogs(documents);
      throw error;
    }
  }
);

export const reemplazarCatalogoTecnicoController = asyncHandler(
  async (request: Request, response: Response): Promise<void> => {
    const documents = catalogosTecnicosFromUpload(request.files);
    if (documents.length !== 1) {
      throw new ValidationError("Debe adjuntar exactamente un archivo PDF para reemplazar el catÃ¡logo tÃ©cnico.");
    }

    try {
      await validateTechnicalCatalogSignature(documents[0]!);
      sendItem(
        response,
        await reemplazarCatalogoTecnico(
          parsePositiveInteger(request.params.codigo, "codigo"),
          parsePositiveInteger(request.params.catalogoId, "catalogoId"),
          documents[0]!,
          authenticatedActorName(request)
        )
      );
    } catch (error) {
      await removeUploadedTechnicalCatalogs(documents);
      throw error;
    }
  }
);

export const eliminarCatalogoTecnicoController = asyncHandler(
  async (request: Request, response: Response): Promise<void> => {
    sendItem(
      response,
      await eliminarCatalogoTecnico(
        parsePositiveInteger(request.params.codigo, "codigo"),
        parsePositiveInteger(request.params.catalogoId, "catalogoId")
      )
    );
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
      parsePositiveInteger(request.params.codigo, "codigo"),
      request.params.catalogoId
        ? parsePositiveInteger(request.params.catalogoId, "catalogoId")
        : undefined
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
