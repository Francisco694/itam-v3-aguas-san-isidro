import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../config/database";
import { listarEvidenciasResponsablesDispositivo } from "../modules/dispositivos/dispositivos.repository";

type SuspiciousReason =
  | "creación directa"
  | "recepción en bodega"
  | "recuperación de baja";

interface CandidateRow {
  codigo_itam: number;
  tipo_equipo: string;
  marca: string | null;
  modelo: string | null;
  imei: string | null;
  numero_serie: string | null;
  estado_actual: string;
  responsable_actual: string | null;
  localidad: string | null;
  ubicacion_detalle: string | null;
  fecha_verificado: Date | string;
  motivo_sospecha: SuspiciousReason;
  verificacion_manual_posterior: boolean;
  otra_revision_posterior: boolean;
}

interface AuditReportRow {
  codigoItam: number;
  tipoEquipo: string;
  marcaModelo: string;
  identificador: string;
  estadoActual: string;
  responsableActualOUltimoConocido: string;
  ubicacion: string;
  fechaVerificado: string;
  eventoOrigen: string;
  motivoSospecha: SuspiciousReason;
  recomendacion:
    | "mantener VERIFICADO"
    | "volver a PENDIENTE"
    | "requiere revisión manual";
}

const query = `
  WITH sospechosas AS (
    SELECT
      h.dispositivo_id,
      h.fecha_evento AS fecha_verificado,
      CASE h.detalle->>'motivo'
        WHEN 'equipo creado directamente en ITAM' THEN 'creación directa'
        WHEN 'recibido en bodega' THEN 'recepción en bodega'
        WHEN 'recuperado de baja' THEN 'recuperación de baja'
      END AS motivo_sospecha
    FROM itam.historial_eventos h
    WHERE h.tipo_entidad = 'DISPOSITIVO'
      AND h.tipo_evento = 'VERIFICACION_FISICA'
      AND h.detalle->>'resultado' = 'VERIFICADO'
      AND h.detalle->>'motivo' IN (
        'equipo creado directamente en ITAM',
        'recibido en bodega',
        'recuperado de baja'
      )
  )
  SELECT
    d.codigo_inventario AS codigo_itam,
    tipo.nombre AS tipo_equipo,
    d.marca,
    d.modelo,
    d.imei,
    d.numero_serie,
    estado.nombre AS estado_actual,
    COALESCE(colaborador.nombre, departamento.nombre) AS responsable_actual,
    d.localidad,
    d.ubicacion_detalle,
    sospechosas.fecha_verificado,
    sospechosas.motivo_sospecha,
    EXISTS (
      SELECT 1
      FROM itam.historial_eventos manual
      WHERE manual.dispositivo_id = d.id
        AND manual.tipo_evento = 'VERIFICACION_MANUAL_EQUIPO'
        AND manual.fecha_evento > sospechosas.fecha_verificado
    ) AS verificacion_manual_posterior,
    EXISTS (
      SELECT 1
      FROM itam.historial_eventos revision
      WHERE revision.dispositivo_id = d.id
        AND revision.tipo_evento = 'VERIFICACION_FISICA'
        AND revision.fecha_evento > sospechosas.fecha_verificado
    ) AS otra_revision_posterior
  FROM sospechosas
  JOIN itam.dispositivos d ON d.id = sospechosas.dispositivo_id
  JOIN itam.tipos_dispositivo tipo ON tipo.id = d.tipo_dispositivo_id
  JOIN itam.estados estado ON estado.id = d.estado_id
  LEFT JOIN itam.colaboradores colaborador ON colaborador.id = d.colaborador_id
  LEFT JOIN itam.departamentos departamento ON departamento.id = d.departamento_id
  ORDER BY d.codigo_inventario
`;

const cleanJoin = (...parts: Array<string | null>): string =>
  parts.map((part) => part?.trim()).filter(Boolean).join(" ") || "Sin información";

const location = (row: CandidateRow): string =>
  [row.localidad?.trim(), row.ubicacion_detalle?.trim()].filter(Boolean).join(" · ")
  || "Sin ubicación registrada";

const eventFor = (reason: SuspiciousReason): string => ({
  "creación directa": "ALTA_DISPOSITIVO → VERIFICACION_FISICA",
  "recepción en bodega": "DEVOLVER_DISPOSITIVO → VERIFICACION_FISICA",
  "recuperación de baja": "RECUPERAR_DADO_BAJA → VERIFICACION_FISICA"
})[reason];

const recommendationFor = (
  row: CandidateRow
): AuditReportRow["recomendacion"] => {
  if (row.verificacion_manual_posterior) return "mantener VERIFICADO";
  if (row.otra_revision_posterior) return "requiere revisión manual";
  return "volver a PENDIENTE";
};

const csvCell = (value: string | number): string => {
  const text = String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

const main = async (): Promise<void> => {
  const result = await pool.query<CandidateRow>(query);
  const report: AuditReportRow[] = [];

  for (const row of result.rows) {
    const lastKnown = row.responsable_actual
      ? null
      : (await listarEvidenciasResponsablesDispositivo(row.codigo_itam))[0]?.nombre;
    report.push({
      codigoItam: row.codigo_itam,
      tipoEquipo: row.tipo_equipo,
      marcaModelo: cleanJoin(row.marca, row.modelo),
      identificador: row.imei
        ? `IMEI: ${row.imei}`
        : row.numero_serie
          ? `N° serie: ${row.numero_serie}`
          : "Sin IMEI o número de serie",
      estadoActual: row.estado_actual,
      responsableActualOUltimoConocido:
        row.responsable_actual ?? lastKnown ?? "Sin responsable conocido",
      ubicacion: location(row),
      fechaVerificado: new Date(row.fecha_verificado).toISOString(),
      eventoOrigen: eventFor(row.motivo_sospecha),
      motivoSospecha: row.motivo_sospecha,
      recomendacion: recommendationFor(row)
    });
  }

  console.table(report);

  const headers: Array<keyof AuditReportRow> = [
    "codigoItam",
    "tipoEquipo",
    "marcaModelo",
    "identificador",
    "estadoActual",
    "responsableActualOUltimoConocido",
    "ubicacion",
    "fechaVerificado",
    "eventoOrigen",
    "motivoSospecha",
    "recomendacion"
  ];
  const csv = [
    headers.map(csvCell).join(","),
    ...report.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\r\n");
  const reportsDirectory = path.resolve(__dirname, "../../reports");
  const outputPath = path.join(reportsDirectory, "auditoria-verificaciones-automaticas.csv");
  await fs.mkdir(reportsDirectory, { recursive: true });
  await fs.writeFile(outputPath, `\uFEFF${csv}\r\n`, "utf8");
  console.log(`Reporte generado: ${outputPath}`);
  console.log(`Registros incluidos: ${report.length}. Escrituras en base de datos: 0.`);
};

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "No se pudo generar el reporte.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => undefined);
  });
