import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { NotFoundError } from "../../shared/errors";
import type {
  CatalogoTecnicoAlmacenado,
  CatalogoTecnicoRow
} from "./catalogo-tecnico.types";

export const obtenerCatalogoTecnicoPorCodigo = async (
  codigoInventario: number
): Promise<CatalogoTecnicoRow | null> => {
  const result = await pool.query<CatalogoTecnicoRow>(
    `SELECT catalogo.*
       FROM itam.catalogos_tecnicos_dispositivo catalogo
       INNER JOIN itam.dispositivos dispositivo
         ON dispositivo.id = catalogo.dispositivo_id
      WHERE dispositivo.codigo_inventario = $1
      LIMIT 1`,
    [codigoInventario]
  );
  return result.rows[0] ?? null;
};

export const reemplazarCatalogoTecnico = async (
  codigoInventario: number,
  document: CatalogoTecnicoAlmacenado,
  subidoPor: string
): Promise<{ row: CatalogoTecnicoRow; previousPath: string | null }> => {
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
    if (!device.rows[0]) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    const previous = await client.query<{ ruta: string }>(
      `SELECT ruta
         FROM itam.catalogos_tecnicos_dispositivo
        WHERE dispositivo_id = $1
        FOR UPDATE`,
      [device.rows[0].id]
    );

    const saved = await client.query<CatalogoTecnicoRow>(
      `INSERT INTO itam.catalogos_tecnicos_dispositivo (
         dispositivo_id, nombre_original, nombre_almacenado,
         mime_type, tamano_bytes, ruta, subido_por
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (dispositivo_id) DO UPDATE SET
         nombre_original = EXCLUDED.nombre_original,
         nombre_almacenado = EXCLUDED.nombre_almacenado,
         mime_type = EXCLUDED.mime_type,
         tamano_bytes = EXCLUDED.tamano_bytes,
         ruta = EXCLUDED.ruta,
         subido_por = EXCLUDED.subido_por,
         creado_en = NOW()
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

    await client.query("COMMIT");
    return {
      row: saved.rows[0],
      previousPath: previous.rows[0]?.ruta ?? null
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
