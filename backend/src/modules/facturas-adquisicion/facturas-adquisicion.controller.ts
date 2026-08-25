import type { Request, Response } from "express";
import { asyncHandler } from "../../shared/async-handler";
import { ValidationError } from "../../shared/errors";
import { sendCollection, sendItem } from "../../shared/responses";
import {
  parseBodyObject,
  parseOptionalNonNegativeInteger,
  parseOptionalString,
  parsePositiveInteger,
  parseRequiredString
} from "../../shared/validation";
import {
  actualizarFactura,
  crearFactura,
  obtenerDocumentoFactura,
  obtenerFactura,
  obtenerFacturas
} from "./facturas-adquisicion.service";
import {
  documentFromUpload,
  removeInvoiceDocument,
  validateInvoiceDocumentSignature
} from "./facturas-adquisicion.upload";
import type {
  FacturaAdquisicionInput
} from "./facturas-adquisicion.types";

const parseCodes = (value: unknown): number[] => {
  if (!Array.isArray(value) || !value.length) {
    throw new ValidationError(
      "dispositivosCodigos debe contener al menos un activo."
    );
  }
  return value.map((item, index) =>
    parsePositiveInteger(item, `dispositivosCodigos[${index}]`)
  );
};

const bodyFromRequest = (request: Request): unknown => {
  if (request.body && typeof request.body === "object" &&
      "metadata" in request.body) {
    const metadata = (request.body as Record<string, unknown>).metadata;
    if (typeof metadata !== "string") {
      throw new ValidationError("metadata debe contener un objeto JSON.");
    }
    try {
      return JSON.parse(metadata) as unknown;
    } catch {
      throw new ValidationError("metadata contiene JSON inválido.");
    }
  }
  return request.body;
};

const input = (body: unknown, partial = false) => {
  const parsed = parseBodyObject(body);
  return {
    numeroFactura: partial
      ? parseOptionalString(parsed.numeroFactura, "numeroFactura", 80)
      : parseRequiredString(parsed.numeroFactura, "numeroFactura", 80),
    fechaFactura: parseOptionalString(parsed.fechaFactura, "fechaFactura", 10),
    proveedor: parseOptionalString(parsed.proveedor, "proveedor", 180),
    montoTotal: parseOptionalNonNegativeInteger(parsed.montoTotal, "montoTotal"),
    observaciones: parseOptionalString(parsed.observaciones, "observaciones"),
    referenciaDocumental: parseOptionalString(
      parsed.referenciaDocumental, "referenciaDocumental", 300
    ),
    ...(partial ? {} : {
      dispositivosCodigos: parseCodes(parsed.dispositivosCodigos)
    })
  };
};

export const listarFacturasController = asyncHandler(
  async (_request: Request, response: Response) =>
    sendCollection(response, await obtenerFacturas())
);

export const obtenerFacturaController = asyncHandler(
  async (request: Request, response: Response) =>
    sendItem(response, await obtenerFactura(
      parsePositiveInteger(request.params.id, "id")
    ))
);

export const crearFacturaController = asyncHandler(
  async (request: Request, response: Response) => {
    const documento = documentFromUpload(request.file);
    await validateInvoiceDocumentSignature(documento);
    let parsedInput: FacturaAdquisicionInput;
    try {
      parsedInput = input(bodyFromRequest(request)) as FacturaAdquisicionInput;
    } catch (error) {
      await removeInvoiceDocument(documento?.ruta);
      throw error;
    }
    sendItem(response, await crearFactura(parsedInput, documento), 201);
  }
);

export const actualizarFacturaController = asyncHandler(
  async (request: Request, response: Response) => {
    const documento = documentFromUpload(request.file);
    await validateInvoiceDocumentSignature(documento);
    let parsedInput: Partial<FacturaAdquisicionInput>;
    try {
      parsedInput = input(
        bodyFromRequest(request),
        true
      ) as Partial<FacturaAdquisicionInput>;
    } catch (error) {
      await removeInvoiceDocument(documento?.ruta);
      throw error;
    }
    sendItem(response, await actualizarFactura(
      parsePositiveInteger(request.params.id, "id"),
      parsedInput,
      documento
    ));
  }
);

const contentDisposition = (filename: string, download: boolean): string => {
  const disposition = download ? "attachment" : "inline";
  const asciiName = filename
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  return `${disposition}; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
};

export const obtenerDocumentoFacturaController = asyncHandler(
  async (request: Request, response: Response) => {
    const documento = await obtenerDocumentoFactura(
      parsePositiveInteger(request.params.id, "id")
    );
    response.setHeader("Content-Type", documento.mimeType);
    response.setHeader("Content-Length", documento.tamanoBytes);
    response.setHeader(
      "Content-Disposition",
      contentDisposition(documento.nombreOriginal, request.query.download === "true")
    );
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "private, no-store");
    response.sendFile(documento.absolutePath);
  }
);
