import assert from "node:assert/strict";
import test, { after } from "node:test";
import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { ConflictError } from "../../shared/errors";
import {
  darDeBajaDispositivo,
  obtenerIndicadoresGerenciales
} from "./dispositivos.service";
import type { DarBajaDispositivoInput } from "./dispositivos.types";
import {
  asignarDispositivoAColaborador,
  asignarDispositivoADepartamento
} from "./dispositivos.repository";

interface Candidate {
  id: string;
  codigo_inventario: number;
}

const findCandidate = async (client: PoolClient): Promise<Candidate> => {
  const result = await client.query<Candidate>(`
    SELECT d.id, d.codigo_inventario
      FROM itam.dispositivos d
      JOIN itam.estados e ON e.id = d.estado_id
     WHERE e.codigo <> 'DADO_BAJA'
       AND NOT EXISTS (
         SELECT 1 FROM itam.bajas_dispositivo b
          WHERE b.dispositivo_id = d.id AND b.anulada = FALSE
       )
       AND NOT EXISTS (
         SELECT 1 FROM itam.sim s WHERE s.dispositivo_id = d.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM itam.ordenes_servicio_tecnico o
          WHERE o.dispositivo_id = d.id
            AND o.estado NOT IN ('CERRADA', 'BAJA', 'REPARACION_RECHAZADA')
       )
     ORDER BY d.id
     LIMIT 1
  `);
  assert.ok(result.rows[0], "Se requiere un dispositivo apto para la prueba");
  return result.rows[0];
};

after(async () => {
  await pool.end();
});

test("QA-05: dar de baja libera la custodia de colaborador y preserva el historial", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const device = await findCandidate(client);
    const collaborator = await client.query<{ id: string }>(
      "SELECT id FROM itam.colaboradores WHERE activo = TRUE ORDER BY id LIMIT 1"
    );
    const assigned = await client.query<{ id: string }>(
      "SELECT id FROM itam.estados WHERE tipo_entidad = 'DISPOSITIVO' AND codigo = 'ASIGNADO'"
    );
    assert.ok(collaborator.rows[0]);
    assert.ok(assigned.rows[0]);
    await client.query(
      `UPDATE itam.dispositivos
          SET estado_id = $2, colaborador_id = $3,
              departamento_id = NULL, recibido_por_id = NULL
        WHERE id = $1`,
      [device.id, assigned.rows[0].id, collaborator.rows[0].id]
    );

    const result = await darDeBajaDispositivo(
      device.codigo_inventario,
      { motivo: "OBSOLESCENCIA", responsable: "TEST QA-05" },
      client
    );
    assert.equal(result.estado.codigo, "DADO_BAJA");
    assert.equal(result.colaborador, null);
    assert.equal(result.departamento, null);
    assert.equal(result.recibidoPor, null);

    const persisted = await client.query<{
      colaborador_id: string | null;
      departamento_id: string | null;
      recibido_por_id: string | null;
      bajas: string;
      detalle: {
        custodiaAnterior: { tipo: string; id: string; recibidoPor?: { id: string } };
        custodiaNueva: { tipo: string };
      };
    }>(
      `SELECT d.colaborador_id, d.departamento_id, d.recibido_por_id,
              (SELECT COUNT(*) FROM itam.bajas_dispositivo b
                WHERE b.dispositivo_id = d.id AND b.anulada = FALSE) AS bajas,
              (SELECT h.detalle FROM itam.historial_eventos h
                WHERE h.dispositivo_id = d.id AND h.tipo_evento = 'DAR_BAJA'
                ORDER BY h.id DESC LIMIT 1) AS detalle
         FROM itam.dispositivos d WHERE d.id = $1`,
      [device.id]
    );
    assert.equal(persisted.rows[0]!.colaborador_id, null);
    assert.equal(persisted.rows[0]!.departamento_id, null);
    assert.equal(persisted.rows[0]!.recibido_por_id, null);
    assert.equal(Number(persisted.rows[0]!.bajas), 1);
    assert.equal(persisted.rows[0]!.detalle.custodiaAnterior.tipo, "COLABORADOR");
    assert.equal(persisted.rows[0]!.detalle.custodiaNueva.tipo, "NONE");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("QA-05: dar de baja libera la custodia departamental y su recepcionante", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const device = await findCandidate(client);
    const custody = await client.query<{ departamento_id: string; recibido_por_id: string }>(
      `SELECT d.id AS departamento_id, c.id AS recibido_por_id
         FROM itam.departamentos d
         JOIN itam.colaboradores c ON c.departamento_id = d.id
        WHERE d.activo = TRUE AND c.activo = TRUE
        ORDER BY d.id, c.id LIMIT 1`
    );
    const assigned = await client.query<{ id: string }>(
      "SELECT id FROM itam.estados WHERE tipo_entidad = 'DISPOSITIVO' AND codigo = 'ASIGNADO'"
    );
    assert.ok(custody.rows[0]);
    assert.ok(assigned.rows[0]);
    await client.query(
      `UPDATE itam.dispositivos
          SET estado_id = $2, colaborador_id = NULL,
              departamento_id = $3, recibido_por_id = $4
        WHERE id = $1`,
      [
        device.id,
        assigned.rows[0].id,
        custody.rows[0].departamento_id,
        custody.rows[0].recibido_por_id
      ]
    );

    await darDeBajaDispositivo(
      device.codigo_inventario,
      { motivo: "IRREPARABLE", responsable: "TEST QA-05" },
      client
    );
    const persisted = await client.query<{
      colaborador_id: string | null;
      departamento_id: string | null;
      recibido_por_id: string | null;
      detalle: {
        custodiaAnterior: { tipo: string; id: string; recibidoPor?: { id: string } };
        custodiaNueva: { tipo: string };
      };
    }>(
      `SELECT d.colaborador_id, d.departamento_id, d.recibido_por_id,
              (SELECT h.detalle FROM itam.historial_eventos h
                WHERE h.dispositivo_id = d.id AND h.tipo_evento = 'DAR_BAJA'
                ORDER BY h.id DESC LIMIT 1) AS detalle
         FROM itam.dispositivos d WHERE d.id = $1`,
      [device.id]
    );
    assert.equal(persisted.rows[0]!.colaborador_id, null);
    assert.equal(persisted.rows[0]!.departamento_id, null);
    assert.equal(persisted.rows[0]!.recibido_por_id, null);
    assert.equal(persisted.rows[0]!.detalle.custodiaAnterior.tipo, "DEPARTAMENTO");
    assert.equal(
      persisted.rows[0]!.detalle.custodiaAnterior.recibidoPor?.id,
      custody.rows[0].recibido_por_id
    );
    assert.equal(persisted.rows[0]!.detalle.custodiaNueva.tipo, "NONE");
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});

