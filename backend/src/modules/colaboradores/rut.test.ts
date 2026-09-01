import assert from "node:assert/strict";
import test from "node:test";
import { esRutValido, formatearRut, normalizarRut } from "./rut";

test("normaliza RUT con puntos, espacios o guion al formato canónico", () => {
  assert.equal(normalizarRut("11.184.473-9"), "111844739");
  assert.equal(normalizarRut("11184473-9"), "111844739");
  assert.equal(normalizarRut(" 111844739 "), "111844739");
});

test("formatea RUT canónico para presentación", () => {
  assert.equal(formatearRut("111111111"), "11.111.111-1");
  assert.equal(formatearRut("127926786"), "12.792.678-6");
  assert.equal(formatearRut("111844739"), "11.184.473-9");
});

test("valida el dígito verificador chileno", () => {
  assert.equal(esRutValido("11.184.473-9"), true);
  assert.equal(esRutValido("12.792.678-6"), true);
  assert.equal(esRutValido("11.184.473-8"), false);
});
