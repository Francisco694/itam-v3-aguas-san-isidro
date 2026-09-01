import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import test, { after } from "node:test";
import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { AppError } from "../../shared/errors";
import { formatRut, isValidRut, normalizeRut } from "../../shared/rut";
import { crearColaborador } from "./colaboradores.repository";
import {
  actualizarColaboradorExistente,
  collaboratorRutConflictFromError,
  crearNuevoColaborador
} from "./colaboradores.service";

after(async () => {
  await pool.end();
});

const inRollback = async (
  callback: (client: PoolClient) => Promise<void>
): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await callback(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
};

const syntheticRut = (): string => {
  const body = String(900_000_000_000 + randomInt(0,100_000_000));
  for (const digit of "0123456789K") {
    const candidate = `${body}${digit}`;
    if (isValidRut(candidate)) return formatRut(candidate);
  }
  throw new Error("No fue posible generar un RUT sintetico valido.");
};

const input = (rut: string, activo = true) => ({
  rut,
  nombre: "TEST P1-10 rollback",
  cargo: null,
  departamentoId: null,
  localidad: null,
  activo,
  observaciones: "Dato temporal P1-10"
});

const assertRutConflict = (error: unknown): boolean =>
  error instanceof AppError &&
  error.statusCode === 409 &&
  error.code === "RUT_ALREADY_EXISTS" &&
  error.message === "Ya existe un colaborador registrado con este RUT.";

test("P1-10: normaliza formatos equivalentes y conserva K mayuscula", () => {
  assert.equal(normalizeRut(" 12.792.678-6 "),"127926786");
  assert.equal(normalizeRut("12.345.678-k"),"12345678K");
});

test("A/B/C/F: crea RUT nuevo y rechaza duplicados activos, inactivos y con otro formato", async () => {
  await inRollback(async (client) => {
    const rut = syntheticRut();
    const created = await crearNuevoColaborador(input(rut,false),client);
    assert.equal(created.rut,normalizeRut(rut));
    assert.equal(created.activo,false);

    await assert.rejects(
      crearNuevoColaborador(input(rut),client),
      assertRutConflict
    );
    await assert.rejects(
      crearNuevoColaborador(input(normalizeRut(rut)),client),
      assertRutConflict
    );
  });
});

test("D: editar conserva el propio RUT logico y permite actualizar otros campos", async () => {
  await inRollback(async (client) => {
    const rut = syntheticRut();
    const created = await crearNuevoColaborador(input(rut),client);
    const updated = await actualizarColaboradorExistente(
      Number(created.id),
      { rut:normalizeRut(rut),nombre:"TEST P1-10 editado" },
      client
    );
    assert.equal(updated.rut,normalizeRut(rut));
    assert.equal(updated.nombre,"TEST P1-10 editado");
  });
});

test("E: editar con el RUT normalizado de otro colaborador devuelve 409", async () => {
  await inRollback(async (client) => {
    const first = await crearNuevoColaborador(input(syntheticRut()),client);
    const second = await crearNuevoColaborador(input(syntheticRut()),client);
    await assert.rejects(
      actualizarColaboradorExistente(
        Number(second.id),
        { rut:normalizeRut(first.rut) },
        client
      ),
      assertRutConflict
    );
  });
});

test("G: dos altas concurrentes del mismo RUT permiten persistir solo una", async () => {
  const rut = syntheticRut();
  try {
    const results = await Promise.allSettled([
      crearNuevoColaborador(input(rut)),
      crearNuevoColaborador(input(normalizeRut(rut)))
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length,1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected && rejected.status === "rejected");
    assert.equal(assertRutConflict(rejected.reason),true);

    const persisted = await pool.query<{ total: string }>(
      `SELECT COUNT(*) AS total FROM itam.colaboradores
       WHERE UPPER(REGEXP_REPLACE(BTRIM(rut),'[^0-9Kk]','','g'))=$1`,
      [normalizeRut(rut)]
    );
    assert.equal(Number(persisted.rows[0]!.total),1);
  } finally {
    await pool.query(
      `DELETE FROM itam.colaboradores
       WHERE UPPER(REGEXP_REPLACE(BTRIM(rut),'[^0-9Kk]','','g'))=$1
         AND nombre='TEST P1-10 rollback'`,
      [normalizeRut(rut)]
    );
  }
});

test("H: unique_violation real de PostgreSQL se traduce a RUT_ALREADY_EXISTS 409", async () => {
  await inRollback(async (client) => {
    const rut = syntheticRut();
    await crearColaborador(input(normalizeRut(rut)),client);
    let databaseError: unknown;
    try {
      await crearColaborador(input(normalizeRut(rut)),client);
    } catch (error) {
      databaseError = error;
    }
    assert.equal((databaseError as { code?: string })?.code,"23505");
    const translated = collaboratorRutConflictFromError(databaseError);
    assert.ok(translated);
    assert.equal(translated.statusCode,409);
    assert.equal(translated.code,"RUT_ALREADY_EXISTS");
  });
});
