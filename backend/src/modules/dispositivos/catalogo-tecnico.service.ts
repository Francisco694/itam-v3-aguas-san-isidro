import { stat } from "node:fs/promises";
import { NotFoundError, ValidationError } from "../../shared/errors";
import { toIsoDateTime } from "../../shared/dates";
import {
  agregarCatalogosTecnicos as agregarCatalogosTecnicosRows,
  obtenerCatalogoTecnicoPorId,
  obtenerCatalogosTecnicosPorCodigo
} from "./catalogo-tecnico.repository";
import {
  removeTechnicalCatalogFile,
  resolveTechnicalCatalogPath
} from "./catalogo-tecnico.upload";
import type {
  CatalogoTecnico,
  CatalogoTecnicoAlmacenado,
  CatalogoTecnicoRow
} from "./catalogo-tecnico.types";

const mapCatalogoTecnico = (row: CatalogoTecnicoRow): CatalogoTecnico => ({
  id: String(row.id),
  dispositivoId: String(row.dispositivo_id),
  nombreOriginal: row.nombre_original,
  mimeType: row.mime_type,
  tamanoBytes: Number(row.tamano_bytes),
  subidoPor: row.subido_por,
  creadoEn: toIsoDateTime(row.creado_en)
});

export const obtenerCatalogosTecnicos = async (
  codigoInventario: number
): Promise<CatalogoTecnico[]> => {
  const rows = await obtenerCatalogosTecnicosPorCodigo(codigoInventario);
  return rows.map(mapCatalogoTecnico);
};

export const agregarCatalogosTecnicos = async (
  codigoInventario: number,
  documents: CatalogoTecnicoAlmacenado[],
  subidoPor: string
): Promise<CatalogoTecnico[]> => {
  if (!documents.length) throw new ValidationError("Debe adjuntar al menos un archivo PDF.");
  const rows = await agregarCatalogosTecnicosRows(codigoInventario, documents, subidoPor);
  return rows.map(mapCatalogoTecnico);
};

export const obtenerArchivoCatalogoTecnico = async (
  codigoInventario: number,
  catalogoId?: number
): Promise<{
  absolutePath: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
}> => {
  const row = await obtenerCatalogoTecnicoPorId(codigoInventario, catalogoId);
  if (!row) throw new NotFoundError("El dispositivo no tiene ese catÃ¡logo tÃ©cnico adjunto.");

  const absolutePath = resolveTechnicalCatalogPath(row.ruta);
  const expectedSize = Number(row.tamano_bytes);
  try {
    const file = await stat(absolutePath);
    if (!file.isFile() || file.size !== expectedSize) throw new Error("Archivo inconsistente.");
  } catch {
    throw new NotFoundError("El catÃ¡logo tÃ©cnico no estÃ¡ disponible.");
  }

  return {
    absolutePath,
    nombreOriginal: row.nombre_original,
    mimeType: row.mime_type,
    tamanoBytes: expectedSize
  };
};

export const removeUploadedTechnicalCatalogs = async (
  documents: CatalogoTecnicoAlmacenado[]
): Promise<void> => {
  await Promise.all(documents.map((document) => removeTechnicalCatalogFile(document.ruta)));
};
