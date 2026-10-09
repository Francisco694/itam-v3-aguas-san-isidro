import assert from "node:assert/strict";
import test from "node:test";
import { tipoDispositivoPermiteSim, tipoDispositivoRequiereImei } from "./tipos-dispositivo.types";

test("Router normal no requiere IMEI ni permite SIM", () => {
  const attributes = { utilizaRedMovil: false };
  assert.equal(tipoDispositivoRequiereImei("Router", false, attributes), false);
  assert.equal(tipoDispositivoPermiteSim("Router", { permiteSim: false }, attributes), false);
});

test("Router celular reutiliza las reglas de IMEI y SIM existentes", () => {
  const attributes = { utilizaRedMovil: true };
  assert.equal(tipoDispositivoRequiereImei("Router", false, attributes), true);
  assert.equal(tipoDispositivoPermiteSim("Router", { permiteSim: false }, attributes), true);
});

test("Smartphone conserva la regla histórica de IMEI y SIM", () => {
  assert.equal(tipoDispositivoRequiereImei("Smartphone", true, {}), true);
  assert.equal(tipoDispositivoPermiteSim("Smartphone", { permiteSim: false }), false);
  assert.equal(tipoDispositivoPermiteSim("Smartphone", null), true);
});
