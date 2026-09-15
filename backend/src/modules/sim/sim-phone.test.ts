import assert from "node:assert/strict";
import test from "node:test";
import { normalizarNumeroTelefonicoChileno } from "./sim-phone";

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
