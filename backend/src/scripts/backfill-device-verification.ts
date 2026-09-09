import type { PoolClient } from "pg";
import { pool } from "../config/database";
import { env } from "../config/env";
import {
  calcularEstadoVerificacion,
  type ExistingVerificationEvidence,
  type VerificationDeviceEvidence,
  type VerificationEventEvidence
} from "../modules/dispositivos/verification-backfill";

interface DeviceRow {
  id: string;
  codigo_inventario: number;
  imei: string | null;
  numero_serie: string | null;
}

interface EventRow {
  id: string;
  dispositivo_id: string;
  tipo_evento: string;
  fecha_evento: Date | string;
  usuario_ejecutor_id: string | null;
  responsable: string;
  detalle: Record<string, unknown>;
}

interface VerificationRow extends ExistingVerificationEvidence {
  dispositivo_id: string;
  fecha_verificacion: Date | string;
}

const identifier = (device: Pick<VerificationDeviceEvidence, "imei" | "numeroSerie">): string | null =>
  device.imei ?? device.numeroSerie;

const asEvent = (row: EventRow): VerificationEventEvidence => ({
  id: row.id,
  tipoEvento: row.tipo_evento,
  fechaEvento: row.fecha_evento,
  usuarioEjecutorId: row.usuario_ejecutor_id,
  responsable: row.responsable,
  detalle: row.detalle
});

const loadDevices = async (): Promise<VerificationDeviceEvidence[]> => {
  const devices = await pool.query<DeviceRow>(
    `SELECT id,codigo_inventario,imei,numero_serie
       FROM itam.dispositivos
      ORDER BY codigo_inventario,id`
  );
  const events = await pool.query<EventRow>(
    `SELECT id,dispositivo_id,tipo_evento,fecha_evento,usuario_ejecutor_id,
            responsable,detalle
       FROM itam.historial_eventos
      WHERE tipo_entidad='DISPOSITIVO' AND dispositivo_id IS NOT NULL
      ORDER BY fecha_evento,id`
  );
  const verifications = await pool.query<VerificationRow>(
    `SELECT id,dispositivo_id,resultado,fecha_verificacion
       FROM itam.verificaciones_fisicas_dispositivo
      ORDER BY fecha_verificacion,id`
  );
  const eventsByDevice = new Map<string, VerificationEventEvidence[]>();
  for (const row of events.rows) {
    eventsByDevice.set(row.dispositivo_id, [...(eventsByDevice.get(row.dispositivo_id) ?? []), asEvent(row)]);
  }
  const verificationByDevice = new Map<string, ExistingVerificationEvidence[]>();
  for (const row of verifications.rows) {
    verificationByDevice.set(row.dispositivo_id, [
      ...(verificationByDevice.get(row.dispositivo_id) ?? []),
      { id: row.id, resultado: row.resultado }
    ]);
  }
  return devices.rows.map((row) => ({
    id: row.id,
    codigoInventario: row.codigo_inventario,
    imei: row.imei,
    numeroSerie: row.numero_serie,
    eventos: eventsByDevice.get(row.id) ?? [],
    verificaciones: verificationByDevice.get(row.id) ?? []
  }));
};

const countBy = (decisions: ReturnType<typeof calcularEstadoVerificacion>[]) => ({
  total: decisions.length,
  manualesVerificados: decisions.filter((item) => item.categoria === "MANUAL" && item.resultado === "VERIFICADO").length,
  importadosVerificadosPorOperacion: decisions.filter((item) => item.categoria === "OPERACION_POSTERIOR").length,
  importadosPendientes: decisions.filter((item) => item.categoria === "IMPORTADO_PENDIENTE").length,
  revisarExistentes: decisions.filter((item) => item.categoria === "REVISAR_EXISTENTE").length,
  sinEvidencia: decisions.filter((item) => item.categoria === "SIN_EVIDENCIA").length,
  verificados: decisions.filter((item) => item.resultado === "VERIFICADO").length,
  pendientes: decisions.filter((item) => item.resultado === "PENDIENTE").length
});

