import { stat } from "node:fs/promises";
import { pool } from "../../config/database";
import { ConflictError, NotFoundError, isUniqueViolation } from "../../shared/errors";
import { toIsoDate, toIsoDateTime } from "../../shared/dates";
import {
  listarFacturas,
  obtenerDispositivosFactura,
  obtenerFacturaRow
} from "./facturas-adquisicion.repository";
import {
  removeInvoiceDocument,
  resolveInvoiceDocumentPath
} from "./facturas-adquisicion.upload";
import type {
  FacturaAdquisicion,
  FacturaAdquisicionInput,
  FacturaDocumento,
  FacturaDocumentoAlmacenado
} from "./facturas-adquisicion.types";

const mapDocument = (row: Record<string, unknown>): FacturaDocumento | null => {
  if (!row.documento_nombre_original ||
      !row.documento_mime_type ||
      row.documento_tamano_bytes === null) return null;
  return {
    nombreOriginal: String(row.documento_nombre_original),
    mimeType: String(row.documento_mime_type) as FacturaDocumento["mimeType"],
    tamanoBytes: Number(row.documento_tamano_bytes)
  };
};

const map = async (row: Record<string, unknown>): Promise<FacturaAdquisicion> => ({
  id: String(row.id),
  numeroFactura: String(row.numero_factura),
  fechaFactura: row.fecha_factura ? toIsoDate(row.fecha_factura as Date) : null,
  proveedor: row.proveedor ? String(row.proveedor) : null,
  montoTotal: row.monto_total === null ? null : Number(row.monto_total),
  observaciones: row.observaciones ? String(row.observaciones) : null,
  referenciaDocumental: row.referencia_documental
    ? String(row.referencia_documental) : null,
  documento: mapDocument(row),
  dispositivos: (await obtenerDispositivosFactura(Number(row.id))).map(
    (device: Record<string, unknown>) => ({
      id: String(device.id),
      codigoInventario: Number(device.codigo_inventario),
      tipo: String(device.tipo),
      marca: device.marca ? String(device.marca) : null,
      modelo: device.modelo ? String(device.modelo) : null
    })
  ),
  creadoEn: toIsoDateTime(row.creado_en as Date),
  actualizadoEn: toIsoDateTime(row.actualizado_en as Date)
});

export const obtenerFacturas = async (): Promise<FacturaAdquisicion[]> =>
  Promise.all((await listarFacturas()).map(map));

export const obtenerFactura = async (id: number): Promise<FacturaAdquisicion> => {
  const row = await obtenerFacturaRow(id);
  if (!row) throw new NotFoundError("Antecedente de adquisición no encontrado.");
  return map(row);
};

