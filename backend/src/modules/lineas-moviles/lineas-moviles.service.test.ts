import assert from "node:assert/strict";
import test from "node:test";
import { esReposicionLineaMovil, resolverPlanExtravioLinea } from "./lineas-moviles.service";

test("conservar número deja la línea pendiente de reposición y bloquea la SIM", () => {
  assert.deepEqual(resolverPlanExtravioLinea("CONSERVAR_BLOQUEAR"), {
    estadoLinea: "PENDIENTE_REPOSICION",
    estadoSim: "BLOQUEADA",
    eventoLinea: "LINEA_CONSERVADA_POR_REPOSICION"
  });
});

test("dar de baja y dejar pendiente producen estados explícitos", () => {
  assert.equal(resolverPlanExtravioLinea("DAR_BAJA").estadoLinea, "DADA_BAJA");
  assert.equal(resolverPlanExtravioLinea("PENDIENTE_CONFIRMAR").estadoLinea, "SUSPENDIDA");
});

test("una línea pendiente sin SIM actual se considera reposición al instalar una nueva SIM", () => {
  assert.equal(
    esReposicionLineaMovil({ estado: "PENDIENTE_REPOSICION", sim_id: null }, "12"),
    true
  );
  assert.equal(
    esReposicionLineaMovil({ estado: "ACTIVA", sim_id: null }, "12"),
    false
  );
});
