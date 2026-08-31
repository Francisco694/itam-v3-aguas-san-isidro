import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "../../config/database";
import { ConflictError } from "../../shared/errors";
import {
  listOpenProcesses,
  listPendingAssets,
  searchCollaborators
} from "./offboarding.repository";
import {
  closeOffboardingProcess,
  startOffboardingProcess
} from "./offboarding.service";

after(async () => {
  await pool.end();
});

test("la migracion 022 crea el proceso explicito y su unicidad parcial", async () => {
  const migration = await pool.query<{ version: string }>(
    "SELECT version FROM itam.schema_migrations WHERE version = '022'"
  );
  const index = await pool.query<{ exists: boolean }>(
    `SELECT to_regclass('itam.uq_offboarding_abierto_colaborador') IS NOT NULL AS exists`
  );
  assert.equal(migration.rows[0]?.version, "022");
  assert.equal(index.rows[0]?.exists, true);
});

test("tener equipos asignados sin proceso no incorpora a la persona", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const candidate = await client.query<{ id: string }>(
      `SELECT c.id
         FROM itam.colaboradores c
        WHERE EXISTS (
          SELECT 1 FROM itam.dispositivos d WHERE d.colaborador_id = c.id
        )
          AND NOT EXISTS (
            SELECT 1 FROM itam.procesos_offboarding p
             WHERE p.colaborador_id = c.id AND p.estado = 'ABIERTO'
          )
        LIMIT 1`
    );
    assert.ok(candidate.rows[0]);
    const open = await listOpenProcesses(client);
    assert.equal(
      open.some((process) => process.colaborador_id === candidate.rows[0]!.id),
      false
    );
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("inicio, equipos dinamicos, bloqueo de cierre y cierre completo", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: string }>(
      "SELECT id FROM itam.usuarios WHERE activo = TRUE ORDER BY id LIMIT 1"
    );
    const candidate = await client.query<{ id: string }>(
      `SELECT c.id
         FROM itam.colaboradores c
        WHERE EXISTS (
          SELECT 1 FROM itam.dispositivos d WHERE d.colaborador_id = c.id
        )
          AND NOT EXISTS (
            SELECT 1 FROM itam.procesos_offboarding p
             WHERE p.colaborador_id = c.id AND p.estado = 'ABIERTO'
          )
        ORDER BY c.id
        LIMIT 1`
    );
    assert.ok(user.rows[0]);
    assert.ok(candidate.rows[0]);

    const before = await client.query<{ id: string; estado_id: string }>(
      "SELECT id, estado_id FROM itam.dispositivos WHERE colaborador_id = $1 ORDER BY id",
      [candidate.rows[0]!.id]
    );
    const started = await startOffboardingProcess(
      {
        colaboradorId: Number(candidate.rows[0]!.id),
        usuarioId: user.rows[0]!.id,
        observaciones: "TEST MOD-01"
      },
      client
    );
    assert.equal(started.estado, "ABIERTO");
    assert.equal(started.equiposPendientes, before.rowCount);

    await assert.rejects(
      startOffboardingProcess(
        {
          colaboradorId: Number(candidate.rows[0]!.id),
          usuarioId: user.rows[0]!.id
        },
        client
      ),
      (error: unknown) => error instanceof ConflictError
    );
    await assert.rejects(
      closeOffboardingProcess(
        { procesoId: Number(started.id), usuarioId: user.rows[0]!.id },
        client
      ),
      (error: unknown) =>
        error instanceof ConflictError && error.message.includes("equipos")
    );

    const additional = await client.query<{ id: string }>(
      `SELECT d.id
         FROM itam.dispositivos d
        WHERE d.colaborador_id IS NOT NULL
          AND d.colaborador_id <> $1
        LIMIT 1`,
      [candidate.rows[0]!.id]
    );
    assert.ok(additional.rows[0]);
    await client.query(
      "UPDATE itam.dispositivos SET colaborador_id = $1 WHERE id = $2",
      [candidate.rows[0]!.id, additional.rows[0]!.id]
    );
    const withAdditional = await listPendingAssets(Number(started.id), client);
    assert.equal(withAdditional.length, before.rowCount! + 1);
    const pending = await client.query<{ count: string }>(
      "SELECT COUNT(*) count FROM itam.dispositivos WHERE colaborador_id = $1",
      [candidate.rows[0]!.id]
    );

    const devices = await client.query<{ id: string; estado_id: string }>(
      "SELECT id, estado_id FROM itam.dispositivos WHERE colaborador_id = $1",
      [candidate.rows[0]!.id]
    );
    for (const device of devices.rows) {
      await client.query(
        `INSERT INTO itam.historial_eventos(
           tipo_entidad, dispositivo_id, tipo_evento,
           estado_anterior_id, estado_nuevo_id, responsable, detalle
         ) VALUES (
           'DISPOSITIVO', $1, 'RESULTADO_OFFBOARDING',
           $2, $2, 'TEST MOD-01',
           jsonb_build_object(
             'resultado', 'EXTRAVIADO',
             'custodiaAnterior', jsonb_build_object('id', $3::TEXT)
           )
         )`,
        [device.id, device.estado_id, candidate.rows[0]!.id]
      );
    }
    const completed = await closeOffboardingProcess(
      { procesoId: Number(started.id), usuarioId: user.rows[0]!.id },
      client
    );
    assert.equal(Number(pending.rows[0]!.count), before.rowCount! + 1);
    assert.equal(completed.equiposPendientes, 0);
    assert.equal(completed.estado, "COMPLETADO");
    assert.equal(
      (await listOpenProcesses(client)).some((item) => item.id === started.id),
      false
    );

    const after = await client.query<{ id: string; estado_id: string }>(
      "SELECT id, estado_id FROM itam.dispositivos WHERE id = ANY($1::BIGINT[]) ORDER BY id",
      [before.rows.map((row) => row.id)]
    );
    assert.deepEqual(after.rows, before.rows);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("una persona sin equipos puede iniciar y completar el proceso", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const user = await client.query<{ id: string }>(
      "SELECT id FROM itam.usuarios WHERE activo = TRUE ORDER BY id LIMIT 1"
    );
    const candidate = await client.query<{ id: string }>(
      `SELECT c.id
         FROM itam.colaboradores c
        WHERE NOT EXISTS (
          SELECT 1 FROM itam.dispositivos d WHERE d.colaborador_id = c.id
        )
          AND NOT EXISTS (
            SELECT 1 FROM itam.procesos_offboarding p
             WHERE p.colaborador_id = c.id AND p.estado = 'ABIERTO'
          )
        LIMIT 1`
    );
    assert.ok(user.rows[0]);
    assert.ok(candidate.rows[0]);
    const started = await startOffboardingProcess(
      {
        colaboradorId: Number(candidate.rows[0]!.id),
        usuarioId: user.rows[0]!.id
      },
      client
    );
    assert.equal(started.equiposPendientes, 0);
    const completed = await closeOffboardingProcess(
      { procesoId: Number(started.id), usuarioId: user.rows[0]!.id },
      client
    );
    assert.equal(completed.estado, "COMPLETADO");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("la busqueda encuentra por nombre y RUT sin crear procesos", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const alexisByName = await searchCollaborators("Alexis Higuera", client);
    const alexisByRut = alexisByName[0]
      ? await searchCollaborators(alexisByName[0].rut, client)
      : [];
    assert.ok(alexisByName.length > 0);
    assert.ok(alexisByRut.some((item) => item.colaborador_id === alexisByName[0]!.colaborador_id));
    assert.equal(alexisByName[0]!.proceso_abierto_id, null);

    const bastian = await searchCollaborators("Bastian Carcamo", client);
    assert.ok(bastian.length > 0);
    assert.equal(bastian[0]!.proceso_abierto_id, null);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
