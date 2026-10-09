import assert from "node:assert/strict";
import test from "node:test";
import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { gestionarLineaSimEnTransaccion } from "./gestionar-linea-sim.service";
import { buscarLineaMovilPorNumero, vincularLineaMovilASim } from "./lineas-moviles.service";
import { registrarSimNuevaEnTransaccion } from "./registrar-sim-linea.service";
import { obtenerLineaPorNumeroConContexto } from "./lineas-moviles.repository";
import { obtenerSimPorCodigo } from "../sim/sim.repository";

type Fixture = {
  deviceCode: number;
  deviceId: string;
  collaboratorId: string;
  lineId: string;
  currentSimCode: number;
  currentSimId: string;
  targetSimCode: number;
  targetSimId: string;
  currentNumber: string;
  currentIccid: string;
};

let sequence = 0;

const withTransaction = async <T>(operation: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    return await operation(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
};

const createFixture = async (client: PoolClient): Promise<Fixture> => {
  const suffix = `${Date.now()}${sequence++}`.slice(-6);
  const deviceCode = 880000 + Number(suffix);
  const currentSimCode = 890000 + Number(suffix);
  const targetSimCode = currentSimCode + 100;
  const currentNumber = `569${String(80000000 + Number(suffix)).slice(-8)}`;
  const currentIccid = `895603999999${String(1000000 + Number(suffix)).slice(-7)}`;
  const targetIccid = `895603999998${String(1000000 + Number(suffix)).slice(-7)}`;

  const base = await client.query<{
    collaborator_id: string;
    type_id: string;
    type_name: string;
    device_state_id: string;
    sim_available_state_id: string;
    sim_assigned_state_id: string;
  }>(`
    SELECT
      (SELECT id FROM itam.colaboradores WHERE activo = TRUE ORDER BY id LIMIT 1) AS collaborator_id,
      (SELECT id FROM itam.tipos_dispositivo
        WHERE activo = TRUE
          AND (UPPER(nombre) = 'SMARTPHONE' OR configuracion_formulario->>'permiteSim' = 'true')
        ORDER BY id LIMIT 1) AS type_id,
      (SELECT nombre FROM itam.tipos_dispositivo
        WHERE activo = TRUE
          AND (UPPER(nombre) = 'SMARTPHONE' OR configuracion_formulario->>'permiteSim' = 'true')
        ORDER BY id LIMIT 1) AS type_name,
      (SELECT id FROM itam.estados WHERE tipo_entidad = 'DISPOSITIVO' AND codigo = 'ASIGNADO' LIMIT 1) AS device_state_id,
      (SELECT id FROM itam.estados WHERE tipo_entidad = 'SIM' AND codigo = 'DISPONIBLE' LIMIT 1) AS sim_available_state_id,
      (SELECT id FROM itam.estados WHERE tipo_entidad = 'SIM' AND codigo = 'ASIGNADA' LIMIT 1) AS sim_assigned_state_id
  `);
  const row = base.rows[0];
  assert.ok(row?.collaborator_id && row.type_id && row.type_name);
  assert.ok(row.device_state_id && row.sim_available_state_id && row.sim_assigned_state_id);

  const device = await client.query<{ id: string }>(
    `INSERT INTO itam.dispositivos
       (codigo_inventario, tipo_dispositivo_id, tipo_dispositivo, estado_id, colaborador_id, valor_comercial)
     VALUES ($1,$2,$3,$4,$5,0) RETURNING id`,
    [deviceCode, row.type_id, row.type_name, row.device_state_id, row.collaborator_id]
  );
  const currentSim = await client.query<{ id: string }>(
    `INSERT INTO itam.sim
       (codigo_inventario, iccid_codigo_fabrica, estado_id, colaborador_id, dispositivo_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [currentSimCode, currentIccid, row.sim_assigned_state_id, row.collaborator_id, device.rows[0]!.id]
  );
  const targetSim = await client.query<{ id: string }>(
    `INSERT INTO itam.sim
       (codigo_inventario, iccid_codigo_fabrica, estado_id)
     VALUES ($1,$2,$3) RETURNING id`,
    [targetSimCode, targetIccid, row.sim_available_state_id]
  );
  const line = await client.query<{ id: string }>(
    `INSERT INTO itam.lineas_moviles
       (numero_telefonico, estado, colaborador_id, dispositivo_id, sim_id)
     VALUES ($1,'ACTIVA',$2,$3,$4) RETURNING id`,
    [currentNumber, row.collaborator_id, device.rows[0]!.id, currentSim.rows[0]!.id]
  );
  await client.query(
    "UPDATE itam.sim SET linea_movil_id=$2 WHERE id=$1",
    [currentSim.rows[0]!.id, line.rows[0]!.id]
  );

  return {
    deviceCode,
    deviceId: device.rows[0]!.id,
    collaboratorId: row.collaborator_id,
    lineId: line.rows[0]!.id,
    currentSimCode,
    currentSimId: currentSim.rows[0]!.id,
    targetSimCode,
    targetSimId: targetSim.rows[0]!.id,
    currentNumber,
    currentIccid
  };
};

const removeDeviceLine = async (client: PoolClient, fixture: Fixture): Promise<void> => {
  await client.query(
    `UPDATE itam.lineas_moviles
        SET dispositivo_id=NULL, colaborador_id=NULL, sim_id=NULL
      WHERE id=$1`,
    [fixture.lineId]
  );
  await client.query(
    `UPDATE itam.sim SET linea_movil_id=NULL, numero_asociado=NULL,
       dispositivo_id=NULL, colaborador_id=NULL
      WHERE id=$1`,
    [fixture.currentSimId]
  );
};

test("mantener SIM + mantener número no escribe ni genera historial", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const before = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM itam.historial_eventos"
    );
    const result = await gestionarLineaSimEnTransaccion(
      fixture.deviceCode,
      {
        mantenerSim: true,
        mantenerNumero: true,
        simDestinoCodigo: null,
        numeroNuevo: null,
        responsable: "TEST"
      },
      client
    );
    const after = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM itam.historial_eventos"
    );
    assert.equal(result.operacion, "MANTENER_SIM_MANTENER_NUMERO");
    assert.equal(result.linea?.numeroTelefonico, fixture.currentNumber);
    assert.equal(result.simActual?.codigoInventario, fixture.currentSimCode);
    assert.equal(after.rows[0]!.count, before.rows[0]!.count);
  });
});

test("una relacion sembrada como estado inicial se cierra al cambiar de SIM", async () => {
  await withTransaction(async (client) => {
    const fixture = await client.query<{
      device_code: number;
      line_id: string;
      current_sim_id: string;
      target_sim_code: number;
    }>(`
      SELECT d.codigo_inventario AS device_code,
             l.id AS line_id,
             current_sim.id AS current_sim_id,
             target_sim.codigo_inventario AS target_sim_code
        FROM itam.dispositivos d
        JOIN itam.estados device_state ON device_state.id = d.estado_id
        JOIN itam.lineas_moviles l
          ON l.dispositivo_id = d.id
        JOIN itam.sim current_sim
          ON current_sim.id = l.sim_id
         AND current_sim.linea_movil_id = l.id
        JOIN itam.lineas_moviles_sim_historial seeded
          ON seeded.linea_movil_id = l.id
         AND seeded.sim_id = current_sim.id
         AND seeded.fecha_fin IS NULL
         AND seeded.motivo = 'MIGRACION_ESTADO_INICIAL'
        CROSS JOIN LATERAL (
          SELECT s.codigo_inventario
            FROM itam.sim s
            JOIN itam.estados sim_state ON sim_state.id = s.estado_id
           WHERE sim_state.codigo = 'DISPONIBLE'
             AND s.dispositivo_id IS NULL
             AND s.colaborador_id IS NULL
             AND s.linea_movil_id IS NULL
           ORDER BY s.id
           LIMIT 1
        ) target_sim
       WHERE device_state.codigo <> 'DADO_BAJA'
       ORDER BY d.id
       LIMIT 1
    `);
    const row = fixture.rows[0];
    assert.ok(row, "debe existir una asociacion sembrada y una SIM disponible");

    const result = await gestionarLineaSimEnTransaccion(
      row.device_code,
      {
        mantenerSim: false,
        mantenerNumero: true,
        simDestinoCodigo: row.target_sim_code,
        numeroNuevo: null,
        responsable: "TEST_MIGRACION_039"
      },
      client
    );

    const relations = await client.query<{
      sim_id: string;
      fecha_fin: string | null;
      motivo: string;
    }>(
      `SELECT sim_id, fecha_fin, motivo
         FROM itam.lineas_moviles_sim_historial
        WHERE linea_movil_id = $1
        ORDER BY id`,
      [row.line_id]
    );
    const active = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total
         FROM itam.lineas_moviles_sim_historial
        WHERE linea_movil_id = $1
          AND fecha_fin IS NULL`,
      [row.line_id]
    );

    assert.equal(result.simAnterior?.id, row.current_sim_id);
    assert.equal(result.simActual?.codigoInventario, row.target_sim_code);
    assert.equal(relations.rows.length, 2);
    assert.equal(relations.rows[0]!.sim_id, row.current_sim_id);
    assert.equal(relations.rows[0]!.motivo, "MIGRACION_ESTADO_INICIAL");
    assert.ok(relations.rows[0]!.fecha_fin);
    assert.equal(relations.rows[1]!.fecha_fin, null);
    assert.equal(active.rows[0]!.total, "1");
  });
});

