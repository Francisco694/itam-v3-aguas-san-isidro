import assert from "node:assert/strict";
import test from "node:test";
import { ConflictError } from "../../shared/errors";
import {
  assertAsignadoConCustodioUnico,
  assertCambioEstadoGenericoPermitido,
  assertColaboradorActivo,
  detectarCambiosDispositivo
} from "./dispositivos.service";
import type { ActualizarDispositivoInput, DispositivoRow } from "./dispositivos.types";

test("P1-01: ASIGNADO exige exactamente un custodio", () => {
  assert.doesNotThrow(() => assertAsignadoConCustodioUnico("1", null));
  assert.doesNotThrow(() => assertAsignadoConCustodioUnico(null, "2"));
  assert.throws(() => assertAsignadoConCustodioUnico(null, null), ConflictError);
  assert.throws(() => assertAsignadoConCustodioUnico("1", "2"), ConflictError);
});

test("P1-05: el cambio generico no permite salir de DADO_BAJA", () => {
  assert.throws(
    () => assertCambioEstadoGenericoPermitido("DADO_BAJA", "DISPONIBLE", null, null),
    (error: unknown) => error instanceof ConflictError && error.statusCode === 409
  );
});

test("P1-07: un colaborador inactivo no puede recibir custodia", () => {
  assert.throws(() => assertColaboradorActivo({ activo: false }), ConflictError);
  assert.doesNotThrow(() => assertColaboradorActivo({ activo: true }));
});

test("P1-08: registra solo diferencias reales y omite no-op", () => {
  const base = {
    marca: "Dell", modelo: "Latitude", numero_serie: "SERIE-1", imei: null,
    localidad: "Central", ubicacion_detalle: "Piso 1", observaciones: null,
    atributos_especificos: { ram: "16 GB" }, valor_comercial: "1000"
  } as unknown as DispositivoRow;
  const changed = { ...base, imei: "123456789012345", valor_comercial: "1500" };
  const input = {
    imei: "123456789012345", valorComercial: 1500, responsable: "Actor de sesion"
  } satisfies ActualizarDispositivoInput;
  assert.deepEqual(detectarCambiosDispositivo(base, changed, input), [
    { campo: "imei", valorAnterior: null, valorNuevo: "123456789012345" },
    { campo: "valorComercial", valorAnterior: 1000, valorNuevo: 1500 }
  ]);
  assert.deepEqual(detectarCambiosDispositivo(base, base, {
    marca: "Dell", responsable: "Actor de sesion"
  }), []);
});
