import assert from "node:assert/strict";
import test from "node:test";
import { parseCodigoItam } from "./dispositivos.controller";
import { construirTrazabilidadDispositivo } from "./dispositivos.service";
import type {
  DispositivoResumen,
  EvidenciaResponsableRow
} from "./dispositivos.types";

test("detalle: acepta un código ITAM válido", () => {
  assert.equal(parseCodigoItam("1001"), 1001);
});

test("detalle: rechaza un IMEI antes de consultar PostgreSQL", () => {
  assert.throws(
    () => parseCodigoItam("3578597107238037"),
    /Código ITAM inválido\./
  );
});

test("detalle: rechaza identificadores no enteros", () => {
  assert.throws(
    () => parseCodigoItam("12.5"),
    /Código ITAM inválido\./
  );
});

const dispositivo = (
  estado: string,
  custodia: "COLABORADOR" | "DEPARTAMENTO" | "NONE" = "NONE"
): DispositivoResumen => ({
  estado: { id: "1", codigo: estado, nombre: estado },
  colaborador: custodia === "COLABORADOR"
    ? { id: "7", nombre: "Persona responsable", rut: "11.111.111-1", cargo: null, localidad: null, departamento: null }
    : null,
  departamento: custodia === "DEPARTAMENTO" ? { id: "3", nombre: "Tecnología" } : null,
  tipoCustodia: custodia
} as DispositivoResumen);

const evidencia = (
  origen: EvidenciaResponsableRow["origen"] = "HISTORIAL"
): EvidenciaResponsableRow => ({
  fecha: "2026-08-01T10:00:00.000Z",
  tipo_evento: origen === "BAJA" ? "DAR_BAJA" : "ASIGNAR_COLABORADOR",
  tipo: "COLABORADOR",
  responsable_id: "7",
  nombre: "Persona responsable",
  rut: "11.111.111-1",
  estado_resultante_codigo: origen === "BAJA" ? "DADO_BAJA" : "ASIGNADO",
  estado_resultante_nombre: origen === "BAJA" ? "Dado de baja" : "Asignado",
  observacion: null,
  origen
});

test("trazabilidad: un dispositivo asignado expone al colaborador actual", () => {
  const actual = dispositivo("ASIGNADO", "COLABORADOR");
  const snapshot = structuredClone(actual);
  const result = construirTrazabilidadDispositivo(actual, [], []);

  assert.deepEqual(result.responsableActual, {
    tipo: "COLABORADOR",
    id: "7",
    nombre: "Persona responsable",
    rut: "11.111.111-1"
  });
  assert.deepEqual(actual, snapshot, "la clasificación de solo lectura no modifica el dispositivo");
});

test("trazabilidad: un dispositivo asignado sin custodio genera alerta", () => {
  const result = construirTrazabilidadDispositivo(dispositivo("ASIGNADO"), [], []);
  assert.equal(result.responsableActual, null);
  assert.deepEqual(result.alertas, ["Asignado sin responsable. Revisar custodia."]);
});

test("trazabilidad: un dispositivo disponible sin custodio no genera alerta", () => {
  const result = construirTrazabilidadDispositivo(dispositivo("DISPONIBLE"), [], []);
  assert.equal(result.responsableActual, null);
  assert.deepEqual(result.alertas, []);
});

test("trazabilidad: un extraviado recupera el último responsable desde historial", () => {
  const result = construirTrazabilidadDispositivo(
    dispositivo("EXTRAVIADO"),
    [],
    [evidencia("HISTORIAL")]
  );
  assert.equal(result.responsableActual, null);
  assert.equal(result.ultimoResponsableConocido?.nombre, "Persona responsable");
  assert.equal(result.ultimoResponsableConocido?.origenDato, "HISTORIAL");
  assert.deepEqual(result.alertas, []);
});

test("trazabilidad: una baja conserva evidencia de baja o comprobante", () => {
  for (const origen of ["BAJA", "COMPROBANTE"] as const) {
    const result = construirTrazabilidadDispositivo(
      dispositivo("DADO_BAJA"),
      [],
      [evidencia(origen)]
    );
    assert.equal(result.responsableActual, null);
    assert.equal(result.ultimoResponsableConocido?.origenDato, origen);
    assert.deepEqual(result.alertas, []);
  }
});

test("trazabilidad: sin evidencia no inventa responsable ni una devolución", () => {
  const eventos: never[] = [];
  const result = construirTrazabilidadDispositivo(
    dispositivo("EXTRAVIADO"),
    eventos,
    []
  );
  assert.equal(result.ultimoResponsableConocido, null);
  assert.deepEqual(Object.keys(result), [
    "dispositivo",
    "responsableActual",
    "ultimoResponsableConocido",
    "historialResponsables",
    "eventos",
    "alertas"
  ]);
  assert.deepEqual(result.historialResponsables, []);
  assert.strictEqual(result.eventos, eventos);
  assert.deepEqual(result.alertas, [
    "Equipo extraviado sin responsable conocido. Revisar historial."
  ]);
});
