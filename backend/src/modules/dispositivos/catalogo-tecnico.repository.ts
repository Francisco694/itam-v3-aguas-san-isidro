import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import type {
  CatalogoTecnicoAlmacenado,
  CatalogoTecnicoRow
} from "./catalogo-tecnico.types";

export const obtenerCatalogosTecnicosPorCodigo = async (
  codigoInventario: number
): Promise<CatalogoTecnicoRow[]> => {
  const result = await pool.query<CatalogoTecnicoRow>(
    `SELECT catalogo.*
       FROM itam.catalogos_tecnicos_dispositivo catalogo
       INNER JOIN itam.dispositivos dispositivo
         ON dispositivo.id = catalogo.dispositivo_id
      WHERE dispositivo.codigo_inventario = $1
      ORDER BY catalogo.creado_en DESC, catalogo.id DESC`,
    [codigoInventario]
  );
  return result.rows;
};

export const obtenerCatalogoTecnicoPorId = async (
  codigoInventario: number,
  catalogoId?: number
): Promise<CatalogoTecnicoRow | null> => {
  const result = await pool.query<CatalogoTecnicoRow>(
    `SELECT catalogo.*
       FROM itam.catalogos_tecnicos_dispositivo catalogo
       INNER JOIN itam.dispositivos dispositivo
         ON dispositivo.id = catalogo.dispositivo_id
      WHERE dispositivo.codigo_inventario = $1
        AND ($2::BIGINT IS NULL OR catalogo.id = $2)
      ORDER BY catalogo.creado_en DESC, catalogo.id DESC
      LIMIT 1`,
    [codigoInventario, catalogoId ?? null]
  );
  return result.rows[0] ?? null;
};

export const reemplazarCatalogoTecnico = async (
  codigoInventario: number,
  catalogoId: number,
  document: CatalogoTecnicoAlmacenado,
  subidoPor: string
): Promise<CatalogoTecnicoRow | null> => {
  const result = await pool.query<CatalogoTecnicoRow>(
    `UPDATE itam.catalogos_tecnicos_dispositivo AS catalogo
        SET nombre_original = $3,
            nombre_almacenado = $4,
            mime_type = $5,
            tamano_bytes = $6,
            ruta = $7,
            subido_por = $8,
            creado_en = NOW()
       FROM itam.dispositivos AS dispositivo
      WHERE catalogo.id = $1
        AND catalogo.dispositivo_id = dispositivo.id
        AND dispositivo.codigo_inventario = $2
      RETURNING catalogo.*`,
    [
      catalogoId,
      codigoInventario,
      document.nombreOriginal,
      document.nombreAlmacenado,
      document.mimeType,
      document.tamanoBytes,
      document.ruta,
      subidoPor
    ]
  );
  return result.rows[0] ?? null;
};

export const eliminarCatalogoTecnico = async (
  codigoInventario: number,
  catalogoId: number
): Promise<CatalogoTecnicoRow | null> => {
  const result = await pool.query<CatalogoTecnicoRow>(
    `DELETE FROM itam.catalogos_tecnicos_dispositivo AS catalogo
      USING itam.dispositivos AS dispositivo
      WHERE catalogo.id = $1
        AND catalogo.dispositivo_id = dispositivo.id
        AND dispositivo.codigo_inventario = $2
      RETURNING catalogo.*`,
    [catalogoId, codigoInventario]
  );
  return result.rows[0] ?? null;
};

export const agregarCatalogosTecnicos = async (
  codigoInventario: number,
  documents: CatalogoTecnicoAlmacenado[],
  subidoPor: string
): Promise<CatalogoTecnicoRow[]> => {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    const device = await client.query<{ id: string }>(
      `SELECT id
         FROM itam.dispositivos
        WHERE codigo_inventario = $1
        FOR UPDATE`,
      [codigoInventario]
    );
    if (!device.rows[0]) throw new NotFoundError("Dispositivo no encontrado.");

    const rows: CatalogoTecnicoRow[] = [];
    for (const document of documents) {
      const saved = await client.query<CatalogoTecnicoRow>(
        `INSERT INTO itam.catalogos_tecnicos_dispositivo (
           dispositivo_id, nombre_original, nombre_almacenado,
           mime_type, tamano_bytes, ruta, subido_por
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          device.rows[0].id,
          document.nombreOriginal,
          document.nombreAlmacenado,
          document.mimeType,
          document.tamanoBytes,
          document.ruta,
          subidoPor
        ]
      );
      rows.push(saved.rows[0]!);
    }

    await client.query("COMMIT");
    return rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
