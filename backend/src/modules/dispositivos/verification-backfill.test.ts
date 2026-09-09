import assert from "node:assert/strict";
import test from "node:test";
import { calcularEstadoVerificacion } from "./verification-backfill";
import type {
  ExistingVerificationEvidence,
  VerificationDeviceEvidence,
  VerificationEventEvidence
} from "./verification-backfill";

const event = (
  id: string,
  tipoEvento: string,
  fechaEvento: string,
  usuarioEjecutorId: string | null,
  detalle: Record<string, unknown> = {},
  responsable = "Usuario TI"
): VerificationEventEvidence => ({
  id,
  tipoEvento,
  fechaEvento,
  usuarioEjecutorId,
  responsable,
  detalle
});

const device = (
  eventos: VerificationEventEvidence[],
  verificaciones: ExistingVerificationEvidence[] = []
): VerificationDeviceEvidence => ({
  id: "1",
  codigoInventario: 1001,
  imei: "357859710723803",
  numeroSerie: null,
  eventos,
  verificaciones
});

test("backfill: creación manual queda verificada", () => {
  const result = calcularEstadoVerificacion(device([
    event("1", "ALTA_DISPOSITIVO", "2026-09-01T10:00:00Z", "4", { codigoInventario: 1444 })
  ]));
  assert.equal(result.resultado, "VERIFICADO");
  assert.equal(result.categoria, "MANUAL");
});

test("backfill: importador solo queda pendiente", () => {
  const result = calcularEstadoVerificacion(device([
    event("1", "ALTA_DISPOSITIVO", "2026-08-25T10:00:00Z", null, { source: "Inventario.xlsx" }, "Importador Inventario.xlsx"),
    event("2", "ASIGNAR_COLABORADOR", "2026-08-25T10:00:00Z", null, { source: "Inventario.xlsx", collaboratorId: "1" }, "Importador Inventario.xlsx")
  ]));
  assert.equal(result.resultado, "PENDIENTE");
  assert.equal(result.categoria, "IMPORTADO_PENDIENTE");
});

test("backfill: operación física posterior verifica un importado", () => {
  const result = calcularEstadoVerificacion(device([
    event("1", "ALTA_DISPOSITIVO", "2026-08-25T10:00:00Z", null, { source: "Inventario.xlsx" }, "Importador Inventario.xlsx"),
    event("2", "ENVIAR_SERVICIO_TECNICO", "2026-09-02T10:00:00Z", "4", { ordenServicioId: "61" })
  ]));
  assert.equal(result.resultado, "VERIFICADO");
  assert.equal(result.categoria, "OPERACION_POSTERIOR");
});

test("backfill: un evento histórico de entrega del importador no verifica", () => {
  const result = calcularEstadoVerificacion(device([
    event("1", "ASIGNAR_COLABORADOR", "2017-11-28T10:00:00Z", null, {
      source: "Importación conciliación RRHH + Inventario SQL",
      importKey: "RECONCILED:IMEI-1:CUSTODY",
      collaboratorId: "36"
    }, "Importador conciliación RRHH + Inventario SQL")
  ]));
  assert.equal(result.resultado, "PENDIENTE");
});

test("backfill: REVISAR existente se conserva", () => {
  const result = calcularEstadoVerificacion(device(
    [event("1", "ALTA_DISPOSITIVO", "2026-09-01T10:00:00Z", "4")],
    [{ id: "55", resultado: "REVISAR" }]
  ));
  assert.equal(result.resultado, "REVISAR");
  assert.equal(result.categoria, "REVISAR_EXISTENTE");
});