test("QA-05: un dispositivo ya dado de baja rechaza una segunda baja", async () => {
  const current = await pool.query<{ codigo_inventario: number; bajas: string }>(
    `SELECT d.codigo_inventario,
            (SELECT COUNT(*) FROM itam.bajas_dispositivo b
              WHERE b.dispositivo_id = d.id AND b.anulada = FALSE) AS bajas
       FROM itam.dispositivos d
       JOIN itam.estados e ON e.id = d.estado_id
      WHERE e.codigo = 'DADO_BAJA'
      ORDER BY d.id LIMIT 1`
  );
  assert.ok(current.rows[0]);
  await assert.rejects(
    darDeBajaDispositivo(current.rows[0].codigo_inventario, {
      motivo: "OBSOLESCENCIA",
      responsable: "TEST QA-05"
    }),
    (error: unknown) =>
      error instanceof ConflictError && error.message.includes("ya se encuentra dado de baja")
  );
  const after = await pool.query<{ bajas: string }>(
    `SELECT COUNT(*) AS bajas
       FROM itam.bajas_dispositivo b
       JOIN itam.dispositivos d ON d.id = b.dispositivo_id
      WHERE d.codigo_inventario = $1 AND b.anulada = FALSE`,
    [current.rows[0].codigo_inventario]
  );
  assert.equal(after.rows[0]!.bajas, current.rows[0].bajas);
});

test("QA-05: una falla intermedia revierte estado, custodia y baja patrimonial", async () => {
  const before = await pool.connect();
  let device: Candidate;
  try {
    await before.query("BEGIN");
    device = await findCandidate(before);
  } finally {
    await before.query("ROLLBACK");
    before.release();
  }
  const snapshot = await pool.query<{
    estado_id: string;
    colaborador_id: string | null;
    departamento_id: string | null;
    recibido_por_id: string | null;
    bajas: string;
  }>(
    `SELECT d.estado_id, d.colaborador_id, d.departamento_id, d.recibido_por_id,
            (SELECT COUNT(*) FROM itam.bajas_dispositivo b
              WHERE b.dispositivo_id = d.id AND b.anulada = FALSE) AS bajas
       FROM itam.dispositivos d WHERE d.id = $1`,
    [device!.id]
  );
  await assert.rejects(
    darDeBajaDispositivo(device!.codigo_inventario, {
      motivo: "INVALIDO_QA05" as DarBajaDispositivoInput["motivo"],
      responsable: "TEST QA-05"
    }),
    (error: unknown) => error instanceof ConflictError
  );
  const after = await pool.query(
    `SELECT d.estado_id, d.colaborador_id, d.departamento_id, d.recibido_por_id,
            (SELECT COUNT(*) FROM itam.bajas_dispositivo b
              WHERE b.dispositivo_id = d.id AND b.anulada = FALSE) AS bajas
       FROM itam.dispositivos d WHERE d.id = $1`,
    [device!.id]
  );
  assert.deepEqual(after.rows[0], snapshot.rows[0]);
});

