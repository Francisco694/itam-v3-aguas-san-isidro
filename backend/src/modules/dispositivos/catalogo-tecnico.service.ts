import { stat } from "node:fs/promises";
import { NotFoundError } from "../../shared/errors";
import { toIsoDateTime } from "../../shared/dates";
import {
  obtenerCatalogoTecnicoPorCodigo,
  reemplazarCatalogoTecnico as reemplazarCatalogoTecnicoRow
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

export const obtenerCatalogoTecnico = async (
  codigoInventario: number
): Promise<CatalogoTecnico | null> => {
  const row = await obtenerCatalogoTecnicoPorCodigo(codigoInventario);
  return row ? mapCatalogoTecnico(row) : null;
};

export const reemplazarCatalogoTecnico = async (
  codigoInventario: number,
  document: CatalogoTecnicoAlmacenado,
  subidoPor: string
): Promise<CatalogoTecnico> => {
  const result = await reemplazarCatalogoTecnicoRow(
    codigoInventario,
    document,
    subidoPor
  );
  if (result.previousPath && result.previousPath !== document.ruta) {
    await removeTechnicalCatalogFile(result.previousPath);
  }
  return mapCatalogoTecnico(result.row);
};

export const obtenerArchivoCatalogoTecnico = async (
  codigoInventario: number
): Promise<{
  absolutePath: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
}> => {
  const row = await obtenerCatalogoTecnicoPorCodigo(codigoInventario);
  if (!row) {
    throw new NotFoundError("El dispositivo no tiene un catálogo técnico adjunto.");
  }

  const absolutePath = resolveTechnicalCatalogPath(row.ruta);
  const expectedSize = Number(row.tamano_bytes);
  try {
    const file = await stat(absolutePath);
    if (!file.isFile() || file.size !== expectedSize) {
      throw new Error("Archivo inconsistente.");
    }
  } catch {
    throw new NotFoundError("El catálogo técnico no está disponible.");
  }

  return {
    absolutePath,
    nombreOriginal: row.nombre_original,
    mimeType: row.mime_type,
    tamanoBytes: expectedSize
  };
};
