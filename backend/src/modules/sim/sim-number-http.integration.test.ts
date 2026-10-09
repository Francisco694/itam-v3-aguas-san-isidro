import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import express from 'express';
import type { PoolClient } from 'pg';
import { pool } from '../../config/database';
import { errorHandler } from '../../shared/error.middleware';
import simRoutes from './sim.routes';

after(() => pool.end());

// Real router/controller/service/SQL. An outer transaction isolates fixtures;
// service BEGIN/COMMIT/ROLLBACK map to a savepoint on the same connection.
async function scenario(run: (client: PoolClient, url: string) => Promise<void>, failure?: 'history' | 'zero-rows') {
  const client = await pool.connect();
  await client.query('BEGIN');
  let linked = false;
  let transactionActive = false;
  const txClient = {
    query: (sql: string, values?: unknown[]) => {
      if (sql === 'BEGIN') { transactionActive = true; return client.query('SAVEPOINT sim_http_operation'); }
      if (sql === 'COMMIT') { transactionActive = false; return client.query('RELEASE SAVEPOINT sim_http_operation'); }
      if (sql === 'ROLLBACK') { transactionActive = false; return client.query('ROLLBACK TO SAVEPOINT sim_http_operation'); }
      if (sql.includes('UPDATE itam.lineas_moviles SET sim_id')) linked = true;
      if (failure === 'history' && linked && sql.includes('INSERT INTO itam.historial_eventos')) {
        return Promise.reject(new Error('Injected history failure'));
      }
      if (failure === 'zero-rows' && sql.includes('SET linea_movil_id = $2, numero_asociado = $3')) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return client.query(sql, values);
    },
    release: () => undefined
  };
  const { mock } = await import('node:test');
  const connect = mock.method(pool, 'connect', async () => txClient);
  const query = mock.method(pool, 'query', (sql: string, values?: unknown[]) => {
    assert.equal(transactionActive, false, 'Ninguna query de la operación puede escapar al pool global');
    return client.query(sql, values);
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/sim', simRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const port = (server.address() as { port: number }).port;
  try { await run(client, `http://127.0.0.1:${port}/api/v1/sim`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    connect.mock.restore(); query.mock.restore();
    await client.query('ROLLBACK');
    client.release();
  }
}

async function fixture(client: PoolClient) {
  const row = (await client.query<{ id: string; codigo_inventario: number }>(
    `INSERT INTO itam.sim(codigo_inventario, estado_id)
     SELECT (SELECT MAX(codigo_inventario)+1 FROM itam.sim), id
     FROM itam.estados WHERE tipo_entidad='SIM' AND codigo='DISPONIBLE' RETURNING id, codigo_inventario`
  )).rows[0]!;
  const phone = (await client.query<{ numero: string }>(
    `SELECT ('569' || LPAD(n::text,8,'0')) AS numero FROM generate_series(10000000,10001000) n
     WHERE NOT EXISTS (SELECT 1 FROM itam.lineas_moviles WHERE numero_telefonico='569' || LPAD(n::text,8,'0')) LIMIT 1`
  )).rows[0]!.numero;
  return { ...row, phone };
}

async function patch(url: string, code: number, phone: string) {
  const response = await fetch(`${url}/${code}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ numeroAsociado: phone }) });
  return { status: response.status, body: await response.json() as any };
}

test('PATCH crea línea sin equipo/custodio, sincroniza IDs internos, historial y GET oficial', () => scenario(async (client, url) => {
  const sim = await fixture(client);
  const response = await patch(url, sim.codigo_inventario, sim.phone);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.lineaMovil.numeroTelefonico, sim.phone);
  const row = (await client.query(`SELECT s.linea_movil_id, l.id, l.sim_id, l.dispositivo_id, l.colaborador_id
    FROM itam.sim s JOIN itam.lineas_moviles l ON l.id=s.linea_movil_id WHERE s.id=$1`, [sim.id])).rows[0];
  assert.equal(row.sim_id, sim.id);
  assert.equal(row.linea_movil_id, row.id);
  assert.equal(row.dispositivo_id, null);
  assert.equal(row.colaborador_id, null);
  const history = await client.query(`SELECT * FROM itam.lineas_moviles_sim_historial WHERE sim_id=$1 AND fecha_fin IS NULL`, [sim.id]);
  assert.equal(history.rowCount, 1);
  assert.equal((await client.query(`SELECT 1 FROM itam.historial_eventos WHERE sim_id=$1 AND tipo_evento='NUMERO_TELEFONICO_REGISTRADO'`, [sim.id])).rowCount, 1);
  const detail = await (await fetch(`${url}/${sim.codigo_inventario}`)).json() as any;
  assert.equal(detail.data.lineaMovil.numeroTelefonico, sim.phone);
  assert.equal(detail.data.dispositivo, null);
  assert.equal(detail.data.colaborador, null);
}));

test('PATCH reutiliza línea existente libre sin duplicarla', () => scenario(async (client, url) => {
  const sim = await fixture(client);
  const line = (await client.query(`INSERT INTO itam.lineas_moviles(numero_telefonico) VALUES($1) RETURNING id`, [sim.phone])).rows[0];
  const response = await patch(url, sim.codigo_inventario, sim.phone);
  assert.equal(response.status, 200, JSON.stringify(response.body));
  assert.equal(response.body.data.lineaMovil.id, line.id);
  assert.equal((await client.query('SELECT 1 FROM itam.lineas_moviles WHERE numero_telefonico=$1', [sim.phone])).rowCount, 1);
}));

test('PATCH línea ocupada responde 409 e identifica SIM sin alterar vínculos', () => scenario(async (client, url) => {
  const first = await fixture(client);
  assert.equal((await patch(url, first.codigo_inventario, first.phone)).status, 200);
  const second = await fixture(client);
  const response = await patch(url, second.codigo_inventario, first.phone);
  assert.equal(response.status, 409);
  assert.match(response.body.error.message, new RegExp(`ITAM ${first.codigo_inventario}`));
  assert.equal((await client.query('SELECT sim_id FROM itam.lineas_moviles WHERE numero_telefonico=$1', [first.phone])).rows[0].sim_id, first.id);
  assert.equal((await client.query('SELECT linea_movil_id FROM itam.sim WHERE id=$1', [second.id])).rows[0].linea_movil_id, null);
}));

test('fallo de historial posterior al vínculo revierte creación y ambas referencias', () => scenario(async (client, url) => {
  const sim = await fixture(client);
  assert.equal((await patch(url, sim.codigo_inventario, sim.phone)).status, 500);
  assert.equal((await client.query('SELECT 1 FROM itam.lineas_moviles WHERE numero_telefonico=$1', [sim.phone])).rowCount, 0);
  assert.equal((await client.query('SELECT linea_movil_id FROM itam.sim WHERE id=$1', [sim.id])).rows[0].linea_movil_id, null);
  assert.equal((await client.query('SELECT 1 FROM itam.lineas_moviles_sim_historial WHERE sim_id=$1', [sim.id])).rowCount, 0);
}, 'history'));

test('UPDATE de cero filas responde 500 y revierte línea y vínculo parcial', () => scenario(async (client, url) => {
  const sim = await fixture(client);
  const response = await patch(url, sim.codigo_inventario, sim.phone);
  assert.equal(response.status, 500);
  assert.equal(response.body.error.code, 'SIM_LINE_SAVE_UNCONFIRMED');
  assert.equal((await client.query('SELECT 1 FROM itam.lineas_moviles WHERE numero_telefonico=$1', [sim.phone])).rowCount, 0);
  assert.equal((await client.query('SELECT linea_movil_id FROM itam.sim WHERE id=$1', [sim.id])).rows[0].linea_movil_id, null);
}, 'zero-rows'));
