import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";
import multer from "multer";
import { env } from "../../config/env";
import { ValidationError } from "../../shared/errors";
import type { FacturaDocumentoAlmacenado } from "./facturas-adquisicion.types";

export const MAX_INVOICE_DOCUMENT_BYTES = 10 * 1024 * 1024;

const mimeExtensions: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png"
};

const acceptedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);
const storageRoot = path.resolve(env.documentStoragePath);

mkdirSync(storageRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, storageRoot),
  filename: (_request, file, callback) => callback(
    null,
    `factura_${randomUUID()}${mimeExtensions[file.mimetype]}`
  )
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_INVOICE_DOCUMENT_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedExtension = mimeExtensions[file.mimetype];
    const valid = !!expectedExtension &&
      acceptedExtensions.has(extension) &&
      (file.mimetype !== "image/jpeg" || [".jpg", ".jpeg"].includes(extension)) &&
      (file.mimetype === "image/jpeg" || extension === expectedExtension);

    if (!valid) {
      callback(new ValidationError(
        "Formato no permitido. Adjunte un archivo PDF, JPG, JPEG o PNG."
      ));
      return;
    }
    callback(null, true);
  }
}).single("documento");

export const invoiceDocumentUpload: RequestHandler = (request, response, next) => {
  upload(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new ValidationError(error.code === "LIMIT_FILE_SIZE"
        ? "El archivo supera el tamaño máximo permitido de 10 MB."
        : "No fue posible procesar el documento adjunto."));
      return;
    }
    next(error);
  });
};

const safeOriginalName = (name: string): string => {
  const sanitized = path.basename(name)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return (sanitized || "documento_factura").slice(0, 255);
};

export const documentFromUpload = (
  file: Express.Multer.File | undefined
): FacturaDocumentoAlmacenado | undefined => file ? {
  nombreOriginal: safeOriginalName(file.originalname),
  nombreAlmacenado: file.filename,
  mimeType: file.mimetype as FacturaDocumentoAlmacenado["mimeType"],
  tamanoBytes: file.size,
  ruta: file.filename
} : undefined;

export const validateInvoiceDocumentSignature = async (
  document: FacturaDocumentoAlmacenado | undefined
): Promise<void> => {
  if (!document) return;
  const signature = Buffer.alloc(8);
  try {
    const handle = await open(resolveInvoiceDocumentPath(document.ruta), "r");
    try {
      await handle.read(signature, 0, signature.length, 0);
    } finally {
      await handle.close();
    }
  } catch {
    await removeInvoiceDocument(document.ruta);
    throw new ValidationError(
      "No fue posible validar el contenido del documento adjunto."
    );
  }
  const valid = document.mimeType === "application/pdf"
    ? signature.subarray(0, 5).equals(Buffer.from("%PDF-"))
    : document.mimeType === "image/jpeg"
      ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
      : signature.equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (!valid) {
    await removeInvoiceDocument(document.ruta);
    throw new ValidationError(
      "El contenido del archivo no corresponde al formato PDF, JPG, JPEG o PNG indicado."
    );
  }
};

export const resolveInvoiceDocumentPath = (relativePath: string): string => {
  const absolutePath = path.resolve(storageRoot, relativePath);
  if (absolutePath === storageRoot ||
      !absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Ruta de documento de factura inválida.");
  }
  return absolutePath;
};

export const removeInvoiceDocument = async (
  relativePath: string | null | undefined
): Promise<void> => {
  if (!relativePath) return;
  try {
    await rm(resolveInvoiceDocumentPath(relativePath), { force: true });
  } catch {
    console.error("No fue posible eliminar un documento de factura reemplazado.");
  }
};