test("mantener SIM + cambiar número conserva la SIM y actualiza la fuente oficial", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const nextNumber = "56991112222";
    const result = await gestionarLineaSimEnTransaccion(
      fixture.deviceCode,
      {
        mantenerSim: true,
        mantenerNumero: false,
        simDestinoCodigo: null,
        numeroNuevo: nextNumber,
        responsable: "TEST"
      },
      client
    );
    const row = await client.query<{ numero: string; legacy: string | null }>(
      `SELECT l.numero_telefonico AS numero, s.numero_asociado AS legacy
         FROM itam.lineas_moviles l
         JOIN itam.sim s ON s.id=l.sim_id WHERE l.id=$1`,
      [fixture.lineId]
    );
    assert.equal(result.operacion, "MANTENER_SIM_CAMBIAR_NUMERO");
    assert.equal(row.rows[0]!.numero, nextNumber);
    assert.equal(row.rows[0]!.legacy, nextNumber);
    assert.equal(result.simActual?.id, fixture.currentSimId);
  });
});

test("cambiar SIM + mantener número cierra la relación anterior y abre la nueva", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const result = await gestionarLineaSimEnTransaccion(
      fixture.deviceCode,
      {
        mantenerSim: false,
        mantenerNumero: true,
        simDestinoCodigo: fixture.targetSimCode,
        numeroNuevo: null,
        responsable: "TEST"
      },
      client
    );
    const relations = await client.query<{ sim_id: string; fecha_fin: string | null }>(
      `SELECT sim_id, fecha_fin FROM itam.lineas_moviles_sim_historial
        WHERE linea_movil_id=$1 ORDER BY id`,
      [fixture.lineId]
    );
    const refs = await client.query<{ old_device: string | null; old_line: string | null; new_device: string | null; new_line: string | null }>(
      `SELECT
         (SELECT dispositivo_id FROM itam.sim WHERE id=$1) AS old_device,
         (SELECT linea_movil_id FROM itam.sim WHERE id=$1) AS old_line,
         (SELECT dispositivo_id FROM itam.sim WHERE id=$2) AS new_device,
         (SELECT linea_movil_id FROM itam.sim WHERE id=$2) AS new_line`,
      [fixture.currentSimId, fixture.targetSimId]
    );
    assert.equal(result.operacion, "CAMBIAR_SIM_MANTENER_NUMERO");
    assert.equal(result.simActual?.codigoInventario, fixture.targetSimCode);
    assert.equal(relations.rows.length, 1);
    assert.equal(relations.rows[0]!.sim_id, fixture.targetSimId);
    assert.equal(relations.rows[0]!.fecha_fin, null);
    assert.equal(refs.rows[0]!.old_device, null);
    assert.equal(refs.rows[0]!.old_line, null);
    assert.equal(refs.rows[0]!.new_device, fixture.deviceId);
    assert.equal(refs.rows[0]!.new_line, fixture.lineId);
  });
});

