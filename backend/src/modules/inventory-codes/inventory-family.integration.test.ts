import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "../../config/database";
import {
  createInventoryCodeFamily,
  getInventoryCodeFamilyById,
  updateInventoryCodeFamily
} from "./inventory-code.repository";

after(async () => { await pool.end(); });

test("una familia se puede crear, consultar, editar y desactivar sin borrarla", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const family = await createInventoryCodeFamily({
      nombreFamilia: "TEST Audio", prefijo: "7",
      estrategiaCodigo: "REPEAT_PREFIX", activo: true,
      tipoActivoNormalizado: "TEST_AUDIO"
    }, client);
    assert.equal(family.prefijo, "7");
    assert.equal(family.tiene_codigos_emitidos, false);
    const updated = await updateInventoryCodeFamily(Number(family.id), {
      nombreFamilia: "TEST Audio Corporativo",
      tipoActivoNormalizado: "TEST_AUDIO_CORPORATIVO", activo: false
    }, client);
    assert.equal(updated?.nombre_familia, "TEST Audio Corporativo");
    assert.equal(updated?.activo, false);
    assert.ok(await getInventoryCodeFamilyById(Number(family.id), client));
  } finally {
    await client.query("ROLLBACK"); client.release();
  }
});

test("PostgreSQL rechaza nombres y prefijos duplicados", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await assert.rejects(
      createInventoryCodeFamily({ nombreFamilia: "Notebook", prefijo: "7", estrategiaCodigo: "REPEAT_PREFIX", tipoActivoNormalizado: "TEST_NOTEBOOK" }, client),
      (error: unknown) => (error as { code?: string }).code === "23505"
    );
    await client.query("ROLLBACK"); await client.query("BEGIN");
    await assert.rejects(
      createInventoryCodeFamily({ nombreFamilia: "TEST Prefijo", prefijo: "3", estrategiaCodigo: "REPEAT_PREFIX", tipoActivoNormalizado: "TEST_PREFIX" }, client),
      (error: unknown) => (error as { code?: string }).code === "23505"
    );
  } finally {
    await client.query("ROLLBACK"); client.release();
  }
});

test("el prefijo queda protegido cuando una familia posee códigos emitidos", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const usedFamily = await client.query<{ id: string }>(
      "SELECT id FROM itam.familias_codigo_inventario WHERE tipo_entidad='SIM' LIMIT 1"
    );
    if (!usedFamily.rows[0]) return;
    await assert.rejects(
      client.query("UPDATE itam.familias_codigo_inventario SET prefijo='7' WHERE id=$1", [usedFamily.rows[0].id]),
      (error: unknown) => (error as { code?: string }).code === "P0001"
    );
  } finally {
    await client.query("ROLLBACK"); client.release();
  }
});
