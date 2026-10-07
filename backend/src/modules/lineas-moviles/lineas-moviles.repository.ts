import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { currentUserId } from "../../shared/auth-context";
import type {
  EstadoLineaMovil,
  LineaMovilRow,
  LineaMovilSimHistorialRow,
  LineaMovilLookupRow
} from "./lineas-moviles.types";

export const obtenerLineaPorId = async (
  lineaId: string,
  client: PoolClient,
  forUpdate = false
): Promise<LineaMovilRow | null> => {
  const result = await client.query<LineaMovilRow>(
    `SELECT * FROM itam.lineas_moviles WHERE id = $1 LIMIT 1 ${forUpdate ? "FOR UPDATE" : ""}`,
    [lineaId]
  );
  return result.rows[0] ?? null;
};

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

export const obtenerLineaPorNumeroConContexto = async (
  numeroTelefonico: string,
  client?: PoolClient
): Promise<LineaMovilLookupRow | null> => {
  const result = await (client ?? pool).query<LineaMovilLookupRow>(
    `SELECT
       l.id AS linea_id,
       l.numero_telefonico,
       l.estado AS linea_estado,
       contexto_sim.id AS sim_id,
       contexto_sim.codigo_inventario AS sim_codigo_inventario,
       contexto_sim.iccid_codigo_fabrica AS sim_iccid,
       contexto_sim.compania AS sim_compania,
       sim_estado.codigo AS sim_estado_codigo,
       sim_estado.nombre AS sim_estado_nombre,
       d.id AS dispositivo_id,
       d.codigo_inventario AS dispositivo_codigo_inventario,
       tipo.nombre AS dispositivo_tipo,
       c.id AS colaborador_id,
       c.nombre AS colaborador_nombre,
       dep.id AS departamento_id,
       dep.nombre AS departamento_nombre
     FROM itam.lineas_moviles l
     LEFT JOIN LATERAL (
       SELECT s.*
       FROM itam.sim s
       WHERE s.id = l.sim_id OR s.linea_movil_id = l.id
       ORDER BY CASE WHEN s.id = l.sim_id THEN 0 ELSE 1 END, s.id
       LIMIT 1
     ) contexto_sim ON TRUE
     LEFT JOIN itam.estados sim_estado ON sim_estado.id = contexto_sim.estado_id
     LEFT JOIN itam.dispositivos d ON d.id = l.dispositivo_id
     LEFT JOIN itam.tipos_dispositivo tipo ON tipo.id = d.tipo_dispositivo_id
     LEFT JOIN itam.colaboradores c ON c.id = l.colaborador_id
     LEFT JOIN itam.departamentos dep ON dep.id = d.departamento_id
     WHERE REGEXP_REPLACE(l.numero_telefonico, '[^0-9]', '', 'g') = $1
     ORDER BY CASE WHEN l.estado = 'ACTIVA' THEN 0 ELSE 1 END, l.actualizado_en DESC, l.id DESC
     LIMIT 1`,
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
     (numero_telefonico, estado, colaborador_id, dispositivo_id, creado_en, actualizado_en)
     VALUES ($1, 'ACTIVA', $2, $3, NOW(), NOW()) RETURNING *`,
    [numeroTelefonico, colaboradorId, dispositivoId]
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
            dispositivo_id=$4, actualizado_en=NOW()
      WHERE id=$1 RETURNING *`,
    [lineaId, numeroTelefonico, colaboradorId, dispositivoId]
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
              colaborador_id = $3,
              observaciones = $4,
              dispositivo_id = $5,
              actualizado_en = NOW()
        WHERE id = $1
        RETURNING *`,
      [lineaId, numeroTelefonico, colaboradorId, observaciones, dispositivoId]
    );
    return { linea: actualizada.rows[0] ?? null, operacion: "UPDATE" };
  }

  const creada = await client.query<LineaMovilRow>(
    `INSERT INTO itam.lineas_moviles (
        numero_telefonico,
        estado,
        dispositivo_id,
        colaborador_id,
        observaciones,
        creado_en,
        actualizado_en
      )
      VALUES (
        $1,
        'ACTIVA',
        $2,
        $3,
        $4,
        NOW(),
        NOW()
      )
      RETURNING *`,
    [numeroTelefonico, dispositivoId, colaboradorId, observaciones]
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

/**
 * Sincroniza las referencias actuales y registra la relación temporal.
 * Debe llamarse dentro de la transacción de la operación de negocio.
 */
export const sincronizarVinculoLineaSim = async (
  lineaId: string,
  simId: string | null,
  motivo: string,
  client: PoolClient,
  simAnteriorId: string | null = null
): Promise<void> => {
  const linea = await obtenerLineaPorId(lineaId, client, true);
  if (!linea) return;

  const simAnterior = simAnteriorId && simAnteriorId !== simId
    ? simAnteriorId
    : (linea.sim_id && linea.sim_id !== simId ? linea.sim_id : null);
  const simObjetivo = simId
    ? await client.query<{ id: string; linea_movil_id: string | null }>(
        `SELECT id, linea_movil_id FROM itam.sim WHERE id = $1 FOR UPDATE`,
        [simId]
      )
    : null;

  if (simAnterior) {
    await client.query(
      `UPDATE itam.sim
          SET linea_movil_id = NULL, numero_asociado = NULL
        WHERE id = $1 AND linea_movil_id = $2`,
      [simAnterior, lineaId]
    );
    await client.query(
      `UPDATE itam.lineas_moviles_sim_historial
          SET fecha_fin = COALESCE(fecha_fin, NOW())
        WHERE linea_movil_id = $1 AND sim_id = $2 AND fecha_fin IS NULL`,
      [lineaId, simAnterior]
    );
  }

  const lineaAnteriorDelObjetivo = simObjetivo?.rows[0]?.linea_movil_id;
  if (simId && lineaAnteriorDelObjetivo && lineaAnteriorDelObjetivo !== lineaId) {
    await client.query(
      `UPDATE itam.lineas_moviles
          SET sim_id = NULL, actualizado_en = NOW()
        WHERE id = $1 AND sim_id = $2`,
      [lineaAnteriorDelObjetivo, simId]
    );
    await client.query(
      `UPDATE itam.lineas_moviles_sim_historial
          SET fecha_fin = COALESCE(fecha_fin, NOW())
        WHERE linea_movil_id = $1 AND sim_id = $2 AND fecha_fin IS NULL`,
      [lineaAnteriorDelObjetivo, simId]
    );
  }

  if (!simId) {
    await client.query(
      `UPDATE itam.lineas_moviles SET sim_id = NULL, actualizado_en = NOW() WHERE id = $1`,
      [lineaId]
    );
    return;
  }

  await client.query(
    `UPDATE itam.lineas_moviles SET sim_id = $2, actualizado_en = NOW() WHERE id = $1`,
    [lineaId, simId]
  );
  await client.query(
    `UPDATE itam.sim
        SET linea_movil_id = $2, numero_asociado = $3
      WHERE id = $1`,
    [simId, lineaId, linea.numero_telefonico]
  );
  await client.query(
    `INSERT INTO itam.lineas_moviles_sim_historial
       (linea_movil_id, sim_id, motivo, usuario_id)
     SELECT $1, $2, $3, $4
     WHERE NOT EXISTS (
       SELECT 1 FROM itam.lineas_moviles_sim_historial
        WHERE linea_movil_id = $1 AND sim_id = $2 AND fecha_fin IS NULL
     )`,
    [lineaId, simId, motivo, currentUserId()]
  );
};

export const desasociarVinculoLineaSim = async (
  lineaId: string,
  simId: string,
  client: PoolClient
): Promise<void> => {
  await obtenerLineaPorId(lineaId, client, true);
  await client.query(
    `UPDATE itam.lineas_moviles SET sim_id = NULL, actualizado_en = NOW() WHERE id = $1 AND sim_id = $2`,
    [lineaId, simId]
  );
  await client.query(
    `UPDATE itam.sim SET linea_movil_id = NULL, numero_asociado = NULL WHERE id = $1 AND linea_movil_id = $2`,
    [simId, lineaId]
  );
  await client.query(
    `UPDATE itam.lineas_moviles_sim_historial
        SET fecha_fin = COALESCE(fecha_fin, NOW())
      WHERE linea_movil_id = $1 AND sim_id = $2 AND fecha_fin IS NULL`,
    [lineaId, simId]
  );
};

export const listarHistorialLineaSimPorSim = async (
  simId: string,
  client?: PoolClient
): Promise<LineaMovilSimHistorialRow[]> => {
  const executor = client ?? pool;
  const result = await executor.query<LineaMovilSimHistorialRow>(
    `SELECT h.id, h.linea_movil_id, h.sim_id, h.fecha_inicio, h.fecha_fin,
            h.motivo, h.usuario_id, s.codigo_inventario AS sim_codigo_inventario,
            s.iccid_codigo_fabrica, l.numero_telefonico
       FROM itam.lineas_moviles_sim_historial h
       JOIN itam.sim s ON s.id = h.sim_id
       JOIN itam.lineas_moviles l ON l.id = h.linea_movil_id
      WHERE h.sim_id = $1
      ORDER BY h.fecha_inicio DESC, h.id DESC`,
    [simId]
  );
  return result.rows;
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
