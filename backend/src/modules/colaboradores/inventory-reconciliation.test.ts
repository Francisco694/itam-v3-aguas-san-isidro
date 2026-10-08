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
  fecha_salida: null,
  evento_asignacion_id: id,
  vinculo_actual: true,
  colaborador_actual_id: "fixture-colaborador",
  tipo_cierre: null,
  tiene_devolucion: false,
  tiene_baja: false,
  identidad_duplicada: false,
  ...overrides
});

test("mantiene todos los smartphones con custodia actual aunque tengan distintas fechas", () => {
  const rows = [
    smartphone("1", 1284, "351889692081293", "2021-09-28T15:00:00Z"),
    smartphone("2", 1285, "352054265288036", "2024-02-01T15:00:00Z"),
    smartphone("3", 1286, "356559084765119", "2017-11-29T15:00:00Z")
  ];
  const snapshot = structuredClone(rows);

  const result = clasificarInventarioConciliado(rows);

  assert.deepEqual(rows, snapshot, "la clasificación no debe modificar los registros fuente");
  assert.deepEqual(result.actuales.map(item => item.codigoItam).sort(), [1284, 1285, 1286]);
  assert.ok(result.actuales.every(item => item.clasificacionConciliada === "ACTUAL_CONFIRMADO"));
  assert.equal(result.historicos.length, 0);
  assert.equal(result.valorTotalActual, 300_000);
  assert.equal(result.pendientes.length, 0);
});

test("calcula custodia actual por dispositivo, permite múltiples smartphones y separa el equipo devuelto", () => {
  const otherAsset = (
    id: string,
    codigo: number,
    tipo: string,
    valor: number
  ): InventarioConciliableRow => ({
    ...smartphone(id, codigo, null, "2024-02-01T15:00:00Z"),
    tipo_dispositivo: tipo,
    numero_serie: `SERIE-${codigo}`,
    valor_comercial: valor,
  });
  const rows = [
    smartphone("1464", 1464, "351889692081293", "2021-09-28T15:00:00Z"),
    smartphone("1227", 1227, "352054265288036", "2024-02-01T15:00:00Z"),
    otherAsset("6026", 6026, "Mouse", 20_000),
    otherAsset("5012", 5012, "PC", 300_000),
    otherAsset("4034", 4034, "Monitor", 150_000),
    otherAsset("3042", 3042, "Notebook", 400_000),
    smartphone("1200", 1200, "356559084765119", "2020-01-01T15:00:00Z", {
      vinculo_actual: false,
      colaborador_actual_id: null,
      tiene_devolucion: true,
      tipo_cierre: "DEVOLVER_DISPOSITIVO",
    }),
  ];

  const result = clasificarInventarioConciliado(rows);

  assert.deepEqual(result.actuales.map(item => item.codigoItam).sort(), [
    1227, 1464, 3042, 4034, 5012, 6026
  ]);
  assert.equal(result.actuales.length, 6);
  assert.equal(result.valorTotalActual, 1_070_000);
  assert.deepEqual(result.historicos.map(item => item.codigoItam), [1200]);
  assert.ok(result.actuales.some(item => item.codigoItam === 1227));
  assert.ok(result.actuales.some(item => item.codigoItam === 1464));
});

test("incluye en equipos actuales un dispositivo bajo custodia aunque requiera revisión", () => {
  const result = clasificarInventarioConciliado([
    smartphone("40", 1227, null, "2024-01-01T12:00:00Z")
  ]);

  assert.equal(result.actuales.length, 1);
  assert.equal(result.actuales[0]?.codigoItam, 1227);
  assert.equal(result.pendientes[0]?.codigoItam, 1227);
  assert.equal(result.valorTotalActual, 100_000);
});

test("un IMEI cero queda pendiente pero conserva la custodia actual", () => {
  const result = clasificarInventarioConciliado([
    smartphone("10", 1999, "0", "2024-01-01T12:00:00Z")
  ]);

  assert.equal(result.actuales.length, 1);
  assert.equal(result.actuales[0]?.codigoItam, 1999);
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

test("dos smartphones actuales con la misma fecha siguen siendo dos custodias actuales", () => {
  const result = clasificarInventarioConciliado([
    smartphone("30", 1001, "352460887995108", "2026-08-25T16:45:49.853Z"),
    smartphone("31", 1012, "354775290613776", "2026-08-25T16:45:49.853Z"),
    smartphone("32", 1417, "351889692083968", "2021-08-16T16:00:00Z")
  ]);

  assert.deepEqual(result.actuales.map(item => item.codigoItam).sort(), [1001, 1012, 1417]);
  assert.equal(result.historicos.length, 0);
  assert.equal(result.pendientes.length, 0);
});

test("al cambiar la custodia de colaborador A a B, solo B lo recibe como actual", () => {
  const assignedToB = smartphone("50", 1227, "352460887995108", "2026-08-25T16:45:49.853Z", {
    colaborador_actual_id: "B",
  });
  const resultA = clasificarInventarioConciliado([
    { ...assignedToB, vinculo_actual: false, colaborador_actual_id: "B" },
  ]);
  const resultB = clasificarInventarioConciliado([assignedToB]);

  assert.equal(resultA.actuales.length, 0);
  assert.equal(resultB.actuales.length, 1);
  assert.equal(resultB.actuales[0]?.codigoItam, 1227);
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
  assert.match(sql, /SELECT id FROM itam\.dispositivos WHERE colaborador_id = \$1::bigint/);
  assert.match(sql, /DISTINCT ON \(c\.dispositivo_id\)/);
  assert.doesNotMatch(sql, /PARTITION BY .*tipo_dispositivo|GROUP BY .*tipo_dispositivo/i);
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
