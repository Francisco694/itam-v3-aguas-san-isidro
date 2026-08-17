import assert from "node:assert/strict";
import test from "node:test";
import { formatInventoryCode } from "./inventory-code";

test("genera la primera serie Smartphone y cruza de bloque", () => {
  assert.equal(formatInventoryCode("1", 1), 1001);
  assert.equal(formatInventoryCode("1", 2), 1002);
  assert.equal(formatInventoryCode("1", 999), 1999);
  assert.equal(formatInventoryCode("1", 1000), 11001);
  assert.equal(formatInventoryCode("1", 1998), 11999);
  assert.equal(formatInventoryCode("1", 1999), 111001);
});

test("genera la primera serie SIM y cruza de bloque", () => {
  assert.equal(formatInventoryCode("2", 1), 2001);
  assert.equal(formatInventoryCode("2", 999), 2999);
  assert.equal(formatInventoryCode("2", 1000), 22001);
});

test("la estrategia REPEAT_PREFIX es genérica para las familias 1 a 6", () => {
  for (const prefix of ["1", "2", "3", "4", "5", "6"]) {
    assert.equal(formatInventoryCode(prefix, 1), Number(`${prefix}001`));
    assert.equal(formatInventoryCode(prefix, 999), Number(`${prefix}999`));
    assert.equal(formatInventoryCode(prefix, 1000), Number(`${prefix}${prefix}001`));
  }
});

test("rechaza prefijos y ordinales inválidos", () => {
  assert.throws(() => formatInventoryCode("0", 1));
  assert.throws(() => formatInventoryCode("10", 1));
  assert.throws(() => formatInventoryCode("1", 0));
});
