import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../../config/database";
import { destinosReemplazo } from "./reemplazos-dispositivo.service";

test("037: crea el modelo de reemplazo sin activar custodias históricas", async () => {
  const table = await pool.query<{ exists: boolean }>(
    "SELECT to_regclass('itam.reemplazos_dispositivo') IS NOT NULL AS exists"
  );
  assert.equal(table.rows[0]?.exists, true);
  const columns = await pool.query<{ column_name: string }>(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='itam' AND table_name='reemplazos_dispositivo'"
  );
  assert.deepEqual(
    new Set(columns.rows.map(row => row.column_name)),
    new Set([
      "id", "colaborador_id", "dispositivo_anterior_id", "dispositivo_nuevo_id",
      "estado_operacion", "fecha_inicio", "fecha_recepcion_anterior", "fecha_cierre",
      "usuario_inicio_id", "usuario_cierre_id", "comprobante_devolucion_id",
      "destino_dispositivo_anterior", "observacion", "motivo_cancelacion",
      "created_at", "updated_at"
    ])
  );
  const indexes = await pool.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname='itam' AND tablename='reemplazos_dispositivo'"
  );
  for (const expected of [
    "uq_reemplazo_pendiente_anterior",
    "uq_reemplazo_pendiente_nuevo",
    "uq_reemplazo_comprobante"
  ]) assert.ok(indexes.rows.some(row => row.indexname === expected));
});