test("asociar SIM disponible a dispositivo sin custodio ni línea crea ambos historiales", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    await removeDeviceLine(client, fixture);
    await client.query(
      `UPDATE itam.dispositivos
          SET colaborador_id=NULL,
              estado_id=(SELECT id FROM itam.estados WHERE tipo_entidad='DISPOSITIVO' AND codigo='DISPONIBLE' LIMIT 1)
        WHERE id=$1`,
      [fixture.deviceId]
    );

    const result = await gestionarLineaSimEnTransaccion(
      fixture.deviceCode,
      {
        mantenerSim: false,
        mantenerNumero: true,
        simDestinoCodigo: fixture.targetSimCode,
        numeroNuevo: null,
        responsable: "TEST_SIM_SIN_LINEA"
      },
      client
    );
    const refs = await client.query<{
      sim_dispositivo: string | null;
      sim_linea: string | null;
      sim_estado: string;
      lineas_dispositivo: string;
      eventos_sim: string;
      eventos_dispositivo: string;
    }>(
      `SELECT s.dispositivo_id::text AS sim_dispositivo,
              s.linea_movil_id::text AS sim_linea,
              e.codigo AS sim_estado,
              (SELECT COUNT(*)::text FROM itam.lineas_moviles l WHERE l.dispositivo_id=$2) AS lineas_dispositivo,
              (SELECT COUNT(*)::text FROM itam.historial_eventos h WHERE h.sim_id=s.id AND h.tipo_evento='ASOCIAR_SIM_GESTION_ATOMICA') AS eventos_sim,
              (SELECT COUNT(*)::text FROM itam.historial_eventos h WHERE h.dispositivo_id=$2 AND h.tipo_evento='GESTION_LINEA_SIM_ATOMICA') AS eventos_dispositivo
         FROM itam.sim s JOIN itam.estados e ON e.id=s.estado_id WHERE s.id=$1`,
      [fixture.targetSimId, fixture.deviceId]
    );

    assert.equal(result.linea, null);
    assert.equal(result.numeroNuevo, null);
    assert.equal(result.simActual?.codigoInventario, fixture.targetSimCode);
    assert.equal(refs.rows[0]!.sim_dispositivo, fixture.deviceId);
    assert.equal(refs.rows[0]!.sim_linea, null);
    assert.equal(refs.rows[0]!.sim_estado, "ASIGNADA");
    assert.equal(refs.rows[0]!.lineas_dispositivo, "0");
    assert.equal(refs.rows[0]!.eventos_sim, "1");
    assert.equal(refs.rows[0]!.eventos_dispositivo, "1");
  });
});

