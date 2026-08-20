import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "../../config/database";
import { generateInventoryCode } from "./inventory-code.service";
import { formatInventoryCode } from "./inventory-code";

after(async () => { await pool.end(); });

test("la familia se bloquea ante una reserva concurrente", async () => {
  const first = await pool.connect();
  const second = await pool.connect();
  try {
    await first.query("BEGIN");
    await second.query("BEGIN");
    await first.query(`SELECT id FROM itam.familias_codigo_inventario WHERE tipo_entidad='SIM' FOR UPDATE`);
    await second.query("SET LOCAL lock_timeout = '100ms'");
    await assert.rejects(
      second.query(`SELECT id FROM itam.familias_codigo_inventario WHERE tipo_entidad='SIM' FOR UPDATE`),
      (error: unknown) => (error as { code?: string }).code === "55P03"
    );
  } finally {
    await first.query("ROLLBACK");
    await second.query("ROLLBACK");
    first.release();
    second.release();
  }
});

test("el generador salta un código legacy existente", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const state = await client.query<{ id: string }>(`SELECT id FROM itam.estados WHERE tipo_entidad='DISPOSITIVO' AND codigo='DISPONIBLE' LIMIT 1`);
    const tipo = await client.query<{ id: string; prefijo: string; ultimo_ordinal: number }>(`
      SELECT tipo.id,familia.prefijo,familia.ultimo_ordinal
      FROM itam.tipos_dispositivo tipo
      JOIN itam.familias_codigo_inventario familia
        ON familia.id=tipo.familia_codigo_inventario_id
      WHERE LOWER(tipo.nombre)='smartphone' LIMIT 1
    `);
    const occupiedCode = formatInventoryCode(tipo.rows[0]!.prefijo, tipo.rows[0]!.ultimo_ordinal + 1);
    const expectedCode = formatInventoryCode(tipo.rows[0]!.prefijo, tipo.rows[0]!.ultimo_ordinal + 2);
    await client.query(`INSERT INTO itam.dispositivos(codigo_inventario,tipo_dispositivo_id,estado_id) VALUES($1,$2,$3)`, [occupiedCode, tipo.rows[0]!.id, state.rows[0]!.id]);
    const code = await generateInventoryCode("DISPOSITIVO", "SMARTPHONE", client);
    assert.equal(code, expectedCode);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("PostgreSQL impide cambiar el código de un activo", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{ codigo_inventario: number }>("SELECT codigo_inventario FROM itam.dispositivos LIMIT 1");
    if (!current.rows[0]) return;
    await assert.rejects(
      client.query("UPDATE itam.dispositivos SET codigo_inventario=$2 WHERE codigo_inventario=$1", [current.rows[0].codigo_inventario, 2_147_483_646]),
      (error: unknown) => (error as { code?: string }).code === "P0001"
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("la custodia admite persona o departamento, nunca ambos", async () => {
  const client = await pool.connect();
  try {
    const device = await client.query<{ id: string }>("SELECT id FROM itam.dispositivos LIMIT 1");
    const person = await client.query<{ id: string }>("SELECT id FROM itam.colaboradores LIMIT 1");
    const department = await client.query<{ id: string }>("SELECT id FROM itam.departamentos LIMIT 1");
    if (!device.rows[0] || !person.rows[0] || !department.rows[0]) return;

    await client.query("BEGIN");
    await client.query("UPDATE itam.dispositivos SET colaborador_id=$2,departamento_id=NULL,recibido_por_id=NULL WHERE id=$1", [device.rows[0].id, person.rows[0].id]);
    await client.query("ROLLBACK");

    await client.query("BEGIN");
    await client.query("UPDATE itam.dispositivos SET colaborador_id=NULL,departamento_id=$2,recibido_por_id=NULL WHERE id=$1", [device.rows[0].id, department.rows[0].id]);
    await client.query("ROLLBACK");

    await client.query("BEGIN");
    await assert.rejects(
      client.query("UPDATE itam.dispositivos SET colaborador_id=$2,departamento_id=$3 WHERE id=$1", [device.rows[0].id, person.rows[0].id, department.rows[0].id]),
      (error: unknown) => (error as { code?: string }).code === "23514"
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
