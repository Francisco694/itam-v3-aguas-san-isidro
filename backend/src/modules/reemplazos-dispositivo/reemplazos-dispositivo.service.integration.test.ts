import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../../config/database";
import { runWithAuthUser, type AuthUser } from "../../shared/auth-context";
import { devolverDispositivoExistente } from "../dispositivos/dispositivos.service";
import {
  crearReemplazoDispositivo,
  recibirReemplazoPendiente
} from "./reemplazos-dispositivo.service";

type Fixture = {
  actorId: string;
  collaboratorId: string;
  oldCode: number;
  newCode: number;
  oldId: string;
  newId: string;
};

let fixtureCounter = 0;
let activeClient: PoolClient | null = null;

const dbQuery = async <T extends QueryResultRow>(text: string, values: unknown[] = []) =>
  activeClient ? activeClient.query<T>(text, values) : pool.query<T>(text, values);

const withIsolatedDatabase = async <T>(operation: () => Promise<T>): Promise<T> => {
  const root = await pool.connect();
  await root.query("BEGIN");
  const database = pool as unknown as {
    connect: (...args: unknown[]) => Promise<PoolClient>;
    query: (text: string, values?: unknown[]) => Promise<unknown>;
  };
  const originalConnect = database.connect;
  const originalQuery = database.query;
  let savepointCounter = 0;
  let currentSavepoint = "";
  const serviceClient = new Proxy(root, {
    get(target, property, receiver) {
      if (property === "query") {
        return async (text: string, values: unknown[] = []) => {
          const normalized = text.trim().toUpperCase();
          if (normalized === "BEGIN") {
            currentSavepoint = `reemplazo_test_${++savepointCounter}`;
            return target.query(`SAVEPOINT ${currentSavepoint}`);
          }
          if (normalized === "COMMIT") {
            const result = await target.query(`RELEASE SAVEPOINT ${currentSavepoint}`);
            currentSavepoint = "";
            return result;
          }
          if (normalized === "ROLLBACK") {
            const result = await target.query(`ROLLBACK TO SAVEPOINT ${currentSavepoint}`);
            await target.query(`RELEASE SAVEPOINT ${currentSavepoint}`);
            currentSavepoint = "";
            return result;
          }
          return target.query(text, values);
        };
      }
      if (property === "release") return async () => undefined;
      return Reflect.get(target, property, receiver);
    }
  }) as PoolClient;
  database.connect = async () => serviceClient;
  database.query = (text, values = []) => root.query(text, values);
  activeClient = root;
  try {
    return await operation();
  } finally {
    activeClient = null;
    database.connect = originalConnect;
    database.query = originalQuery;
    await root.query("ROLLBACK");
    root.release();
  }
};

const asTestUser = <T>(userId: string, operation: () => Promise<T>): Promise<T> => {
  const user: AuthUser = {
    id: userId,
    nombre: "Prueba reemplazos",
    email: "reemplazos-test@local.invalid",
    cargo: "QA",
    rol: "SUPER_USUARIO",
    debeCambiarPassword: false,
    debeCambiarPin: false
  };
  return new Promise<T>((resolve, reject) => {
    runWithAuthUser(user, () => {
      void operation().then(resolve, reject);
    });
  });
};

const createFixture = async (): Promise<Fixture> => {
    const suffix = (Date.now() % 10000) * 20 + fixtureCounter++ * 2;
    const oldCode = 700000 + suffix;
    const newCode = oldCode + 1;
    const base = await dbQuery<{
      user_id: string;
      collaborator_id: string;
      type_id: string;
      type_name: string;
      assigned_state_id: string;
      available_state_id: string;
    }>(`
      SELECT
        (SELECT id FROM itam.usuarios ORDER BY id LIMIT 1) AS user_id,
        (SELECT id FROM itam.colaboradores WHERE activo = TRUE ORDER BY id LIMIT 1) AS collaborator_id,
        (SELECT id FROM itam.tipos_dispositivo WHERE activo = TRUE ORDER BY id LIMIT 1) AS type_id,
        (SELECT nombre FROM itam.tipos_dispositivo WHERE activo = TRUE ORDER BY id LIMIT 1) AS type_name,
        (SELECT id FROM itam.estados WHERE tipo_entidad = 'DISPOSITIVO' AND codigo = 'ASIGNADO' LIMIT 1) AS assigned_state_id,
        (SELECT id FROM itam.estados WHERE tipo_entidad = 'DISPOSITIVO' AND codigo = 'DISPONIBLE' LIMIT 1) AS available_state_id
    `);
    const row = base.rows[0];
    assert.ok(row?.user_id && row.collaborator_id && row.type_id && row.type_name);
    assert.ok(row.assigned_state_id && row.available_state_id);

    const old = await dbQuery<{ id: string }>(
      `INSERT INTO itam.dispositivos(
         codigo_inventario, tipo_dispositivo_id, tipo_dispositivo,
         estado_id, colaborador_id, valor_comercial
       ) VALUES ($1, $2, $3, $4, $5, 0)
       RETURNING id`,
      [oldCode, row.type_id, row.type_name, row.assigned_state_id, row.collaborator_id]
    );
    const newer = await dbQuery<{ id: string }>(
      `INSERT INTO itam.dispositivos(
         codigo_inventario, tipo_dispositivo_id, tipo_dispositivo,
         estado_id, valor_comercial
       ) VALUES ($1, $2, $3, $4, 0)
       RETURNING id`,
      [newCode, row.type_id, row.type_name, row.available_state_id]
    );
    return {
      actorId: row.user_id,
      collaboratorId: row.collaborator_id,
      oldCode,
      newCode,
      oldId: old.rows[0]!.id,
      newId: newer.rows[0]!.id
    };
};