test("asociar SIM con línea existente conserva el número y vincula la línea al dispositivo", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    await removeDeviceLine(client, fixture);
    const number = "56994443322";
    const line = await client.query<{ id: string }>(
      `INSERT INTO itam.lineas_moviles(numero_telefonico, estado, sim_id)
       VALUES ($1, 'ACTIVA', $2) RETURNING id`,
      [number, fixture.targetSimId]
    );
    await client.query("UPDATE itam.sim SET linea_movil_id=$2 WHERE id=$1", [fixture.targetSimId, line.rows[0]!.id]);

    const result = await gestionarLineaSimEnTransaccion(
      fixture.deviceCode,
      {
        mantenerSim: false,
        mantenerNumero: true,
        simDestinoCodigo: fixture.targetSimCode,
        numeroNuevo: null,
        responsable: "TEST_SIM_CON_LINEA"
      },
      client
    );
    const refs = await client.query<{ id: string; numero: string; line_sim: string; line_device: string; sim_line: string; historia_activa: string }>(
      `SELECT l.id::text, l.numero_telefonico AS numero, l.sim_id::text AS line_sim,
              l.dispositivo_id::text AS line_device, s.linea_movil_id::text AS sim_line
              ,(SELECT COUNT(*)::text FROM itam.lineas_moviles_sim_historial h WHERE h.linea_movil_id=l.id AND h.sim_id=s.id AND h.fecha_fin IS NULL) AS historia_activa
         FROM itam.lineas_moviles l JOIN itam.sim s ON s.id=l.sim_id
        WHERE s.id=$1`,
      [fixture.targetSimId]
    );

    assert.equal(result.linea?.id, line.rows[0]!.id);
    assert.equal(result.linea?.numeroTelefonico, number);
    assert.equal(refs.rowCount, 1);
    assert.equal(refs.rows[0]!.id, line.rows[0]!.id);
    assert.equal(refs.rows[0]!.numero, number);
    assert.equal(refs.rows[0]!.line_sim, fixture.targetSimId);
    assert.equal(refs.rows[0]!.line_device, fixture.deviceId);
    assert.equal(refs.rows[0]!.sim_line, line.rows[0]!.id);
    assert.equal(refs.rows[0]!.historia_activa, "1");
  });
});