test("037: destinos y restricciones distinguen operación de estado del dispositivo", async () => {
  assert.deepEqual(destinosReemplazo(), ["DISPONIBLE", "RETENIDO_REVISION", "DADO_BAJA"]);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const devices = await client.query<{ id: string }>("SELECT id FROM itam.dispositivos ORDER BY id LIMIT 4");
    const collaborator = await client.query<{ id: string }>("SELECT id FROM itam.colaboradores ORDER BY id LIMIT 1");
    const user = await client.query<{ id: string }>("SELECT id FROM itam.usuarios ORDER BY id LIMIT 1");
    const receipt = await client.query<{ id: string }>("SELECT id FROM itam.comprobantes_devolucion ORDER BY id LIMIT 1");
    assert.equal(devices.rows.length, 4);
    assert.ok(collaborator.rows[0] && user.rows[0] && receipt.rows[0]);

    const insertPending = (oldId: string, newId: string) => client.query(
      `INSERT INTO itam.reemplazos_dispositivo(
         colaborador_id, dispositivo_anterior_id, dispositivo_nuevo_id,
         estado_operacion, usuario_inicio_id
       ) VALUES ($1, $2, $3, 'PENDIENTE_DEVOLUCION', $4)`,
      [collaborator.rows[0]!.id, oldId, newId, user.rows[0]!.id]
    );

    await client.query("SAVEPOINT before_same_device");
    await assert.rejects(
      insertPending(devices.rows[0]!.id, devices.rows[0]!.id),
      (error: unknown) => (error as { code?: string }).code === "23514"
    );
    await client.query("ROLLBACK TO SAVEPOINT before_same_device");

    await client.query("SAVEPOINT before_pending");
    await insertPending(devices.rows[0]!.id, devices.rows[1]!.id);
    await client.query("UPDATE itam.reemplazos_dispositivo SET observacion='actualizacion de prueba' WHERE dispositivo_anterior_id=$1", [devices.rows[0]!.id]);
    await client.query("SAVEPOINT before_duplicate_old");
    await assert.rejects(
      insertPending(devices.rows[0]!.id, devices.rows[2]!.id),
      (error: unknown) => (error as { code?: string }).code === "23505"
    );
    await client.query("ROLLBACK TO SAVEPOINT before_duplicate_old");
    await client.query("SAVEPOINT before_duplicate_new");
    await assert.rejects(
      insertPending(devices.rows[3]!.id, devices.rows[1]!.id),
      (error: unknown) => (error as { code?: string }).code === "23505"
    );
    await client.query("ROLLBACK TO SAVEPOINT before_duplicate_new");

    await client.query("SAVEPOINT before_invalid_pending_consistency");
    await assert.rejects(
      client.query(
        `INSERT INTO itam.reemplazos_dispositivo(
           colaborador_id, dispositivo_anterior_id, dispositivo_nuevo_id,
           estado_operacion, fecha_recepcion_anterior, usuario_inicio_id
         ) VALUES ($1, $2, $3, 'PENDIENTE_DEVOLUCION', NOW(), $4)`,
        [collaborator.rows[0]!.id, devices.rows[2]!.id, devices.rows[3]!.id, user.rows[0]!.id]
      ),
      (error: unknown) => (error as { code?: string }).code === "23514"
    );
    await client.query("ROLLBACK TO SAVEPOINT before_invalid_pending_consistency");

    await client.query("SAVEPOINT before_invalid_completed_consistency");
    await assert.rejects(
      client.query(
        `INSERT INTO itam.reemplazos_dispositivo(
           colaborador_id, dispositivo_anterior_id, dispositivo_nuevo_id,
           estado_operacion, fecha_cierre, usuario_inicio_id, usuario_cierre_id,
           destino_dispositivo_anterior
         ) VALUES ($1, $2, $3, 'COMPLETADO', NOW(), $4, $4, 'DISPONIBLE')`,
        [collaborator.rows[0]!.id, devices.rows[2]!.id, devices.rows[3]!.id, user.rows[0]!.id]
      ),
      (error: unknown) => (error as { code?: string }).code === "23514"
    );
    await client.query("ROLLBACK TO SAVEPOINT before_invalid_completed_consistency");

    await client.query("SAVEPOINT before_invalid_cancelled_consistency");
    await assert.rejects(
      client.query(
        `INSERT INTO itam.reemplazos_dispositivo(
           colaborador_id, dispositivo_anterior_id, dispositivo_nuevo_id,
           estado_operacion, fecha_cierre, usuario_inicio_id, usuario_cierre_id
         ) VALUES ($1, $2, $3, 'CANCELADO', NOW(), $4, $4)`,
        [collaborator.rows[0]!.id, devices.rows[2]!.id, devices.rows[3]!.id, user.rows[0]!.id]
      ),
      (error: unknown) => (error as { code?: string }).code === "23514"
    );
    await client.query("ROLLBACK TO SAVEPOINT before_invalid_cancelled_consistency");

    await client.query(
      `INSERT INTO itam.reemplazos_dispositivo(
         colaborador_id, dispositivo_anterior_id, dispositivo_nuevo_id,
         estado_operacion, fecha_recepcion_anterior, fecha_cierre,
         usuario_inicio_id, usuario_cierre_id, comprobante_devolucion_id,
         destino_dispositivo_anterior
       ) VALUES ($1, $2, $3, 'COMPLETADO', NOW(), NOW(), $4, $4, $5, 'DISPONIBLE')`,
      [collaborator.rows[0]!.id, devices.rows[2]!.id, devices.rows[3]!.id, user.rows[0]!.id, receipt.rows[0]!.id]
    );
    await client.query("SAVEPOINT before_duplicate_receipt");
    await assert.rejects(
      client.query(
        `INSERT INTO itam.reemplazos_dispositivo(
           colaborador_id, dispositivo_anterior_id, dispositivo_nuevo_id,
           estado_operacion, fecha_recepcion_anterior, fecha_cierre,
           usuario_inicio_id, usuario_cierre_id, comprobante_devolucion_id,
           destino_dispositivo_anterior
         ) VALUES ($1, $2, $3, 'COMPLETADO', NOW(), NOW(), $4, $4, $5, 'DISPONIBLE')`,
        [collaborator.rows[0]!.id, devices.rows[1]!.id, devices.rows[0]!.id, user.rows[0]!.id, receipt.rows[0]!.id]
      ),
      (error: unknown) => (error as { code?: string }).code === "23505"
    );
    await client.query("ROLLBACK TO SAVEPOINT before_duplicate_receipt");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
