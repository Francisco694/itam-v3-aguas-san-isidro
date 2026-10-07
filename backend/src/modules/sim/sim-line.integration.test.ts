import assert from "node:assert/strict";
import test from "node:test";
import { pool } from "../../config/database";
import { obtenerSimPorCodigo } from "./sim.repository";
import { vincularLineaMovil } from "../lineas-moviles/lineas-moviles.service";

test("fase SIM: reasociar y cambiar número usa la misma línea y revierte al hacer rollback", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query<{
      linea_id: string;
      sim_id: string;
      codigo_sim: number;
      numero: string;
    }>(
      `SELECT l.id AS linea_id, s.id AS sim_id, s.codigo_inventario AS codigo_sim,
              l.numero_telefonico AS numero
         FROM itam.lineas_moviles l
         JOIN itam.sim s ON s.id = l.sim_id
        ORDER BY l.id
        LIMIT 1`
    );
    assert.ok(current.rows[0], "la base de desarrollo debe tener una asociación SIM-línea");
    const row = current.rows[0]!;
    const sim = await obtenerSimPorCodigo(row.codigo_sim, client, true);
    assert.ok(sim);

    const resultado = await vincularLineaMovil(
      {
        numeroTelefonico: "56912345678",
        sim,
        dispositivoId: sim.dispositivo_id,
        dispositivoCodigoInventario: sim.dispositivo_codigo_inventario ?? undefined,
        colaboradorId: sim.colaborador_id,
        responsable: "TEST_ROLLBACK",
        observaciones: "Prueba transaccional"
      },
      client
    );
    assert.equal(resultado.linea.id, row.linea_id);
    assert.equal(resultado.linea.numero_telefonico, "56912345678");

    const history = await client.query<{ total: string }>(
      `SELECT COUNT(*) AS total
         FROM itam.lineas_moviles_sim_historial
        WHERE linea_movil_id = $1 AND sim_id = $2 AND fecha_fin IS NULL`,
      [row.linea_id, row.sim_id]
    );
    assert.equal(history.rows[0]?.total, "1");
    await client.query("ROLLBACK");

    const restored = await pool.query<{ numero: string }>(
      "SELECT numero_telefonico AS numero FROM itam.lineas_moviles WHERE id = $1",
      [row.linea_id]
    );
    assert.equal(restored.rows[0]?.numero, row.numero);
  } finally {
    client.release();
  }
});

test.after(() => pool.end());