test("cambiar SIM + cambiar número se confirma como una sola operación", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const nextNumber = "56993334444";
    const result = await gestionarLineaSimEnTransaccion(
      fixture.deviceCode,
      {
        mantenerSim: false,
        mantenerNumero: false,
        simDestinoCodigo: fixture.targetSimCode,
        numeroNuevo: `+56 9 9333 4444`,
        responsable: "TEST"
      },
      client
    );
    const history = await client.query<{ total: string }>(
      `SELECT COUNT(*)::text AS total FROM itam.historial_eventos
        WHERE dispositivo_id=$1 AND tipo_evento='GESTION_LINEA_SIM_ATOMICA'`,
      [fixture.deviceId]
    );
    assert.equal(result.operacion, "CAMBIAR_SIM_CAMBIAR_NUMERO");
    assert.equal(result.linea?.numeroTelefonico, nextNumber);
    assert.equal(history.rows[0]!.total, "1");
  });
});

test("número duplicado rechaza antes de modificar la línea o la SIM", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    await client.query(
      `INSERT INTO itam.lineas_moviles(numero_telefonico, estado)
       VALUES ($1,'ACTIVA')`,
      ["56995556666"]
    );
    await assert.rejects(
      gestionarLineaSimEnTransaccion(
        fixture.deviceCode,
        {
          mantenerSim: true,
          mantenerNumero: false,
          simDestinoCodigo: null,
          numeroNuevo: "56995556666",
          responsable: "TEST"
        },
        client
      ),
      (error: unknown) => (error as { statusCode?: number }).statusCode === 409
    );
    const row = await client.query<{ numero: string; sim_id: string }>(
      "SELECT numero_telefonico AS numero, sim_id FROM itam.lineas_moviles WHERE id=$1",
      [fixture.lineId]
    );
    assert.equal(row.rows[0]!.numero, fixture.currentNumber);
    assert.equal(row.rows[0]!.sim_id, fixture.currentSimId);
  });
});