const printSummary = (
  devices: VerificationDeviceEvidence[],
  decisions: ReturnType<typeof calcularEstadoVerificacion>[]
): void => {
  const summary = countBy(decisions);
  const samples = (category: string, result: string) => devices
    .map((device, index) => ({ device, decision: decisions[index]! }))
    .filter(({ decision }) => decision.categoria === category && decision.resultado === result)
    .slice(0, 5)
    .map(({ device, decision }) => ({ codigoItam: device.codigoInventario, resultado: decision.resultado, motivo: decision.motivo }));
  console.log(JSON.stringify({
    mode: process.argv.includes("--apply") ? "APPLY" : "DRY_RUN",
    database: env.database.name,
    ...summary,
    muestras: {
      manuales: samples("MANUAL", "VERIFICADO"),
      importadosPendientes: samples("IMPORTADO_PENDIENTE", "PENDIENTE"),
      importadosConOperacionPosterior: samples("OPERACION_POSTERIOR", "VERIFICADO")
    },
    writesPerformed: false
  }, null, 2));
};

const applyDecisions = async (
  client: PoolClient,
  devices: VerificationDeviceEvidence[],
  decisions: ReturnType<typeof calcularEstadoVerificacion>[]
): Promise<number> => {
  let writes = 0;
  for (let index = 0; index < devices.length; index += 1) {
    const device = devices[index]!;
    const decision = decisions[index]!;
    if (decision.resultado !== "VERIFICADO" || !decision.eventoEvidencia || !decision.eventoEvidencia.usuarioEjecutorId) continue;
    const actorId = decision.eventoEvidencia.usuarioEjecutorId;
    const expected = identifier(device);
    const observation = `Backfill de verificación: ${decision.motivo}`;
    if (decision.verificacionExistenteId) {
      await client.query(
        `UPDATE itam.verificaciones_fisicas_dispositivo
            SET encontrado=TRUE,
                identificador_comprobado=$2,
                identificador_esperado=$2,
                resultado='VERIFICADO',
                observacion=$3,
                usuario_id=$4,
                fecha_verificacion=$5
          WHERE id=$1 AND resultado='PENDIENTE'`,
        [decision.verificacionExistenteId, expected, observation, actorId, decision.eventoEvidencia.fechaEvento]
      );
    } else {
      await client.query(
        `INSERT INTO itam.verificaciones_fisicas_dispositivo
          (dispositivo_id,encontrado,identificador_comprobado,identificador_esperado,
           resultado,observacion,usuario_id,fecha_verificacion)
         VALUES($1,TRUE,$2,$2,'VERIFICADO',$3,$4,$5)`,
        [device.id, expected, observation, actorId, decision.eventoEvidencia.fechaEvento]
      );
    }
    writes += 1;
  }
  return writes;
};

const main = async (): Promise<void> => {
  const current = await pool.query<{ database: string }>("SELECT current_database() AS database");
  if (current.rows[0]?.database !== "itam_dev" || env.database.name !== "itam_dev") {
    throw new Error(`Backfill bloqueado: se exige itam_dev; conexión actual: ${current.rows[0]?.database ?? "desconocida"}.`);
  }
  const devices = await loadDevices();
  const decisions = devices.map(calcularEstadoVerificacion);
  printSummary(devices, decisions);
  if (!process.argv.includes("--apply")) return;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const writes = await applyDecisions(client, devices, decisions);
    await client.query("COMMIT");
    console.log(JSON.stringify({ mode: "APPLY_COMMITTED", writesPerformed: writes }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

void main().catch((error) => {
  console.error(JSON.stringify({ error: error instanceof Error ? error.message : "Backfill fallido.", writesCommitted: false }));
  process.exitCode = 1;
}).finally(async () => {
  await pool.end().catch(() => undefined);
});