export const crearFactura = async (
  input: FacturaAdquisicionInput,
  documento?: FacturaDocumentoAlmacenado
): Promise<FacturaAdquisicion> => {
  const client = await pool.connect();
  let facturaId: number | null = null;
  try {
    await client.query("BEGIN");
    const inserted = await client.query(
      `INSERT INTO itam.facturas_adquisicion (
         numero_factura, fecha_factura, proveedor, monto_total, observaciones,
         referencia_documental, documento_nombre_original,
         documento_nombre_almacenado, documento_mime_type,
         documento_tamano_bytes, documento_ruta
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
      [
        input.numeroFactura, input.fechaFactura ?? null,
        input.proveedor ?? null, input.montoTotal ?? null,
        input.observaciones ?? null, input.referenciaDocumental ?? null,
        documento?.nombreOriginal ?? null, documento?.nombreAlmacenado ?? null,
        documento?.mimeType ?? null, documento?.tamanoBytes ?? null,
        documento?.ruta ?? null
      ]
    );
    facturaId = Number(inserted.rows[0].id);
    const linked = await client.query(
      `UPDATE itam.dispositivos SET factura_adquisicion_id = $1
        WHERE codigo_inventario = ANY($2::integer[])
          AND factura_adquisicion_id IS NULL RETURNING id`,
      [facturaId, input.dispositivosCodigos]
    );
    if (linked.rowCount !== input.dispositivosCodigos.length) {
      throw new ConflictError(
        "Uno o más activos no existen o ya tienen antecedentes de adquisición."
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    await removeInvoiceDocument(documento?.ruta);
    if (isUniqueViolation(error)) {
      throw new ConflictError("La factura ya está registrada para ese proveedor.");
    }
    throw error;
  } finally {
    client.release();
  }
  return obtenerFactura(facturaId!);
};

export const actualizarFactura = async (
  id: number,
  input: Partial<FacturaAdquisicionInput>,
  documento?: FacturaDocumentoAlmacenado
): Promise<FacturaAdquisicion> => {
  const client = await pool.connect();
  let previousDocumentPath: string | null = null;
  try {
    await client.query("BEGIN");
    const existing = await client.query(
      `SELECT documento_ruta FROM itam.facturas_adquisicion
        WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!existing.rows[0]) {
      throw new NotFoundError("Antecedente de adquisición no encontrado.");
    }
    previousDocumentPath = existing.rows[0].documento_ruta ?? null;
    await client.query(
      `UPDATE itam.facturas_adquisicion
        SET numero_factura = COALESCE($2, numero_factura),
            fecha_factura = CASE WHEN $3::boolean THEN $4::date ELSE fecha_factura END,
            proveedor = CASE WHEN $5::boolean THEN $6 ELSE proveedor END,
            monto_total = CASE WHEN $7::boolean THEN $8 ELSE monto_total END,
            observaciones = CASE WHEN $9::boolean THEN $10 ELSE observaciones END,
            referencia_documental = CASE WHEN $11::boolean THEN $12 ELSE referencia_documental END
        WHERE id = $1`,
      [
        id, input.numeroFactura ?? null,
        input.fechaFactura !== undefined, input.fechaFactura ?? null,
        input.proveedor !== undefined, input.proveedor ?? null,
        input.montoTotal !== undefined, input.montoTotal ?? null,
        input.observaciones !== undefined, input.observaciones ?? null,
        input.referenciaDocumental !== undefined,
        input.referenciaDocumental ?? null
      ]
    );
    if (documento) {
      await client.query(
        `UPDATE itam.facturas_adquisicion
          SET documento_nombre_original = $2,
              documento_nombre_almacenado = $3,
              documento_mime_type = $4,
              documento_tamano_bytes = $5,
              documento_ruta = $6
          WHERE id = $1`,
        [
          id, documento.nombreOriginal, documento.nombreAlmacenado,
          documento.mimeType, documento.tamanoBytes, documento.ruta
        ]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    await removeInvoiceDocument(documento?.ruta);
    if (isUniqueViolation(error)) {
      throw new ConflictError("La factura ya está registrada para ese proveedor.");
    }
    throw error;
  } finally {
    client.release();
  }
  if (documento && previousDocumentPath !== documento.ruta) {
    await removeInvoiceDocument(previousDocumentPath);
  }
  return obtenerFactura(id);
};

export const obtenerDocumentoFactura = async (
  id: number
): Promise<{
  absolutePath: string;
  nombreOriginal: string;
  mimeType: string;
  tamanoBytes: number;
}> => {
  const row = await obtenerFacturaRow(id);
  if (!row || !row.documento_ruta || !row.documento_nombre_original ||
      !row.documento_mime_type || row.documento_tamano_bytes === null) {
    throw new NotFoundError("La factura no tiene un documento adjunto.");
  }
  const absolutePath = resolveInvoiceDocumentPath(row.documento_ruta);
  const expectedSize = Number(row.documento_tamano_bytes);
  try {
    const file = await stat(absolutePath);
    if (!file.isFile() || file.size !== expectedSize) {
      throw new Error("Archivo inconsistente.");
    }
  } catch {
    throw new NotFoundError("El documento de factura no está disponible.");
  }
  return {
    absolutePath,
    nombreOriginal: row.documento_nombre_original,
    mimeType: row.documento_mime_type,
    tamanoBytes: expectedSize
  };
};