test("cambiar el número crea la línea oficial cuando el dispositivo conserva SIM pero no tiene línea", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    await client.query(
      `UPDATE itam.lineas_moviles SET dispositivo_id=NULL, colaborador_id=NULL, sim_id=NULL WHERE id=$1`,
      [fixture.lineId]
    );
    await client.query(
      `UPDATE itam.sim SET linea_movil_id=NULL, numero_asociado=NULL WHERE id=$1`,
      [fixture.currentSimId]
    );
    const nextNumber = "+56 9 1122 3344";
    const normalized = nextNumber.replace(/[^0-9]/g, '');

    const result = await gestionarLineaSimEnTransaccion(
      fixture.deviceCode,
      {
        mantenerSim: true,
        mantenerNumero: false,
        simDestinoCodigo: null,
        numeroNuevo: nextNumber,
        responsable: "TEST"
      },
      client
    );
    const refs = await client.query<{ device_id: string; sim_id: string; sim_line: string; sim_number: string }>(
      `SELECT l.dispositivo_id::text AS device_id, l.sim_id::text AS sim_id,
              s.linea_movil_id::text AS sim_line, s.numero_asociado AS sim_number
         FROM itam.lineas_moviles l JOIN itam.sim s ON s.id=$1 WHERE l.id=$2`,
      [fixture.currentSimId, result.linea!.id]
    );

    assert.equal(result.linea?.numeroTelefonico, normalized);
    assert.equal(refs.rows[0]?.device_id, fixture.deviceId);
    assert.equal(refs.rows[0]?.sim_id, fixture.currentSimId);
    assert.equal(refs.rows[0]?.sim_line, result.linea?.id);
    assert.equal(refs.rows[0]?.sim_number, normalized);

    const secondNumber = `569${String(30000000 + Date.now() % 100000000).slice(-8)}`;
    const secondResult = await gestionarLineaSimEnTransaccion(
      fixture.deviceCode,
      {
        mantenerSim: true,
        mantenerNumero: false,
        simDestinoCodigo: null,
        numeroNuevo: secondNumber,
        responsable: "TEST_NUMERO_LIBRE_ADICIONAL"
      },
      client
    );
    assert.equal(secondResult.linea?.id, result.linea?.id);
    assert.equal(secondResult.linea?.numeroTelefonico, secondNumber);
  });
});

test("rechaza el número si ya pertenece a otra SIM/equipo y conserva ambos vínculos", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const otherDeviceCode = fixture.deviceCode + 1;
    const otherDevice = await client.query<{ id: string }>(
      `INSERT INTO itam.dispositivos
         (codigo_inventario, tipo_dispositivo_id, tipo_dispositivo, estado_id, colaborador_id, valor_comercial)
       SELECT $1, tipo_dispositivo_id, tipo_dispositivo, estado_id, colaborador_id, 0
         FROM itam.dispositivos WHERE id=$2 RETURNING id`,
      [otherDeviceCode, fixture.deviceId]
    );
    const assignedState = await client.query<{ id: string }>(
      `SELECT id FROM itam.estados WHERE tipo_entidad='SIM' AND codigo='ASIGNADA' LIMIT 1`
    );
    assert.ok(otherDevice.rows[0]?.id && assignedState.rows[0]?.id);
    const number = `569${String(40000000 + Date.now() % 100000000).slice(-8)}`;
    const otherLine = await client.query<{ id: string }>(
      `INSERT INTO itam.lineas_moviles(numero_telefonico, estado, dispositivo_id, sim_id)
       VALUES ($1, 'ACTIVA', $2, $3) RETURNING id`,
      [number, otherDevice.rows[0]!.id, fixture.targetSimId]
    );
    await client.query(
      `UPDATE itam.sim SET estado_id=$2, dispositivo_id=$3, linea_movil_id=$4, numero_asociado=$5 WHERE id=$1`,
      [fixture.targetSimId, assignedState.rows[0]!.id, otherDevice.rows[0]!.id, otherLine.rows[0]!.id, number]
    );

    await assert.rejects(
      gestionarLineaSimEnTransaccion(
        fixture.deviceCode,
        {
          mantenerSim: true,
          mantenerNumero: false,
          simDestinoCodigo: null,
          numeroNuevo: number,
          responsable: "TEST_CONFLICTO_REAL"
        },
        client
      ),
      (error: unknown) => (error as { statusCode?: number }).statusCode === 409
    );
    const unchanged = await client.query<{ number: string; device_id: string; sim_id: string }>(
      `SELECT numero_telefonico AS number, dispositivo_id::text AS device_id, sim_id::text AS sim_id
         FROM itam.lineas_moviles WHERE id=$1`,
      [otherLine.rows[0]!.id]
    );
    assert.equal(unchanged.rows[0]?.number, number);
    assert.equal(unchanged.rows[0]?.device_id, otherDevice.rows[0]!.id);
    assert.equal(unchanged.rows[0]?.sim_id, fixture.targetSimId);
  });
});