const deviceState = async (code: number): Promise<{ state: string; collaboratorId: string | null; departmentId: string | null }> => {
  const result = await dbQuery<{ state: string; colaborador_id: string | null; departamento_id: string | null }>(
    `SELECT estado.codigo AS state, dispositivo.colaborador_id, dispositivo.departamento_id
     FROM itam.dispositivos dispositivo
     INNER JOIN itam.estados estado ON estado.id = dispositivo.estado_id
     WHERE dispositivo.codigo_inventario = $1`,
    [code]
  );
  assert.ok(result.rows[0]);
  return {
    state: result.rows[0]!.state,
    collaboratorId: result.rows[0]!.colaborador_id,
    departmentId: result.rows[0]!.departamento_id
  };
};

const replacementCount = async (fixture: Fixture): Promise<number> => {
  const result = await dbQuery<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM itam.reemplazos_dispositivo WHERE dispositivo_anterior_id = $1 OR dispositivo_nuevo_id = $1",
    [fixture.oldId]
  );
  return Number(result.rows[0]!.count);
};

const attachCurrentSim = async (fixture: Fixture): Promise<{
  simCode: number;
  simId: string;
  lineId: string;
  number: string;
}> => {
  const suffix = (Date.now() % 10000) * 20 + fixtureCounter++ * 2;
  const simCode = 800000 + suffix;
  const number = `569700${String(suffix).slice(-4)}`;
  const states = await dbQuery<{ sim_state_id: string }>(
    "SELECT id AS sim_state_id FROM itam.estados WHERE tipo_entidad = 'SIM' AND codigo = 'ASIGNADA' LIMIT 1"
  );
  assert.ok(states.rows[0]?.sim_state_id);
  const sim = await dbQuery<{ id: string }>(
    `INSERT INTO itam.sim
       (codigo_inventario, iccid_codigo_fabrica, estado_id, colaborador_id, dispositivo_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [simCode, `895600000000${String(suffix).padStart(7, "0").slice(-7)}`, states.rows[0]!.sim_state_id, fixture.collaboratorId, fixture.oldId]
  );
  const line = await dbQuery<{ id: string }>(
    `INSERT INTO itam.lineas_moviles
       (numero_telefonico, estado, colaborador_id, dispositivo_id, sim_id)
     VALUES ($1, 'ACTIVA', $2, $3, $4)
     RETURNING id`,
    [number, fixture.collaboratorId, fixture.oldId, sim.rows[0]!.id]
  );
  await dbQuery("UPDATE itam.sim SET linea_movil_id = $2 WHERE id = $1", [sim.rows[0]!.id, line.rows[0]!.id]);
  return { simCode, simId: sim.rows[0]!.id, lineId: line.rows[0]!.id, number };
};

const createAvailableSim = async (fixture: Fixture, withLine: boolean): Promise<{
  simCode: number;
  simId: string;
  lineId: string | null;
  number: string | null;
}> => {
  const suffix = (Date.now() % 10000) * 20 + fixtureCounter++ * 2;
  const simCode = 810000 + suffix;
  const number = withLine ? `569800${String(suffix).slice(-4)}` : null;
  const state = await dbQuery<{ id: string }>(
    "SELECT id FROM itam.estados WHERE tipo_entidad = 'SIM' AND codigo = 'DISPONIBLE' LIMIT 1"
  );
  assert.ok(state.rows[0]?.id);
  const sim = await dbQuery<{ id: string }>(
    `INSERT INTO itam.sim (codigo_inventario, iccid_codigo_fabrica, estado_id)
     VALUES ($1, $2, $3) RETURNING id`,
    [simCode, `895600000000${String(suffix + 1).padStart(7, "0").slice(-7)}`, state.rows[0]!.id]
  );
  if (!withLine) return { simCode, simId: sim.rows[0]!.id, lineId: null, number };
  const line = await dbQuery<{ id: string }>(
    `INSERT INTO itam.lineas_moviles
       (numero_telefonico, estado, dispositivo_id, colaborador_id, sim_id)
     VALUES ($1, 'ACTIVA', NULL, NULL, $2)
     RETURNING id`,
    [number, sim.rows[0]!.id]
  );
  await dbQuery("UPDATE itam.sim SET linea_movil_id = $2 WHERE id = $1", [sim.rows[0]!.id, line.rows[0]!.id]);
  return { simCode, simId: sim.rows[0]!.id, lineId: line.rows[0]!.id, number };
};

test("SIM: reemplazo inmediato puede mover la SIM y permitir DADO_BAJA", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const sim = await attachCurrentSim(fixture);
    const result = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: true,
      destinoDispositivoAnterior: "DADO_BAJA",
      motivoBaja: "OBSOLESCENCIA",
      accionSim: "MOVER_SIM_ACTUAL",
      responsable: "Prueba reemplazos"
    }));

    assert.equal(result.estadoOperacion, "COMPLETADO");
    const state = await dbQuery<{ old_state: string; old_sim: string | null; new_sim: string | null; sim_line: string | null; sim_collaborator: string | null; sim_state: string; line_device: string | null; number: string }>(
      `SELECT old_state.codigo AS old_state,
              (SELECT s.id FROM itam.sim s WHERE s.dispositivo_id = old_device.id LIMIT 1) AS old_sim,
              new_sim.codigo_inventario::text AS new_sim,
              new_sim.linea_movil_id AS sim_line,
              new_sim.colaborador_id AS sim_collaborator,
              sim_state.codigo AS sim_state,
              line.dispositivo_id AS line_device,
              line.numero_telefonico AS number
         FROM itam.dispositivos old_device
         JOIN itam.estados old_state ON old_state.id = old_device.estado_id
         JOIN itam.sim new_sim ON new_sim.id = $2
         JOIN itam.estados sim_state ON sim_state.id = new_sim.estado_id
         JOIN itam.lineas_moviles line ON line.id = $3
        WHERE old_device.id = $1`,
      [fixture.oldId, sim.simId, sim.lineId]
    );
    assert.equal(state.rows[0]?.old_state, "DADO_BAJA");
    assert.equal(state.rows[0]?.old_sim, null);
    assert.equal(Number(state.rows[0]?.new_sim), sim.simCode);
    assert.equal(state.rows[0]?.sim_line, sim.lineId);
    assert.equal(state.rows[0]?.sim_collaborator, fixture.collaboratorId);
    assert.equal(state.rows[0]?.sim_state, "ASIGNADA");
    assert.equal(state.rows[0]?.line_device, fixture.newId);
    assert.equal(state.rows[0]?.number, sim.number);
  });
});

test("SIM: reemplazo pendiente conserva anterior, SIM y línea sin moverlos", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const sim = await attachCurrentSim(fixture);
    const result = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      accionSim: "SIN_SIM",
      responsable: "Prueba reemplazos"
    }));

    assert.equal(result.estadoOperacion, "PENDIENTE_DEVOLUCION");
    const state = await dbQuery<{ sim_device: string | null; sim_collaborator: string | null; sim_line: string | null; sim_state: string; line_device: string | null; new_sim: string | null }>(
      `SELECT sim.dispositivo_id AS sim_device,
              sim.colaborador_id AS sim_collaborator,
              sim.linea_movil_id AS sim_line,
              sim_state.codigo AS sim_state,
              line.dispositivo_id AS line_device,
              (SELECT s.id FROM itam.sim s WHERE s.dispositivo_id = new_device.id LIMIT 1) AS new_sim
         FROM itam.sim sim
         JOIN itam.estados sim_state ON sim_state.id = sim.estado_id
         JOIN itam.lineas_moviles line ON line.id = $2
         JOIN itam.dispositivos new_device ON new_device.id = $3
        WHERE sim.id = $1`,
      [sim.simId, sim.lineId, fixture.newId]
    );
    assert.equal(state.rows[0]?.sim_device, fixture.oldId);
    assert.equal(state.rows[0]?.sim_collaborator, fixture.collaboratorId);
    assert.equal(state.rows[0]?.sim_line, sim.lineId);
    assert.equal(state.rows[0]?.sim_state, "ASIGNADA");
    assert.equal(state.rows[0]?.line_device, fixture.oldId);
    assert.equal(state.rows[0]?.new_sim, null);
  });
});

test("SIM: reemplazo puede usar otra SIM existente y su línea", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const current = await attachCurrentSim(fixture);
    const target = await createAvailableSim(fixture, true);
    const result = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: true,
      destinoDispositivoAnterior: "DISPONIBLE",
      accionSim: "USAR_SIM_EXISTENTE",
      simDestinoCodigo: target.simCode,
      conservarNumero: false,
      responsable: "Prueba reemplazos"
    }));

    assert.equal(result.estadoOperacion, "COMPLETADO");
    const state = await dbQuery<{ old_sim: string | null; old_line: string | null; target_device: string | null; target_line: string | null; target_number: string }>(
      `SELECT (SELECT s.id FROM itam.sim s WHERE s.dispositivo_id = old_device.id LIMIT 1) AS old_sim,
              old_line.dispositivo_id AS old_line,
              target_sim.dispositivo_id AS target_device,
              target_line.dispositivo_id AS target_line,
              target_line.numero_telefonico AS target_number
         FROM itam.dispositivos old_device
         JOIN itam.lineas_moviles old_line ON old_line.id = $2
         JOIN itam.sim target_sim ON target_sim.id = $3
         JOIN itam.lineas_moviles target_line ON target_line.id = $4
        WHERE old_device.id = $1`,
      [fixture.oldId, current.lineId, target.simId, target.lineId]
    );
    assert.equal(state.rows[0]?.old_sim, null);
    assert.equal(state.rows[0]?.old_line, null);
    assert.equal(state.rows[0]?.target_device, fixture.newId);
    assert.equal(state.rows[0]?.target_line, fixture.newId);
    assert.equal(state.rows[0]?.target_number, target.number);
    const oldSim = await dbQuery<{ dispositivo_id: string | null; linea_movil_id: string | null; colaborador_id: string | null; estado: string; event_type: string; detail: Record<string, unknown> }>(
      `SELECT s.dispositivo_id,
              s.linea_movil_id,
              s.colaborador_id,
              e.codigo AS estado,
              h.tipo_evento AS event_type,
              h.detalle AS detail
         FROM itam.sim s
         JOIN itam.estados e ON e.id = s.estado_id
         LEFT JOIN LATERAL (
           SELECT tipo_evento, detalle
             FROM itam.historial_eventos
            WHERE tipo_entidad = 'SIM' AND sim_id = s.id
            ORDER BY fecha_evento DESC, id DESC
            LIMIT 1
         ) h ON TRUE
        WHERE s.id = $1`,
      [current.simId]
    );
    assert.equal(oldSim.rows[0]?.dispositivo_id, null);
    assert.equal(oldSim.rows[0]?.linea_movil_id, current.lineId);
    assert.equal(oldSim.rows[0]?.colaborador_id, null);
    assert.equal(oldSim.rows[0]?.estado, "DISPONIBLE");
    assert.equal(oldSim.rows[0]?.event_type, "SIM_RECEPCIONADA_POR_TI");
    assert.equal(oldSim.rows[0]?.detail.reemplazoId, result.id);
    assert.equal(oldSim.rows[0]?.detail.comprobanteDevolucionId, result.comprobanteDevolucionId);
  });
});

test("SIM: entregar equipo nuevo sin SIM recibe físicamente la SIM anterior", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const current = await attachCurrentSim(fixture);
    const result = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: true,
      destinoDispositivoAnterior: "DISPONIBLE",
      accionSim: "SIN_SIM",
      responsable: "Prueba reemplazos"
    }));

    const state = await dbQuery<{ dispositivo_id: string | null; linea_movil_id: string | null; colaborador_id: string | null; estado: string; line_device: string | null; line_sim: string | null }>(
      `SELECT sim.dispositivo_id,
              sim.linea_movil_id,
              sim.colaborador_id,
              estado.codigo AS estado,
              line.dispositivo_id AS line_device,
              line.sim_id AS line_sim
         FROM itam.sim sim
         JOIN itam.estados estado ON estado.id = sim.estado_id
         JOIN itam.lineas_moviles line ON line.id = $2
        WHERE sim.id = $1`,
      [current.simId, current.lineId]
    );
    assert.equal(state.rows[0]?.dispositivo_id, null);
    assert.equal(state.rows[0]?.linea_movil_id, current.lineId);
    assert.equal(state.rows[0]?.colaborador_id, null);
    assert.equal(state.rows[0]?.estado, "DISPONIBLE");
    assert.equal(state.rows[0]?.line_device, null);
    assert.equal(state.rows[0]?.line_sim, current.simId);
    const event = await dbQuery<{ type: string; detail: Record<string, unknown> }>(
      `SELECT tipo_evento AS type, detalle AS detail
         FROM itam.historial_eventos
        WHERE tipo_entidad = 'SIM' AND sim_id = $1
        ORDER BY fecha_evento DESC, id DESC LIMIT 1`,
      [current.simId]
    );
    assert.equal(event.rows[0]?.type, "SIM_RECEPCIONADA_POR_TI");
    assert.equal(event.rows[0]?.detail.reemplazoId, result.id);
  });
});

test("SIM: si falla el destino posterior, la recepción física revierte completamente", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const current = await attachCurrentSim(fixture);
    await assert.rejects(asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: true,
      destinoDispositivoAnterior: "DADO_BAJA",
      accionSim: "SIN_SIM",
      responsable: "Prueba reemplazos"
    })));

    const state = await dbQuery<{ dispositivo_id: string | null; linea_movil_id: string | null; colaborador_id: string | null; estado: string }>(
      `SELECT sim.dispositivo_id,
              sim.linea_movil_id,
              sim.colaborador_id,
              estado.codigo AS estado
         FROM itam.sim sim
         JOIN itam.estados estado ON estado.id = sim.estado_id
        WHERE sim.id = $1`,
      [current.simId]
    );
    assert.equal(state.rows[0]?.dispositivo_id, fixture.oldId);
    assert.equal(state.rows[0]?.linea_movil_id, current.lineId);
    assert.equal(state.rows[0]?.colaborador_id, fixture.collaboratorId);
    assert.equal(state.rows[0]?.estado, "ASIGNADA");
    assert.equal(await replacementCount(fixture), 0);
  });
});

test("flujo: reemplazo inmediato es atómico, recibe anterior, asigna nuevo y completa", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const result = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: true,
      destinoDispositivoAnterior: "DISPONIBLE",
      responsable: "Prueba reemplazos"
    }));

    assert.equal(result.estadoOperacion, "COMPLETADO");
    assert.equal(result.destinoDispositivoAnterior, "DISPONIBLE");
    assert.ok(result.comprobanteDevolucionId);
    assert.deepEqual(await deviceState(fixture.oldCode), {
      state: "DISPONIBLE",
      collaboratorId: null,
      departmentId: null
    });
    assert.deepEqual(await deviceState(fixture.newCode), {
      state: "ASIGNADO",
      collaboratorId: fixture.collaboratorId,
      departmentId: null
    });
    const receipt = await dbQuery<{ origin: string }>(
      "SELECT origen AS origin FROM itam.comprobantes_devolucion WHERE id = $1",
      [result.comprobanteDevolucionId]
    );
    assert.equal(receipt.rows[0]?.origin, "REEMPLAZO");
  });
});

test("DADO_BAJA: reemplazo no evade la protecciÃ³n cuando el anterior tiene SIM", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    await dbQuery(
      `UPDATE itam.sim
          SET dispositivo_id = $1,
              estado_id = (SELECT id FROM itam.estados WHERE tipo_entidad = 'SIM' AND codigo = 'ASIGNADA' LIMIT 1)
        WHERE id = (
          SELECT s.id FROM itam.sim s
           WHERE s.dispositivo_id IS NULL
           ORDER BY s.id LIMIT 1
        )`,
      [fixture.oldId]
    );

    await assert.rejects(
      asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
        colaboradorId: Number(fixture.collaboratorId),
        dispositivoAnteriorCodigo: fixture.oldCode,
        dispositivoNuevoCodigo: fixture.newCode,
        entregaAnterior: true,
        destinoDispositivoAnterior: "DADO_BAJA",
        motivoBaja: "OBSOLESCENCIA",
        responsable: "Prueba reemplazos"
      })),
      /SIM asociada/
    );
    assert.equal(await replacementCount(fixture), 0);
  });
});

test("flujo: reemplazo sin entrega conserva custodia anterior y persiste la obligación", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const result = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      responsable: "Prueba reemplazos"
    }));

    assert.equal(result.estadoOperacion, "PENDIENTE_DEVOLUCION");
    assert.equal(result.comprobanteDevolucionId, null);
    assert.deepEqual(await deviceState(fixture.oldCode), {
      state: "ASIGNADO",
      collaboratorId: fixture.collaboratorId,
      departmentId: null
    });
    assert.deepEqual(await deviceState(fixture.newCode), {
      state: "ASIGNADO",
      collaboratorId: fixture.collaboratorId,
      departmentId: null
    });
  });
});

test("flujo: recepción posterior y devolución genérica cierran una sola vez", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const pending = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      responsable: "Prueba reemplazos"
    }));
    const closed = await asTestUser(fixture.actorId, () => recibirReemplazoPendiente(pending.id, {
      destinoDispositivoAnterior: "RETENIDO_REVISION",
      responsable: "Prueba reemplazos"
    }));
    assert.equal(closed.estadoOperacion, "COMPLETADO");
    assert.ok(closed.comprobante?.id);
    assert.deepEqual(await deviceState(fixture.oldCode), {
      state: "RETENIDO_REVISION",
      collaboratorId: null,
      departmentId: null
    });
    await assert.rejects(
      asTestUser(fixture.actorId, () => recibirReemplazoPendiente(pending.id, {
        destinoDispositivoAnterior: "DISPONIBLE",
        responsable: "Prueba reemplazos"
      }))
    );
    assert.equal(await replacementCount(fixture), 1);

    const genericFixture = await createFixture();
      const genericPending = await asTestUser(genericFixture.actorId, () => crearReemplazoDispositivo({
        colaboradorId: Number(genericFixture.collaboratorId),
        dispositivoAnteriorCodigo: genericFixture.oldCode,
        dispositivoNuevoCodigo: genericFixture.newCode,
        entregaAnterior: false,
        responsable: "Prueba reemplazos"
      }));
      const genericResult = await asTestUser(genericFixture.actorId, () => devolverDispositivoExistente(genericFixture.oldCode, {
        responsable: "Prueba devolución genérica",
        resultado: "DEVUELTO"
      }));
      assert.equal(genericResult.comprobante.resultado, "DEVUELTO");
      assert.deepEqual(await deviceState(genericFixture.oldCode), {
        state: "RETENIDO_REVISION",
        collaboratorId: null,
        departmentId: null
      });
      await assert.rejects(
        asTestUser(genericFixture.actorId, () => recibirReemplazoPendiente(genericPending.id, {
          destinoDispositivoAnterior: "DISPONIBLE",
          responsable: "Prueba reemplazos"
        }))
      );
      const receipts = await dbQuery<{ count: string }>(
        "SELECT COUNT(*)::text AS count FROM itam.comprobantes_devolucion WHERE dispositivo_id = $1 AND origen = 'REEMPLAZO'",
        [genericFixture.oldId]
      );
      assert.equal(Number(receipts.rows[0]!.count), 1);
  });
});

test("recepción posterior con SIM entregada conserva la línea y recibe físicamente la SIM", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const current = await attachCurrentSim(fixture);
    const pending = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      responsable: "Prueba recepción SIM"
    }));

    await assert.rejects(
      asTestUser(fixture.actorId, () => recibirReemplazoPendiente(pending.id, {
        destinoDispositivoAnterior: "RETENIDO_REVISION",
        responsable: "Prueba recepción SIM"
      })),
      /SIM.*entregada físicamente/
    );

    const closed = await asTestUser(fixture.actorId, () => recibirReemplazoPendiente(pending.id, {
      destinoDispositivoAnterior: "RETENIDO_REVISION",
      simEntregada: true,
      responsable: "Prueba recepción SIM"
    }));
    assert.equal(closed.estadoOperacion, "COMPLETADO");

    const state = await dbQuery<{
      sim_device: string | null;
      sim_collaborator: string | null;
      sim_line: string | null;
      sim_state: string;
      line_sim: string | null;
      line_device: string | null;
      line_collaborator: string | null;
      line_number: string;
      device_state: string;
    }>(
      `SELECT sim.dispositivo_id AS sim_device,
              sim.colaborador_id AS sim_collaborator,
              sim.linea_movil_id AS sim_line,
              sim_estado.codigo AS sim_state,
              linea.sim_id AS line_sim,
              linea.dispositivo_id AS line_device,
              linea.colaborador_id AS line_collaborator,
              linea.numero_telefonico AS line_number,
              dispositivo_estado.codigo AS device_state
         FROM itam.sim sim
         JOIN itam.estados sim_estado ON sim_estado.id = sim.estado_id
         JOIN itam.lineas_moviles linea ON linea.id = $2
         JOIN itam.dispositivos dispositivo ON dispositivo.id = $3
         JOIN itam.estados dispositivo_estado ON dispositivo_estado.id = dispositivo.estado_id
        WHERE sim.id = $1`,
      [current.simId, current.lineId, fixture.oldId]
    );
    assert.equal(state.rows[0]?.sim_device, null);
    assert.equal(state.rows[0]?.sim_collaborator, null);
    assert.equal(state.rows[0]?.sim_line, current.lineId);
    assert.equal(state.rows[0]?.sim_state, "DISPONIBLE");
    assert.equal(state.rows[0]?.line_sim, current.simId);
    assert.equal(state.rows[0]?.line_device, null);
    assert.equal(state.rows[0]?.line_collaborator, null);
    assert.equal(state.rows[0]?.line_number, current.number);
    assert.equal(state.rows[0]?.device_state, "RETENIDO_REVISION");
    const event = await dbQuery<{ type: string; detail: Record<string, unknown> }>(
      `SELECT tipo_evento AS type, detalle AS detail
         FROM itam.historial_eventos
        WHERE tipo_entidad = 'SIM' AND sim_id = $1
        ORDER BY fecha_evento DESC, id DESC LIMIT 1`,
      [current.simId]
    );
    assert.equal(event.rows[0]?.type, "SIM_RECEPCIONADA_POR_TI");
    assert.equal(event.rows[0]?.detail.reemplazoId, pending.id);
    assert.equal(event.rows[0]?.detail.comprobanteDevolucionId, closed.comprobanteDevolucionId);
  });
});

test("recepción posterior solo del dispositivo conserva la custodia de la SIM", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const current = await attachCurrentSim(fixture);
    const pending = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      responsable: "Prueba SIM no entregada"
    }));
    const closed = await asTestUser(fixture.actorId, () => recibirReemplazoPendiente(pending.id, {
      destinoDispositivoAnterior: "RETENIDO_REVISION",
      simEntregada: false,
      responsable: "Prueba SIM no entregada"
    }));
    assert.equal(closed.estadoOperacion, "COMPLETADO");

    const state = await dbQuery<{
      sim_device: string | null;
      sim_collaborator: string | null;
      sim_line: string | null;
      sim_state: string;
      line_sim: string | null;
      line_device: string | null;
      line_collaborator: string | null;
      device_state: string;
    }>(
      `SELECT sim.dispositivo_id AS sim_device,
              sim.colaborador_id AS sim_collaborator,
              sim.linea_movil_id AS sim_line,
              sim_estado.codigo AS sim_state,
              linea.sim_id AS line_sim,
              linea.dispositivo_id AS line_device,
              linea.colaborador_id AS line_collaborator,
              dispositivo_estado.codigo AS device_state
         FROM itam.sim sim
         JOIN itam.estados sim_estado ON sim_estado.id = sim.estado_id
         JOIN itam.lineas_moviles linea ON linea.id = $2
         JOIN itam.dispositivos dispositivo ON dispositivo.id = $3
         JOIN itam.estados dispositivo_estado ON dispositivo_estado.id = dispositivo.estado_id
        WHERE sim.id = $1`,
      [current.simId, current.lineId, fixture.oldId]
    );
    assert.equal(state.rows[0]?.sim_device, null);
    assert.equal(state.rows[0]?.sim_collaborator, fixture.collaboratorId);
    assert.equal(state.rows[0]?.sim_line, current.lineId);
    assert.equal(state.rows[0]?.sim_state, "ASIGNADA");
    assert.equal(state.rows[0]?.line_sim, current.simId);
    assert.equal(state.rows[0]?.line_device, null);
    assert.equal(state.rows[0]?.line_collaborator, fixture.collaboratorId);
    assert.equal(state.rows[0]?.device_state, "RETENIDO_REVISION");
    const event = await dbQuery<{ type: string; detail: Record<string, unknown> }>(
      `SELECT tipo_evento AS type, detalle AS detail
         FROM itam.historial_eventos
        WHERE tipo_entidad = 'SIM' AND sim_id = $1
        ORDER BY fecha_evento DESC, id DESC LIMIT 1`,
      [current.simId]
    );
    assert.equal(event.rows[0]?.type, "SIM_NO_ENTREGADA_EN_DEVOLUCION");
    assert.equal(event.rows[0]?.detail.reemplazoId, pending.id);
    assert.equal(event.rows[0]?.detail.comprobanteDevolucionId, closed.comprobanteDevolucionId);
  });
});

test("recepción posterior permite DADO_BAJA con SIM entregada o retenida por el colaborador", async () => {
  await withIsolatedDatabase(async () => {
    const deliveredFixture = await createFixture();
    const deliveredSim = await attachCurrentSim(deliveredFixture);
    const deliveredPending = await asTestUser(deliveredFixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(deliveredFixture.collaboratorId), dispositivoAnteriorCodigo: deliveredFixture.oldCode,
      dispositivoNuevoCodigo: deliveredFixture.newCode, entregaAnterior: false, responsable: "Prueba baja SIM"
    }));
    await asTestUser(deliveredFixture.actorId, () => recibirReemplazoPendiente(deliveredPending.id, {
      destinoDispositivoAnterior: "DADO_BAJA", motivoBaja: "OBSOLESCENCIA", simEntregada: true,
      responsable: "Prueba baja SIM"
    }));
    assert.equal((await deviceState(deliveredFixture.oldCode)).state, "DADO_BAJA");
    const deliveredState = await dbQuery<{ device: string | null; state: string }>(
      `SELECT dispositivo_id AS device, estado.codigo AS state FROM itam.sim JOIN itam.estados estado ON estado.id = sim.estado_id WHERE sim.id = $1`, [deliveredSim.simId]
    );
    assert.equal(deliveredState.rows[0]?.device, null);
    assert.equal(deliveredState.rows[0]?.state, "DISPONIBLE");

    const retainedFixture = await createFixture();
    const retainedSim = await attachCurrentSim(retainedFixture);
    const retainedPending = await asTestUser(retainedFixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(retainedFixture.collaboratorId), dispositivoAnteriorCodigo: retainedFixture.oldCode,
      dispositivoNuevoCodigo: retainedFixture.newCode, entregaAnterior: false, responsable: "Prueba baja SIM"
    }));
    await asTestUser(retainedFixture.actorId, () => recibirReemplazoPendiente(retainedPending.id, {
      destinoDispositivoAnterior: "DADO_BAJA", motivoBaja: "OBSOLESCENCIA", simEntregada: false,
      responsable: "Prueba baja SIM"
    }));
    assert.equal((await deviceState(retainedFixture.oldCode)).state, "DADO_BAJA");
    const retainedState = await dbQuery<{ device: string | null; collaborator: string | null; state: string }>(
      `SELECT dispositivo_id AS device, colaborador_id AS collaborator, estado.codigo AS state FROM itam.sim JOIN itam.estados estado ON estado.id = sim.estado_id WHERE sim.id = $1`, [retainedSim.simId]
    );
    assert.equal(retainedState.rows[0]?.device, null);
    assert.equal(retainedState.rows[0]?.collaborator, retainedFixture.collaboratorId);
    assert.equal(retainedState.rows[0]?.state, "ASIGNADA");
  });
});

test("validaciones: anterior incorrecto y nuevo ocupado no persisten reemplazos", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const otherCollaborator = await dbQuery<{ id: string }>(
      "SELECT id FROM itam.colaboradores WHERE activo = TRUE AND id <> $1 ORDER BY id LIMIT 1",
      [fixture.collaboratorId]
    );
    assert.ok(otherCollaborator.rows[0]);
    await assert.rejects(asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(otherCollaborator.rows[0]!.id),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      responsable: "Prueba reemplazos"
    })));
    assert.equal(await replacementCount(fixture), 0);

    await dbQuery("UPDATE itam.dispositivos SET colaborador_id = $1, estado_id = (SELECT id FROM itam.estados WHERE tipo_entidad='DISPOSITIVO' AND codigo='ASIGNADO' LIMIT 1) WHERE id = $2", [fixture.collaboratorId, fixture.newId]);
    await assert.rejects(asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      responsable: "Prueba reemplazos"
    })));
    assert.equal(await replacementCount(fixture), 0);
  });
});

test("rollback: un reemplazo inmediato inválido no asigna el nuevo ni crea auditoría", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    await assert.rejects(asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: true,
      destinoDispositivoAnterior: "DADO_BAJA",
      responsable: "Prueba reemplazos"
    })));
    assert.equal(await replacementCount(fixture), 0);
    assert.deepEqual(await deviceState(fixture.oldCode), {
      state: "ASIGNADO",
      collaboratorId: fixture.collaboratorId,
      departmentId: null
    });
    assert.deepEqual(await deviceState(fixture.newCode), {
      state: "DISPONIBLE",
      collaboratorId: null,
      departmentId: null
    });
    const events = await dbQuery<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM itam.historial_eventos WHERE dispositivo_id = ANY($1::bigint[])",
      [[fixture.oldId, fixture.newId]]
    );
    assert.equal(Number(events.rows[0]!.count), 0);
  });
});

test("3C2: registra una SIM nueva con número nuevo y la asigna atómicamente", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const suffix = (Date.now() % 100000) * 2 + fixtureCounter++;
    const iccid = `895600000000${String(suffix).padStart(7, "0").slice(-7)}`;
    const phone = `5699${String(suffix).padStart(7, "0").slice(-7)}`;
    const result = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      accionSim: "REGISTRAR_SIM_NUEVA",
      simNueva: { iccidCodigoFabrica: iccid, linea: "NUMERO_NUEVO", numeroTelefonico: phone, compania: "Operador QA" },
      responsable: "Prueba SIM nueva"
    }));

    assert.equal(result.estadoOperacion, "PENDIENTE_DEVOLUCION");
    const state = await dbQuery<{ code: number; state: string; device: string | null; collaborator: string | null; line: string | null; lineDevice: string | null; lineCollaborator: string | null; lineNumber: string | null; eventDetail: Record<string, unknown> }>(
      `SELECT sim.codigo_inventario AS code, sim_state.codigo AS state, sim.dispositivo_id AS device,
              sim.colaborador_id AS collaborator, sim.linea_movil_id AS line,
              linea.dispositivo_id AS "lineDevice", linea.colaborador_id AS "lineCollaborator",
              linea.numero_telefonico AS "lineNumber", event.detalle AS "eventDetail"
         FROM itam.sim sim
         JOIN itam.estados sim_state ON sim_state.id = sim.estado_id
         JOIN itam.lineas_moviles linea ON linea.id = sim.linea_movil_id
         LEFT JOIN LATERAL (SELECT detalle FROM itam.historial_eventos WHERE sim_id = sim.id AND tipo_evento = 'ALTA_SIM' ORDER BY fecha_evento DESC, id DESC LIMIT 1) event ON TRUE
        WHERE sim.iccid_codigo_fabrica = $1`,
      [iccid]
    );
    assert.equal(state.rows[0]?.state, "ASIGNADA");
    assert.equal(state.rows[0]?.device, fixture.newId);
    assert.equal(state.rows[0]?.collaborator, fixture.collaboratorId);
    assert.equal(state.rows[0]?.lineDevice, fixture.newId);
    assert.equal(state.rows[0]?.lineCollaborator, fixture.collaboratorId);
    assert.equal(state.rows[0]?.lineNumber, phone);
    assert.equal(state.rows[0]?.eventDetail.reemplazoId, result.id);
    assert.equal(state.rows[0]?.eventDetail.origen, "REEMPLAZO_DISPOSITIVO");
    assert.ok(state.rows[0]?.code);
  });
});

test("3C2: conserva el número y deja la SIM anterior sin línea cuando la devolución queda pendiente", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const oldSim = await attachCurrentSim(fixture);
    await dbQuery("UPDATE itam.sim SET compania = 'CLARO' WHERE id = $1", [oldSim.simId]);
    const oldIccid = await dbQuery<{ iccid: string }>("SELECT iccid_codigo_fabrica AS iccid FROM itam.sim WHERE id = $1", [oldSim.simId]);
    const suffix = (Date.now() % 100000) * 2 + fixtureCounter++;
    const newIccid = `895600000000${String(suffix).padStart(7, "0").slice(-7)}`;
    const result = await asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      accionSim: "REGISTRAR_SIM_NUEVA",
      simNueva: { iccidCodigoFabrica: newIccid, linea: "CONSERVAR_NUMERO", compania: "WOM" },
      responsable: "Prueba SIM nueva"
    }));

    assert.equal(result.estadoOperacion, "PENDIENTE_DEVOLUCION");
    const state = await dbQuery<{ oldDevice: string | null; oldCollaborator: string | null; oldLine: string | null; oldState: string; newDevice: string | null; newLine: string | null; lineDevice: string | null; lineSim: string | null }>(
      `SELECT old_sim.dispositivo_id AS "oldDevice", old_sim.colaborador_id AS "oldCollaborator", old_sim.linea_movil_id AS "oldLine", old_state.codigo AS "oldState",
              new_sim.dispositivo_id AS "newDevice", new_sim.linea_movil_id AS "newLine", linea.dispositivo_id AS "lineDevice", linea.sim_id AS "lineSim"
         FROM itam.sim old_sim
         JOIN itam.estados old_state ON old_state.id = old_sim.estado_id
         JOIN itam.sim new_sim ON new_sim.iccid_codigo_fabrica = $2
         JOIN itam.lineas_moviles linea ON linea.id = $3
        WHERE old_sim.id = $1`,
      [oldSim.simId, newIccid, oldSim.lineId]
    );
    assert.equal(state.rows[0]?.oldDevice, fixture.oldId);
    assert.equal(state.rows[0]?.oldCollaborator, fixture.collaboratorId);
    assert.equal(state.rows[0]?.oldLine, null);
    assert.equal(state.rows[0]?.oldState, "ASIGNADA");
    assert.equal(state.rows[0]?.newDevice, fixture.newId);
    assert.equal(state.rows[0]?.newLine, oldSim.lineId);
    assert.equal(state.rows[0]?.lineDevice, fixture.newId);
    assert.notEqual(state.rows[0]?.lineSim, oldSim.simId);
    assert.equal(result.id.length > 0, true);
    assert.equal(oldIccid.rows[0]?.iccid?.length, 19);
  });
});

test("3C2: rechaza un ICCID existente sin crear un reemplazo", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const current = await attachCurrentSim(fixture);
    const existing = await dbQuery<{ iccid: string }>("SELECT iccid_codigo_fabrica AS iccid FROM itam.sim WHERE id = $1", [current.simId]);
    await assert.rejects(asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: false,
      accionSim: "REGISTRAR_SIM_NUEVA",
      simNueva: { iccidCodigoFabrica: existing.rows[0]!.iccid, linea: "SIN_LINEA" },
      responsable: "Prueba ICCID duplicado"
    })));
    assert.equal(await replacementCount(fixture), 0);
    const duplicate = await dbQuery<{ count: string }>("SELECT COUNT(*)::text AS count FROM itam.sim WHERE iccid_codigo_fabrica = $1", [existing.rows[0]!.iccid]);
    assert.equal(Number(duplicate.rows[0]!.count), 1);
  });
});

test("3C2: rollback elimina la SIM nueva y el código lógico si falla el destino final", async () => {
  await withIsolatedDatabase(async () => {
    const fixture = await createFixture();
    const suffix = (Date.now() % 100000) * 2 + fixtureCounter++;
    const iccid = `895600000000${String(suffix).padStart(7, "0").slice(-7)}`;
    await assert.rejects(asTestUser(fixture.actorId, () => crearReemplazoDispositivo({
      colaboradorId: Number(fixture.collaboratorId),
      dispositivoAnteriorCodigo: fixture.oldCode,
      dispositivoNuevoCodigo: fixture.newCode,
      entregaAnterior: true,
      destinoDispositivoAnterior: "DADO_BAJA",
      accionSim: "REGISTRAR_SIM_NUEVA",
      simNueva: { iccidCodigoFabrica: iccid, linea: "SIN_LINEA" },
      responsable: "Prueba rollback SIM nueva"
    })));
    const created = await dbQuery<{ count: string }>("SELECT COUNT(*)::text AS count FROM itam.sim WHERE iccid_codigo_fabrica = $1", [iccid]);
    assert.equal(Number(created.rows[0]!.count), 0);
    assert.equal(await replacementCount(fixture), 0);
    assert.deepEqual(await deviceState(fixture.newCode), { state: "DISPONIBLE", collaboratorId: null, departmentId: null });
  });
});
