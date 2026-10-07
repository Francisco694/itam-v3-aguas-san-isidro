import assert from "node:assert/strict";
import test from "node:test";
import { assertDispositivoSinSimParaBaja } from "./dispositivo-baja-rules";

test("la baja bloquea un dispositivo con SIM asociada", () => {
  assert.throws(
    () => assertDispositivoSinSimParaBaja({ sim_id: "2093" }),
    /SIM asociada/
  );
});

test("la baja permite un dispositivo sin SIM", () => {
  assert.doesNotThrow(() => assertDispositivoSinSimParaBaja({ sim_id: null }));
});
