import type { PoolClient } from "pg";
import { currentUserId } from "../../shared/auth-context";
import type { EstadoLineaMovil, LineaMovilRow } from "./lineas-moviles.types";

export const obtenerLineaPorNumero = async (
  numeroTelefonico: string,
  client: PoolClient,
  forUpdate = false
): Promise<LineaMovilRow | null> => {
  const result = await client.query<LineaMovilRow>(
    `SELECT * FROM itam.lineas_moviles
      WHERE REGEXP_REPLACE(numero_telefonico, '[^0-9]', '', 'g') = $1
      LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [numeroTelefonico]
  );
  return result.rows[0] ?? null;
};

export const obtenerLineaPorSim = async (
  simId: string,
  client: PoolClient,
  forUpdate = false
): Promise<LineaMovilRow | null> => {
  const result = await client.query<LineaMovilRow>(
    `SELECT linea.* FROM itam.lineas_moviles linea
      WHERE linea.sim_id = $1
         OR linea.id = (SELECT sim.linea_movil_id FROM itam.sim sim WHERE sim.id = $1)
      ORDER BY CASE WHEN linea.sim_id = $1 THEN 0 ELSE 1 END
      LIMIT 1 ${forUpdate ? "FOR UPDATE OF linea" : ""}`,
    [simId]
  );
  return result.rows[0] ?? null;
};

export const obtenerLineaPorDispositivo = async (
  dispositivoId: string,
  client: PoolClient,
  forUpdate = false
): Promise<LineaMovilRow | null> => {
  const result = await client.query<LineaMovilRow>(
    `SELECT * FROM itam.lineas_moviles
      WHERE dispositivo_id = $1
      ORDER BY
        CASE estado WHEN 'ACTIVA' THEN 0 ELSE 1 END,
        actualizado_en DESC,
        id DESC
      LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [dispositivoId]
  );
  return result.rows[0] ?? null;
};

export const crearLineaMovil = async (
  numeroTelefonico: string,
  colaboradorId: string | null,
  dispositivoId: string | null,
  simId: string | null,
  client: PoolClient
): Promise<LineaMovilRow> => {
  const result = await client.query<LineaMovilRow>(
    `INSERT INTO itam.lineas_moviles
       (numero_telefonico, estado, colaborador_id, dispositivo_id, sim_id, creado_en, actualizado_en)
     VALUES ($1, 'ACTIVA', $2, $3, $4, NOW(), NOW()) RETURNING *`,
    [numeroTelefonico, colaboradorId, dispositivoId, simId]
  );
  return result.rows[0]!;
};

export const asociarLineaMovil = async (
  lineaId: string,
  numeroTelefonico: string,
  colaboradorId: string | null,
  dispositivoId: string | null,
  simId: string | null,
  client: PoolClient
): Promise<LineaMovilRow> => {
  const result = await client.query<LineaMovilRow>(
    `UPDATE itam.lineas_moviles
        SET numero_telefonico=$2, estado='ACTIVA', colaborador_id=$3,
            dispositivo_id=$4, sim_id=$5, actualizado_en=NOW()
      WHERE id=$1 RETURNING *`,
    [lineaId, numeroTelefonico, colaboradorId, dispositivoId, simId]
  );
  return result.rows[0]!;
};

export const guardarLineaMovilDeDispositivo = async (
  numeroTelefonico: string,
  dispositivoId: string,
  colaboradorId: string | null,
  client: PoolClient,
  lineaIdExistente?: string,
  simId: string | null = null
): Promise<{ linea: LineaMovilRow | null; operacion: "INSERT" | "UPDATE" }> => {
  const existente = await client.query<{ id: string }>(
    `SELECT id
       FROM itam.lineas_moviles
      WHERE dispositivo_id = $1
      ORDER BY actualizado_en DESC, id DESC
      LIMIT 1
      FOR UPDATE`,
    [dispositivoId]
  );
  const lineaId = existente.rows[0]?.id ?? lineaIdExistente;
  const observaciones = "Línea móvil registrada desde ficha de dispositivo";

  if (lineaId) {
    const actualizada = await client.query<LineaMovilRow>(
      `UPDATE itam.lineas_moviles
          SET numero_telefonico = $2,
              estado = 'ACTIVA',
              sim_id = $6,
              colaborador_id = $3,
              observaciones = $4,
              dispositivo_id = $5,
              actualizado_en = NOW()
        WHERE id = $1
        RETURNING *`,
      [lineaId, numeroTelefonico, colaboradorId, observaciones, dispositivoId, simId]
    );
    return { linea: actualizada.rows[0] ?? null, operacion: "UPDATE" };
  }

  const creada = await client.query<LineaMovilRow>(
    `INSERT INTO itam.lineas_moviles (
        numero_telefonico,
        estado,
        dispositivo_id,
        sim_id,
        colaborador_id,
        observaciones,
        creado_en,
        actualizado_en
      )
      VALUES (
        $1,
        'ACTIVA',
        $2,
        $5,
        $3,
        $4,
        NOW(),
        NOW()
      )
      RETURNING *`,
    [numeroTelefonico, dispositivoId, colaboradorId, observaciones, simId]
  );
  return { linea: creada.rows[0] ?? null, operacion: "INSERT" };
};