test("búsqueda oficial devuelve contexto aunque la línea no tenga SIM", async () => {
  await withTransaction(async (client) => {
    const number = "56998887777";
    await client.query(
      `INSERT INTO itam.lineas_moviles(numero_telefonico, estado) VALUES ($1,'ACTIVA')`,
      [number]
    );
    const row = await obtenerLineaPorNumeroConContexto(number, client);
    assert.ok(row);
    assert.equal(row.numero_telefonico, number);
    assert.equal(row.sim_id, null);
    assert.equal(row.dispositivo_id, null);
  });
});

test("la búsqueda no marca libre una asociación legacy vigente de otra SIM", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const number = `569${String(20000000 + sequence).slice(-8)}`;
    await client.query(`UPDATE itam.sim SET numero_asociado=$2 WHERE id=$1`, [fixture.currentSimId, number]);

    await assert.rejects(
      buscarLineaMovilPorNumero(number, "999999999999", null, client),
      (error: unknown) => (error as { statusCode?: number }).statusCode === 409
    );
    assert.equal(
      await buscarLineaMovilPorNumero(`+56 9 ${number.slice(3, 7)} ${number.slice(7)}`, fixture.deviceId, fixture.currentSimId, client),
      null
    );
  });
});

test("registra una línea en una SIM disponible sin dispositivo ni colaborador", async () => {
  await withTransaction(async (client) => {
    const suffix = `${Date.now()}${sequence++}`.slice(-7);
    const simCode = 895000 + Number(suffix);
    const number = `569${String(10000000 + Number(suffix)).slice(-8)}`;
    const state = await client.query<{ id: string }>(
      "SELECT id FROM itam.estados WHERE tipo_entidad = 'SIM' AND codigo = 'DISPONIBLE' LIMIT 1"
    );
    assert.ok(state.rows[0]?.id);
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO itam.sim (codigo_inventario, iccid_codigo_fabrica, estado_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [simCode, `895603111111${suffix}`, state.rows[0]!.id]
    );
    const sim = await obtenerSimPorCodigo(simCode, client, true);
    assert.ok(sim);
    assert.equal(sim.dispositivo_id, null);
    assert.equal(sim.colaborador_id, null);

    const result = await vincularLineaMovilASim(
      number,
      sim,
      "TEST_SIM_SIN_DISPOSITIVO",
      null,
      client
    );
    const refs = await client.query<{
      line_device: string | null;
      line_collaborator: string | null;
      line_sim: string | null;
      sim_line: string | null;
      history_active: string;
    }>(
      `SELECT
         linea.dispositivo_id::text AS line_device,
         linea.colaborador_id::text AS line_collaborator,
         linea.sim_id::text AS line_sim,
         sim.linea_movil_id::text AS sim_line,
         (SELECT COUNT(*)::text FROM itam.lineas_moviles_sim_historial h
           WHERE h.linea_movil_id = linea.id AND h.sim_id = sim.id AND h.fecha_fin IS NULL) AS history_active
       FROM itam.lineas_moviles linea
       JOIN itam.sim sim ON sim.id = $1
      WHERE linea.id = $2`,
      [inserted.rows[0]!.id, result.linea.id]
    );

    assert.equal(result.linea.numero_telefonico, number);
    assert.equal(refs.rows[0]!.line_device, null);
    assert.equal(refs.rows[0]!.line_collaborator, null);
    assert.equal(refs.rows[0]!.line_sim, inserted.rows[0]!.id);
    assert.equal(refs.rows[0]!.sim_line, result.linea.id);
    assert.equal(refs.rows[0]!.history_active, "1");
  });
});