test("QA-10: inventario operacional coincide con los tres estados definidos", async () => {
  const expected = await pool.query<{
    cantidad: string;
    valor: string;
    asignados: string;
    disponibles: string;
    servicio_tecnico: string;
  }>(`
    SELECT
      COUNT(*) FILTER (WHERE e.codigo IN ('ASIGNADO', 'DISPONIBLE', 'SERVICIO_TECNICO')) AS cantidad,
      COALESCE(SUM(d.valor_comercial) FILTER (
        WHERE e.codigo IN ('ASIGNADO', 'DISPONIBLE', 'SERVICIO_TECNICO')
      ), 0) AS valor,
      COUNT(*) FILTER (WHERE e.codigo = 'ASIGNADO') AS asignados,
      COUNT(*) FILTER (WHERE e.codigo = 'DISPONIBLE') AS disponibles,
      COUNT(*) FILTER (WHERE e.codigo = 'SERVICIO_TECNICO') AS servicio_tecnico
    FROM itam.dispositivos d
    JOIN itam.estados e ON e.id = d.estado_id
  `);
  const metrics = await obtenerIndicadoresGerenciales();
  assert.equal(metrics.inventarioOperacional.cantidad, Number(expected.rows[0]!.cantidad));
  assert.equal(metrics.inventarioOperacional.valor, Number(expected.rows[0]!.valor));
  assert.equal(metrics.asignados.cantidad, Number(expected.rows[0]!.asignados));
  assert.equal(metrics.disponibles.cantidad, Number(expected.rows[0]!.disponibles));
  assert.equal(metrics.servicioTecnico.cantidad, Number(expected.rows[0]!.servicio_tecnico));
});

test("P1-06: una segunda asignacion condicional no sobrescribe la primera", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const devices = await client.query<{ codigo_inventario: number }>(`
      SELECT d.codigo_inventario FROM itam.dispositivos d
      WHERE d.colaborador_id IS NULL AND d.departamento_id IS NULL
      ORDER BY d.id LIMIT 2`);
    const collaborators = await client.query<{ id: string }>(
      "SELECT id FROM itam.colaboradores WHERE activo=TRUE ORDER BY id LIMIT 2"
    );
    const custody = await client.query<{ departamento_id: string; recibido_por_id: string }>(`
      SELECT d.id departamento_id,c.id recibido_por_id
      FROM itam.departamentos d JOIN itam.colaboradores c ON c.departamento_id=d.id
      WHERE d.activo=TRUE AND c.activo=TRUE ORDER BY d.id,c.id LIMIT 1`);
    const assigned = await client.query<{ id: string }>(
      "SELECT id FROM itam.estados WHERE tipo_entidad='DISPOSITIVO' AND codigo='ASIGNADO'"
    );
    assert.ok(devices.rows.length >= 2 && collaborators.rows.length >= 2);
    assert.ok(custody.rows[0] && assigned.rows[0]);

    const personalFirst = await asignarDispositivoAColaborador(
      devices.rows[0]!.codigo_inventario,Number(collaborators.rows[0]!.id),assigned.rows[0]!.id,client
    );
    const personalSecond = await asignarDispositivoAColaborador(
      devices.rows[0]!.codigo_inventario,Number(collaborators.rows[1]!.id),assigned.rows[0]!.id,client
    );
    assert.ok(personalFirst);
    assert.equal(personalSecond,null);

    const departmentFirst = await asignarDispositivoADepartamento(
      devices.rows[1]!.codigo_inventario,Number(custody.rows[0]!.departamento_id),
      Number(custody.rows[0]!.recibido_por_id),assigned.rows[0]!.id,undefined,undefined,client
    );
    const departmentSecond = await asignarDispositivoAColaborador(
      devices.rows[1]!.codigo_inventario,Number(collaborators.rows[0]!.id),assigned.rows[0]!.id,client
    );
    assert.ok(departmentFirst);
    assert.equal(departmentSecond,null);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
