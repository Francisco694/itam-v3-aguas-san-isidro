import assert from "node:assert/strict";
import test, { after } from "node:test";
import { pool } from "../../config/database";
import { listarHistorialActivosColaborador } from "./colaboradores.repository";

after(async () => { await pool.end(); });

test("P1-02: reconstruye multiples ciclos y formatos historicos de colaborador", async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const collaborator = await client.query<{ id: string }>(
      "SELECT id FROM itam.colaboradores ORDER BY id LIMIT 1"
    );
    const device = await client.query<{ id: string }>(
      "SELECT id FROM itam.dispositivos ORDER BY id LIMIT 1"
    );
    const assigned = await client.query<{ id: string }>(
      "SELECT id FROM itam.estados WHERE tipo_entidad='DISPOSITIVO' AND codigo='ASIGNADO'"
    );
    assert.ok(collaborator.rows[0] && device.rows[0] && assigned.rows[0]);
    const collaboratorId = collaborator.rows[0]!.id;
    const deviceId = device.rows[0]!.id;
    await client.query(
      `UPDATE itam.dispositivos SET colaborador_id=$2,departamento_id=NULL,
         recibido_por_id=NULL,estado_id=$3 WHERE id=$1`,
      [deviceId,collaboratorId,assigned.rows[0]!.id]
    );
    const event = async (type:string,date:string,detail:Record<string,unknown>) =>
      client.query(`INSERT INTO itam.historial_eventos(
        tipo_entidad,dispositivo_id,tipo_evento,responsable,detalle,fecha_evento)
        VALUES('DISPOSITIVO',$1,$2,'TEST P1-02',$3::jsonb,$4::timestamptz)`,
        [deviceId,type,JSON.stringify(detail),date]);

    await event("ASIGNAR_COLABORADOR","2090-01-01T10:00:00Z",{collaboratorId});
    await event("DEVOLVER_DISPOSITIVO","2090-01-02T10:00:00Z",{});
    await event("ASIGNAR_COLABORADOR","2090-02-01T10:00:00Z",{colaboradorId:collaboratorId});
    await event("CIERRE_CUSTODIA_CONCILIACION","2090-02-02T10:00:00Z",{motivo:"CONCILIACION"});
    await event("ASIGNAR_COLABORADOR","2090-03-01T10:00:00Z",{custodiaNueva:{id:collaboratorId}});
    await event("DAR_BAJA","2090-03-02T10:00:00Z",{motivo:"OBSOLESCENCIA"});
    await event("ASIGNAR_COLABORADOR","2090-04-01T10:00:00Z",{custodiaNueva:{id:collaboratorId}});

    const history = (await listarHistorialActivosColaborador(Number(collaboratorId),client))
      .filter(row => new Date(row.fecha_asignacion).getUTCFullYear() === 2090);
    assert.equal(history.length,4);
    assert.deepEqual(history.map(row => row.resultado),[
      "ASIGNADO","DADO_BAJA","CONCILIADO","DEVUELTO"
    ]);
    assert.deepEqual(history.map(row => row.tipo_cierre),[
      null,"DAR_BAJA","CIERRE_CUSTODIA_CONCILIACION","DEVOLVER_DISPOSITIVO"
    ]);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
});