export const actualizarNumeroLineaMovil = async (
  lineaId: string,
  numeroTelefonico: string,
  client: PoolClient
): Promise<LineaMovilRow> => {
  const result = await client.query<LineaMovilRow>(
    `UPDATE itam.lineas_moviles
        SET numero_telefonico=$2, actualizado_en=NOW()
      WHERE id=$1 RETURNING *`,
    [lineaId, numeroTelefonico]
  );
  return result.rows[0]!;
};

export const vincularLineaEnSim = async (
  simId: string,
  lineaId: string | null,
  numeroTelefonico: string | null,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `UPDATE itam.sim SET linea_movil_id=$2,
       numero_asociado=COALESCE($3,numero_asociado) WHERE id=$1`,
    [simId, lineaId, numeroTelefonico]
  );
};

export const liberarLineaDeSimAnterior = async (
  simId: string,
  client: PoolClient
): Promise<void> => {
  await client.query("UPDATE itam.sim SET linea_movil_id=NULL WHERE id=$1", [simId]);
};

export const liberarLineaActualDeSim = async (
  lineaId: string,
  client: PoolClient
): Promise<LineaMovilRow> => {
  const result = await client.query<LineaMovilRow>(
    `UPDATE itam.lineas_moviles
        SET estado='PENDIENTE_REPOSICION', dispositivo_id=NULL, sim_id=NULL,
            actualizado_en=NOW()
      WHERE id=$1 RETURNING *`,
    [lineaId]
  );
  return result.rows[0]!;
};

export const actualizarLineaPorExtravio = async (
  lineaId: string,
  estado: EstadoLineaMovil,
  client: PoolClient
): Promise<LineaMovilRow> => {
  const result = await client.query<LineaMovilRow>(
    `UPDATE itam.lineas_moviles SET estado=$2, dispositivo_id=NULL,
       sim_id=NULL,
       colaborador_id=CASE WHEN $2='DADA_BAJA' THEN NULL ELSE colaborador_id END,
       actualizado_en=NOW()
     WHERE id=$1 RETURNING *`,
    [lineaId, estado]
  );
  return result.rows[0]!;
};

export const actualizarVinculosLinea = async (
  lineaId: string,
  dispositivoId: string | null,
  colaboradorId: string | null,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `UPDATE itam.lineas_moviles
        SET dispositivo_id=$2, colaborador_id=$3, actualizado_en=NOW()
      WHERE id=$1`,
    [lineaId, dispositivoId, colaboradorId]
  );
};

export const desvincularSimPorExtravio = async (
  simId: string,
  estadoId: string,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `UPDATE itam.sim SET estado_id=$2, dispositivo_id=NULL,
       colaborador_id=NULL, linea_movil_id=NULL WHERE id=$1`,
    [simId, estadoId]
  );
};

export const insertarHistorialLineaMovil = async (
  lineaId: string,
  tipoEvento: string,
  responsable: string,
  observaciones: string | null | undefined,
  detalle: Record<string, unknown>,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `INSERT INTO itam.historial_eventos
       (tipo_entidad,linea_movil_id,tipo_evento,responsable,observaciones,detalle,usuario_ejecutor_id)
     VALUES ('LINEA_MOVIL',$1,$2,$3,$4,$5::jsonb,$6)`,
    [lineaId, tipoEvento, responsable, observaciones ?? null, JSON.stringify(detalle), currentUserId()]
  );
};