test("registrar SIM nueva y línea actual reemplaza ambos vínculos en una TX", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const result = await registrarSimNuevaEnTransaccion(fixture.deviceCode, {
      iccidCodigoFabrica: `895603888888${String(Date.now()).slice(-7)}`,
      compania: "Claro",
      accionLinea: "USAR_LINEA_EXISTENTE",
      lineaMovilId: Number(fixture.lineId),
      responsable: "TEST"
    }, client);
    const refs = await client.query<{ old_device: string | null; old_line: string | null; new_device: string | null; new_line: string | null; line_sim: string | null }>(
      `SELECT
        (SELECT dispositivo_id FROM itam.sim WHERE id=$1) AS old_device,
        (SELECT linea_movil_id FROM itam.sim WHERE id=$1) AS old_line,
        (SELECT dispositivo_id FROM itam.sim WHERE codigo_inventario=$2) AS new_device,
        (SELECT linea_movil_id FROM itam.sim WHERE codigo_inventario=$2) AS new_line,
        (SELECT sim_id FROM itam.lineas_moviles WHERE id=$3) AS line_sim`,
      [fixture.currentSimId, result.sim.codigoInventario, fixture.lineId]
    );
    assert.equal(result.sim.estado, "ASIGNADA");
    assert.equal(refs.rows[0]!.old_device, null);
    assert.equal(refs.rows[0]!.old_line, null);
    assert.equal(refs.rows[0]!.new_device, fixture.deviceId);
    assert.equal(refs.rows[0]!.new_line, fixture.lineId);
    assert.equal(refs.rows[0]!.line_sim, result.sim.id);
  });
});

test("registrar SIM nueva y número nuevo crea una sola línea", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const newNumber = "56997776666";
    const result = await registrarSimNuevaEnTransaccion(fixture.deviceCode, {
      iccidCodigoFabrica: `895603777777${String(Date.now()).slice(-7)}`,
      accionLinea: "CREAR_LINEA_NUEVA",
      numeroNuevo: newNumber,
      responsable: "TEST"
    }, client);
    const line = await client.query<{ total: string; sim_id: string | null; dispositivo_id: string | null }>(
      `SELECT COUNT(*)::text AS total, MAX(sim_id)::text AS sim_id, MAX(dispositivo_id)::text AS dispositivo_id
         FROM itam.lineas_moviles WHERE numero_telefonico=$1`,
      [newNumber]
    );
    assert.equal(line.rows[0]!.total, "1");
    assert.equal(line.rows[0]!.sim_id, result.sim.id);
    assert.equal(line.rows[0]!.dispositivo_id, fixture.deviceId);
  });
});

test("registrar SIM nueva sin línea no crea una línea vacía", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const result = await registrarSimNuevaEnTransaccion(fixture.deviceCode, {
      iccidCodigoFabrica: `895603666666${String(Date.now()).slice(-7)}`,
      accionLinea: "SIN_LINEA",
      responsable: "TEST"
    }, client);
    const row = await client.query<{ line: string | null; total: string }>(
      `SELECT (SELECT linea_movil_id::text FROM itam.sim WHERE id=$1) AS line,
              (SELECT COUNT(*)::text FROM itam.lineas_moviles WHERE dispositivo_id=$2) AS total`,
      [result.sim.id, fixture.deviceId]
    );
    assert.equal(row.rows[0]!.line, null);
    assert.equal(row.rows[0]!.total, "0");
  });
});

test("ICCID duplicado revierte también la línea nueva creada en la misma operación", async () => {
  await withTransaction(async (client) => {
    const fixture = await createFixture(client);
    const before = await client.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM itam.lineas_moviles");
    await client.query("SAVEPOINT registrar_sim_rollback");
    await assert.rejects(
      registrarSimNuevaEnTransaccion(fixture.deviceCode, {
        iccidCodigoFabrica: fixture.currentIccid,
        accionLinea: "CREAR_LINEA_NUEVA",
        numeroNuevo: "56996665555",
        responsable: "TEST"
      }, client),
      (error: unknown) => (error as { statusCode?: number }).statusCode === 409
    );
    await client.query("ROLLBACK TO SAVEPOINT registrar_sim_rollback");
    const after = await client.query<{ total: string }>("SELECT COUNT(*)::text AS total FROM itam.lineas_moviles");
    assert.equal(after.rows[0]!.total, before.rows[0]!.total);
  });
});
