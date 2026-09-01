import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { listarInventarioConciliableColaborador } from "./colaboradores.repository";
import { clasificarInventarioConciliado } from "./colaboradores.service";
import type { InventarioConciliableRow } from "./colaboradores.types";

const smartphone = (
  id: string,
  codigo: number,
  imei: string | null,
  fecha: string,
  overrides: Partial<InventarioConciliableRow> = {}
): InventarioConciliableRow => ({
  dispositivo_id: id,
  codigo_inventario: codigo,
  tipo_dispositivo: "Smartphone",
  marca: "Marca fixture",
  modelo: "Modelo fixture",
  numero_serie: null,
  imei,
  valor_comercial: 100_000,
  estado_codigo: "ASIGNADO",
  estado_nombre: "Asignado",
  fecha_asignacion: fecha,
  evento_asignacion_id: id,
  vinculo_actual: true,
  colaborador_actual_id: "fixture-colaborador",
  tipo_cierre: null,
  tiene_devolucion: false,
  tiene_baja: false,
  identidad_duplicada: false,
  ...overrides
});

test("separa tres smartphones y conserva solo el más reciente como actual probable", () => {
  const rows = [
    smartphone("1", 1284, "351889692081293", "2021-09-28T15:00:00Z"),
    smartphone("2", 1285, "352054265288036", "2024-02-01T15:00:00Z"),
    smartphone("3", 1286, "356559084765119", "2017-11-29T15:00:00Z")
  ];
  const snapshot = structuredClone(rows);

  const result = clasificarInventarioConciliado(rows);

  assert.deepEqual(rows, snapshot, "la clasificación no debe modificar los registros fuente");
  assert.deepEqual(result.actuales.map(item => item.codigoItam), [1285]);
  assert.equal(result.actuales[0]?.clasificacionConciliada, "ACTUAL_PROBABLE");
  assert.deepEqual(
    result.historicos.map(item => item.codigoItam).sort(),
    [1284, 1286]
  );
  assert.ok(
    result.historicos.every(item =>
      item.motivoConciliacion.includes("no se registra devolución física")
    )
  );
  assert.equal(result.pendientes.length, 0);
});

test("un IMEI cero queda pendiente y no genera un activo confirmado", () => {
  const result = clasificarInventarioConciliado([
    smartphone("10", 1999, "0", "2024-01-01T12:00:00Z")
  ]);

  assert.equal(result.actuales.length, 0);
  assert.equal(result.historicos.length, 0);
  assert.equal(result.pendientes[0]?.clasificacionConciliada, "PENDIENTE_VALIDACION");
  assert.equal(result.pendientes[0]?.imei, "0");
});

test("una devolución o baja real se clasifica como histórico confirmado", () => {
  const result = clasificarInventarioConciliado([
    smartphone("20", 1200, "351889692081293", "2022-01-01T12:00:00Z", {
      vinculo_actual: false,
      colaborador_actual_id: null,
      tiene_devolucion: true,
      tipo_cierre: "DEVOLVER_DISPOSITIVO"
    }),
    smartphone("21", 1201, "356559084765119", "2021-01-01T12:00:00Z", {
      vinculo_actual: false,
      colaborador_actual_id: null,
      tiene_baja: true,
      tipo_cierre: "DAR_BAJA"
    })
  ]);

  assert.equal(result.historicos.length, 2);
  assert.ok(result.historicos.every(item => item.clasificacionConciliada === "HISTORICO_CONFIRMADO"));
});

test("dos smartphones con la misma fecha más reciente quedan en conflicto", () => {
  const result = clasificarInventarioConciliado([
    smartphone("30", 1001, "352460887995108", "2026-08-25T16:45:49.853Z"),
    smartphone("31", 1012, "354775290613776", "2026-08-25T16:45:49.853Z"),
    smartphone("32", 1417, "351889692083968", "2021-08-16T16:00:00Z")
  ]);

  assert.equal(result.actuales.length, 0);
  assert.equal(result.historicos[0]?.clasificacionConciliada, "HISTORICO_PROBABLE");
  assert.equal(result.pendientes.length, 2);
  assert.ok(result.pendientes.every(item => item.clasificacionConciliada === "CONFLICTO_DATOS"));
});

test("la consulta se limita al ID del colaborador y nunca concilia por nombre", async () => {
  let sql = "";
  let values: readonly unknown[] | undefined;
  const client = {
    query: async (text: string, parameters?: readonly unknown[]) => {
      sql = text;
      values = parameters;
      return { rows: [] };
    }
  } as unknown as PoolClient;

  const result = await listarInventarioConciliableColaborador(42, client);

  assert.deepEqual(result, []);
  assert.deepEqual(values, [42]);
  assert.match(sql, /\$1::text/);
  assert.doesNotMatch(sql, /c\.nombre|ILIKE/);
});

test("la respuesta conciliada expone actuales, históricos y pendientes", () => {
  const result = clasificarInventarioConciliado([]);
  assert.deepEqual(Object.keys(result).sort(), [
    "actuales",
    "historicos",
    "pendientes",
    "valorTotalActual"
  ]);
});
