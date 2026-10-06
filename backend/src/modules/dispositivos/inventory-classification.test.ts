import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyInventoryRecord,
  isHistoricalClassification,
  isInventoryClassification
} from "./inventory-classification";

test("clasificación: legacy pendiente o por revisar solo pertenece a Histórico", () => {
  for (const resultado of [null, "PENDIENTE", "REVISAR"]) {
    assert.equal(classifyInventoryRecord("IMPORTADO", resultado), "HISTORICO");
    assert.equal(isHistoricalClassification("IMPORTADO", resultado), true);
    assert.equal(isInventoryClassification("IMPORTADO", resultado), false);
  }
});

test("clasificación: legacy verificado solo pertenece a Inventario", () => {
  assert.equal(classifyInventoryRecord("IMPORTADO", "VERIFICADO"), "INVENTARIO");
  assert.equal(isInventoryClassification("IMPORTADO", "VERIFICADO"), true);
  assert.equal(isHistoricalClassification("IMPORTADO", "VERIFICADO"), false);
});

test("clasificación: manual pertenece a Inventario sin depender de la verificación", () => {
  for (const resultado of [null, "PENDIENTE", "REVISAR", "VERIFICADO"]) {
    assert.equal(classifyInventoryRecord("MANUAL", resultado), "INVENTARIO");
    assert.equal(isInventoryClassification("MANUAL", resultado), true);
    assert.equal(isHistoricalClassification("MANUAL", resultado), false);
  }
});
