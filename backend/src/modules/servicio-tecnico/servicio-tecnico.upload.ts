import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";
import multer from "multer";
import { env } from "../../config/env";
import { ValidationError } from "../../shared/errors";
import type { CotizacionArchivoAlmacenado, CotizacionArchivoMime } from "./servicio-tecnico.types";

export const MAX_TECHNICAL_QUOTE_BYTES = 10 * 1024 * 1024;

const mimeExtensions: Record<CotizacionArchivoMime, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx"
};
const acceptedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png", ".doc", ".docx"]);
const storageRoot = path.resolve(env.documentStoragePath);
mkdirSync(storageRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, storageRoot),
  filename: (_request, file, callback) => callback(
    null,
    `cotizacion_${randomUUID()}${mimeExtensions[file.mimetype as CotizacionArchivoMime]}`
  )
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_TECHNICAL_QUOTE_BYTES, files: 1 },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const expectedExtension = mimeExtensions[file.mimetype as CotizacionArchivoMime];
    const valid = !!expectedExtension && acceptedExtensions.has(extension) &&
      (file.mimetype !== "image/jpeg" || [".jpg", ".jpeg"].includes(extension)) &&
      (file.mimetype === "image/jpeg" || extension === expectedExtension);
    if (!valid) {
      callback(new ValidationError("Formato no permitido. Adjunte PDF, JPG, JPEG, PNG, DOC o DOCX."));
      return;
    }
    callback(null, true);
  }
}).single("archivo");

export const technicalQuoteUpload: RequestHandler = (request, response, next) => {
  upload(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new ValidationError(error.code === "LIMIT_FILE_SIZE"
        ? "El archivo supera el tamaño máximo permitido de 10 MB."
        : "No fue posible procesar la cotización adjunta."));
      return;
    }
    next(error);
  });
};

const safeOriginalName = (name: string): string => {
  const sanitized = path.basename(name).replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (sanitized || "cotizacion_proveedor").slice(0, 255);
};

export const quoteDocumentFromUpload = (
  file: Express.Multer.File | undefined
): CotizacionArchivoAlmacenado | undefined => file ? {
  nombreOriginal: safeOriginalName(file.originalname),
  nombreArchivo: file.filename,
  mimeType: file.mimetype as CotizacionArchivoMime,
  tamanioBytes: file.size,
  rutaArchivo: file.filename
} : undefined;

export const validateTechnicalQuoteSignature = async (
  document: CotizacionArchivoAlmacenado | undefined
): Promise<void> => {
  if (!document) return;
  if ([".doc", ".docx"].includes(path.extname(document.nombreOriginal).toLowerCase())) return;
  const signature = Buffer.alloc(8);
  try {
    const handle = await open(resolveTechnicalQuoteFilePath(document.rutaArchivo), "r");
    try { await handle.read(signature, 0, signature.length, 0); } finally { await handle.close(); }
  } catch {
    await removeTechnicalQuoteFile(document.rutaArchivo);
    throw new ValidationError("No fue posible validar el contenido de la cotización adjunta.");
  }
  const valid = document.mimeType === "application/pdf"
    ? signature.subarray(0, 5).equals(Buffer.from("%PDF-"))
    : document.mimeType === "image/jpeg"
      ? signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
      : signature.equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (!valid) {
    await removeTechnicalQuoteFile(document.rutaArchivo);
    throw new ValidationError("El contenido no corresponde al formato indicado.");
  }
};

export const resolveTechnicalQuoteFilePath = (relativePath: string): string => {
  const absolutePath = path.resolve(storageRoot, relativePath);
  if (absolutePath === storageRoot || !absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Ruta de cotización inválida.");
  }
  return absolutePath;
};

export const removeTechnicalQuoteFile = async (relativePath: string | null | undefined): Promise<void> => {
  if (!relativePath) return;
  try { await rm(resolveTechnicalQuoteFilePath(relativePath), { force: true }); }
  catch { console.error("No fue posible eliminar un archivo de cotización no persistido."); }
};
