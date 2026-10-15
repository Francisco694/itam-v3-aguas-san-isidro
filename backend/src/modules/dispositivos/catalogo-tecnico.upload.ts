import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { open, rm } from "node:fs/promises";
import path from "node:path";
import type { RequestHandler } from "express";
import multer from "multer";
import { env } from "../../config/env";
import { ValidationError } from "../../shared/errors";
import type { CatalogoTecnicoAlmacenado } from "./catalogo-tecnico.types";

export const MAX_CATALOGO_TECNICO_BYTES = 10 * 1024 * 1024;
export const MAX_CATALOGO_TECNICO_FILES = 10;

const storageRoot = path.resolve(env.documentStoragePath);
mkdirSync(storageRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, storageRoot),
  filename: (_request, _file, callback) => callback(
    null,
    `catalogo_tecnico_${randomUUID()}.pdf`
  )
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_CATALOGO_TECNICO_BYTES, files: MAX_CATALOGO_TECNICO_FILES },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (file.mimetype !== "application/pdf" || extension !== ".pdf") {
      callback(new ValidationError("Formato no permitido. Adjunte un archivo PDF."));
      return;
    }
    callback(null, true);
  }
}).fields([
  { name: "archivos", maxCount: MAX_CATALOGO_TECNICO_FILES },
  { name: "archivo", maxCount: 1 }
]);

export const technicalCatalogUpload: RequestHandler = (request, response, next) => {
  upload(request, response, (error: unknown) => {
    if (error instanceof multer.MulterError) {
      next(new ValidationError(
        error.code === "LIMIT_FILE_SIZE"
          ? "El archivo supera el tamaño máximo permitido de 10 MB."
          : error.code === "LIMIT_FILE_COUNT"
            ? `Puede adjuntar como máximo ${MAX_CATALOGO_TECNICO_FILES} archivos por operación.`
            : "No fue posible procesar el catálogo técnico adjunto."
      ));
      return;
    }
    next(error);
  });
};

const safeOriginalName = (name: string): string => {
  const sanitized = path.basename(name)
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  return (sanitized || "catalogo_tecnico.pdf").slice(0, 255);
};

export const catalogoTecnicoFromUpload = (
  file: Express.Multer.File | undefined
): CatalogoTecnicoAlmacenado | undefined => file ? {
  nombreOriginal: safeOriginalName(file.originalname),
  nombreAlmacenado: file.filename,
  mimeType: "application/pdf",
  tamanoBytes: file.size,
  ruta: file.filename
} : undefined;

export const catalogosTecnicosFromUpload = (
  files: Express.Multer.File[] | Record<string, Express.Multer.File[]> | undefined
): CatalogoTecnicoAlmacenado[] => {
  const uploaded = Array.isArray(files)
    ? files
    : files
      ? Object.values(files).flat()
      : [];
  return uploaded.map((file) => catalogoTecnicoFromUpload(file)!).filter(Boolean);
};

export const validateTechnicalCatalogSignature = async (
  document: CatalogoTecnicoAlmacenado | undefined
): Promise<void> => {
  if (!document) return;

  const signature = Buffer.alloc(5);
  try {
    const handle = await open(resolveTechnicalCatalogPath(document.ruta), "r");
    try {
      await handle.read(signature, 0, signature.length, 0);
    } finally {
      await handle.close();
    }
  } catch {
    await removeTechnicalCatalogFile(document.ruta);
    throw new ValidationError("No fue posible validar el contenido del catálogo técnico adjunto.");
  }

  if (!signature.equals(Buffer.from("%PDF-"))) {
    await removeTechnicalCatalogFile(document.ruta);
    throw new ValidationError("El contenido del archivo no corresponde al formato PDF indicado.");
  }
};

export const resolveTechnicalCatalogPath = (relativePath: string): string => {
  const absolutePath = path.resolve(storageRoot, relativePath);
  if (
    absolutePath === storageRoot ||
    !absolutePath.startsWith(`${storageRoot}${path.sep}`)
  ) {
    throw new Error("Ruta de catálogo técnico inválida.");
  }
  return absolutePath;
};

export const removeTechnicalCatalogFile = async (
  relativePath: string | null | undefined
): Promise<void> => {
  if (!relativePath) return;
  try {
    await rm(resolveTechnicalCatalogPath(relativePath), { force: true });
  } catch {
    console.error("No fue posible eliminar un catálogo técnico reemplazado.");
  }
};
