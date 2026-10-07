import assert from "node:assert/strict";
import test from "node:test";
import { normalizarIccid, normalizarNumeroTelefonicoChileno } from "./sim-phone";

test("normaliza ICCID con separadores y exige 19 o 20 digitos", () => {
  assert.equal(normalizarIccid("8956 0322-6276 3686246"), "8956032262763686246");
  assert.throws(() => normalizarIccid("89560322627636862"));
  assert.throws(() => normalizarIccid("8956032262763686246X"));
});

test("normaliza un teléfono chileno local al formato con prefijo 56", () => {
  assert.equal(normalizarNumeroTelefonicoChileno("961220448"), "56961220448");
});

test("acepta un teléfono chileno con prefijo y separadores visuales", () => {
  assert.equal(normalizarNumeroTelefonicoChileno("+56 9 6122 0448"), "56961220448");
});

test("rechaza teléfonos incompletos o con caracteres no permitidos", () => {
  assert.throws(() => normalizarNumeroTelefonicoChileno("61220448"));
  assert.throws(() => normalizarNumeroTelefonicoChileno("56961ABC448"));
});
