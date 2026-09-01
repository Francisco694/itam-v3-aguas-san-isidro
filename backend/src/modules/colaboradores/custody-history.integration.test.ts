import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "../../config/database";
import {
  listarActivosActualesColaborador,
  listarEvidenciasPendientesColaborador,
  listarHistorialActivosColaborador
} from "./colaboradores.repository";

after(async () => { await pool.end(); });

test("024/025 separan custodia actual, historial y evidencia pendiente", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const collaborator = await client.query<{ id: string }>(
      "SELECT id FROM itam.colaboradores ORDER BY id LIMIT 1"
    );
    const catalog = await client.query<{ type_id: string; state_id: string }>(
      `SELECT t.id type_id,e.id state_id FROM itam.tipos_dispositivo t
       CROSS JOIN itam.estados e
       WHERE t.activo=TRUE AND e.tipo_entidad='DISPOSITIVO' AND e.codigo='ASIGNADO'
       ORDER BY t.id LIMIT 1`
    );
    assert.ok(collaborator.rows[0] && catalog.rows[0]);
    const collaboratorId = collaborator.rows[0]!.id;
    const code = 900000000 + Math.floor(Math.random() * 90000000);
    const device = await client.query<{ id: string }>(
      `INSERT INTO itam.dispositivos(codigo_inventario,tipo_dispositivo_id,estado_id,observaciones)
       VALUES($1,$2,$3,'TEST CUSTODIA 024') RETURNING id`,
      [code,catalog.rows[0]!.type_id,catalog.rows[0]!.state_id]
    );
    const deviceId = device.rows[0]!.id;
    const closed = async (start:string,end:string,type:string,reference:string) => client.query(
      `INSERT INTO itam.custodias_dispositivo(
         dispositivo_id,colaborador_id,fecha_inicio,fecha_fin,vigente,tipo_inicio,
         tipo_cierre,fecha_cierre_real_conocida,origen,referencia_origen,
         evidencia,nivel_confianza,cerrado_en
       ) VALUES($1,$2,$3,$4,FALSE,'RECONSTRUCCION_HISTORICA',$5,TRUE,
                'TEST',$6,'{}','ALTA',NOW())`,
      [deviceId,collaboratorId,start,end,type,reference]
    );
    await closed("2090-01-01T10:00:00Z","2090-01-02T10:00:00Z","DEVOLUCION","TEST:1");
    await closed("2090-02-01T10:00:00Z","2090-02-02T10:00:00Z","CONCILIACION_HISTORICA","TEST:2");
    await closed("2090-03-01T10:00:00Z","2090-03-02T10:00:00Z","BAJA","TEST:3");
    await client.query(
      `INSERT INTO itam.custodias_dispositivo(
         dispositivo_id,colaborador_id,fecha_inicio,vigente,tipo_inicio,origen,
         referencia_origen,evidencia,nivel_confianza)
       VALUES($1,$2,'2090-04-01T10:00:00Z',TRUE,'ASIGNACION','TEST','TEST:4','{}','ALTA')`,
      [deviceId,collaboratorId]
    );
    await client.query(
      `INSERT INTO itam.evidencias_inventario_historico(
         clave_origen,fuente,hoja,fila_origen,colaborador_id,tipo_activo,
         estado_conciliacion,nivel_confianza,datos_origen)
       VALUES('TEST:EVIDENCE:1','TEST','TEST',1,$1,'SMARTPHONE',
              'PENDIENTE_IDENTIFICAR_ACTIVO','BAJA','{}')`,
      [collaboratorId]
    );

    const current = await listarActivosActualesColaborador(Number(collaboratorId),client);
    const history = (await listarHistorialActivosColaborador(Number(collaboratorId),client))
      .filter((row) => new Date(row.fecha_asignacion).getUTCFullYear() === 2090);
    const pending = await listarEvidenciasPendientesColaborador(Number(collaboratorId),client);
    assert.equal(current.filter((row) => row.dispositivo_id === deviceId).length,1);
    assert.deepEqual(history.map((row) => row.resultado),["DADO_BAJA","CONCILIADO","DEVUELTO"]);
    assert.ok(pending.some((row) => row.estado_conciliacion === "PENDIENTE_IDENTIFICAR_ACTIVO"));
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});