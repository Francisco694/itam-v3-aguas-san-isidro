import assert from "node:assert/strict";
import test from "node:test";
import { calcularResumenInventarioDepartamento } from "./departamentos.service";
import type { DispositivoResumen } from "../dispositivos/dispositivos.types";

const device = (
  id: string,
  estado: string,
  valorComercial: number
): DispositivoResumen => ({
  id,
  estado: { id: estado, codigo: estado, nombre: estado },
  valorComercial
} as unknown as DispositivoResumen);

test("detalle departamental suma solo activos y separa custodias sin duplicar", () => {
  const result = calcularResumenInventarioDepartamento(
    [
      device("directo-1", "ASIGNADO", 100_000),
      device("directo-1", "ASIGNADO", 100_000),
      device("retirado", "DADO_BAJA", 900_000),
      device("extraviado", "EXTRAVIADO", 800_000)
    ],
    [
      device("personal-1", "ASIGNADO", 50_000),
      device("directo-1", "ASIGNADO", 100_000),
      device("personal-perdido", "EXTRAVIADO", 700_000)
    ]
  );

  assert.equal(result.resumen.custodiaDirecta, 1);
  assert.equal(result.resumen.conColaboradores, 1);
  assert.equal(result.resumen.totalRelacionado, 2);
  assert.deepEqual(result.resumen.valorEconomico, {
    directoDepartamento: 100_000,
    equiposPersonal: 50_000,
    totalRelacionado: 150_000
  });
  assert.deepEqual(result.custodiaDirecta.map((item) => item.id), ["directo-1"]);
  assert.deepEqual(result.activosColaboradores.map((item) => item.id), ["personal-1"]);
});
