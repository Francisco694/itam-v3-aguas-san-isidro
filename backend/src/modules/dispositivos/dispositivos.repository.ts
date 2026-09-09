import type { Pool, PoolClient } from "pg";
import { pool } from "../../config/database";
import { currentUserId } from "../../shared/auth-context";
import type {
  ActualizarDispositivoInput,
  CrearDispositivoInput,
  DispositivoFilters,
  DispositivoRow,
  EvidenciaResponsableRow,
  EstadoRow,
  HistorialDispositivoRow,
  ResumenGerencialRow
} from "./dispositivos.types";

type DbExecutor = Pool | PoolClient;

const getDb = (client?: PoolClient): DbExecutor => client ?? pool;

const dispositivoSelect = `
  SELECT
    d.id AS dispositivo_id,
    d.codigo_inventario AS dispositivo_codigo_inventario,
    d.tipo_dispositivo,
    tipo.id AS tipo_dispositivo_id,
    tipo.nombre AS tipo_dispositivo_nombre,
    tipo.descripcion AS tipo_dispositivo_descripcion,
    tipo.activo AS tipo_dispositivo_activo,
    tipo.requiere_imei AS tipo_dispositivo_requiere_imei,
    tipo.configuracion_formulario AS tipo_dispositivo_configuracion_formulario,
    tipo_familia.id AS tipo_familia_id,
    tipo_familia.nombre_familia AS tipo_familia_nombre,
    tipo_familia.prefijo AS tipo_familia_prefijo,
    tipo_familia.activo AS tipo_familia_activa,
    tipo_familia.estrategia_codigo AS tipo_familia_estrategia,
    tipo_familia.agrupa_tipos AS tipo_familia_agrupa_tipos,
    tipo_familia.etiqueta_operativa AS tipo_familia_etiqueta_operativa,
    d.marca,
    d.modelo,
    d.numero_serie,
    d.imei,
    d.localidad,
    d.ubicacion_detalle,
    d.observaciones,
    d.atributos_especificos,
    d.valor_comercial,
    factura.id AS factura_adquisicion_id,
    factura.numero_factura,
    factura.fecha_factura,
    factura.proveedor AS factura_proveedor,
    factura.monto_total AS factura_monto_total,
    factura.observaciones AS factura_observaciones,
    factura.referencia_documental AS factura_referencia_documental,
    factura.documento_nombre_original AS factura_documento_nombre_original,
    factura.documento_mime_type AS factura_documento_mime_type,
    factura.documento_tamano_bytes AS factura_documento_tamano_bytes,
    d.fecha_registro,
    d.creado_en,
    d.actualizado_en,
    e.id AS estado_id,
    e.codigo AS estado_codigo,
    e.nombre AS estado_nombre,
    c.id AS colaborador_id,
    c.rut AS colaborador_rut,
    c.nombre AS colaborador_nombre,
    c.cargo AS colaborador_cargo,
    c.localidad AS colaborador_localidad,
    colaborador_dep.id AS colaborador_departamento_id,
    colaborador_dep.nombre AS colaborador_departamento_nombre,
    dep.id AS departamento_id,
    dep.nombre AS departamento_nombre,
    recibido.id AS recibido_por_id,
    recibido.rut AS recibido_por_rut,
    recibido.nombre AS recibido_por_nombre,
    recibido.cargo AS recibido_por_cargo,
    recibido.localidad AS recibido_por_localidad,
    s.id AS sim_id,
    s.codigo_inventario AS sim_codigo_inventario,
    s.iccid_codigo_fabrica,
    s.numero_asociado,
    s.compania,
    sim_estado.id AS sim_estado_id,
    sim_estado.codigo AS sim_estado_codigo,
    sim_estado.nombre AS sim_estado_nombre,
    ultimo_responsable.tipo AS ultimo_responsable_tipo,
    COALESCE(
      NULLIF(ultimo_responsable.nombre, ''),
      ultimo_colaborador.nombre,
      ultimo_departamento.nombre
    ) AS ultimo_responsable_nombre,
    COALESCE(NULLIF(ultimo_responsable.rut, ''), ultimo_colaborador.rut)
      AS ultimo_responsable_rut,
    ultimo_responsable.fecha_movimiento AS ultimo_responsable_fecha,
    offboarding.resultado AS ultimo_resultado_offboarding
    ,verificacion.resultado AS ultima_verificacion_resultado
    ,verificacion.fecha_verificacion AS ultima_verificacion_fecha
    ,verificacion.observacion AS ultima_verificacion_observacion
  FROM itam.dispositivos d
  INNER JOIN itam.estados e
    ON e.id = d.estado_id
  INNER JOIN itam.tipos_dispositivo tipo
    ON tipo.id = d.tipo_dispositivo_id
  LEFT JOIN itam.familias_codigo_inventario tipo_familia
    ON tipo_familia.id = tipo.familia_codigo_inventario_id
  LEFT JOIN itam.colaboradores c
    ON c.id = d.colaborador_id
  LEFT JOIN itam.departamentos colaborador_dep
    ON colaborador_dep.id = c.departamento_id
  LEFT JOIN itam.departamentos dep
    ON dep.id = d.departamento_id
  LEFT JOIN itam.colaboradores recibido
    ON recibido.id = d.recibido_por_id
  LEFT JOIN itam.sim s
    ON s.dispositivo_id = d.id
  LEFT JOIN itam.estados sim_estado
    ON sim_estado.id = s.estado_id
  LEFT JOIN itam.facturas_adquisicion factura
    ON factura.id = d.factura_adquisicion_id
  LEFT JOIN LATERAL (
    SELECT candidato.tipo, candidato.id, candidato.nombre, candidato.rut,
      candidato.fecha_movimiento
    FROM (
      SELECT custodia.tipo, custodia.id, custodia.nombre, custodia.rut,
        h.fecha_evento AS fecha_movimiento, custodia.prioridad
      FROM itam.historial_eventos h
      CROSS JOIN LATERAL (
        VALUES
          (
            h.detalle#>>'{custodiaNueva,tipo}',
            h.detalle#>>'{custodiaNueva,id}',
            h.detalle#>>'{custodiaNueva,nombre}',
            h.detalle#>>'{custodiaNueva,rut}',
            0
          ),
          (
            h.detalle#>>'{custodiaAnterior,tipo}',
            h.detalle#>>'{custodiaAnterior,id}',
            h.detalle#>>'{custodiaAnterior,nombre}',
            h.detalle#>>'{custodiaAnterior,rut}',
            1
          ),
          (
            CASE
              WHEN h.detalle->>'collaboratorId' ~ '^[0-9]+$' THEN 'COLABORADOR'
              WHEN h.detalle->>'departamentoId' ~ '^[0-9]+$' THEN 'DEPARTAMENTO'
              ELSE NULL
            END,
            COALESCE(h.detalle->>'collaboratorId', h.detalle->>'departamentoId'),
            NULL,
            NULL,
            2
          )
      ) custodia(tipo, id, nombre, rut, prioridad)
      WHERE h.dispositivo_id = d.id
        AND h.tipo_entidad = 'DISPOSITIVO'
        AND custodia.tipo IN ('COLABORADOR', 'DEPARTAMENTO')
        AND custodia.id ~ '^[0-9]+$'

      UNION ALL

      SELECT
        CASE WHEN comprobante.colaborador_id IS NOT NULL
          THEN 'COLABORADOR' ELSE 'DEPARTAMENTO' END,
        COALESCE(comprobante.colaborador_id, comprobante.departamento_id)::TEXT,
        NULL,
        NULL,
        comprobante.fecha,
        3
      FROM itam.comprobantes_devolucion comprobante
      WHERE comprobante.dispositivo_id = d.id
    ) candidato
    ORDER BY candidato.fecha_movimiento DESC, candidato.prioridad ASC
    LIMIT 1
  ) ultimo_responsable ON TRUE
  LEFT JOIN itam.colaboradores ultimo_colaborador
    ON ultimo_responsable.tipo = 'COLABORADOR'
    AND ultimo_colaborador.id = ultimo_responsable.id::BIGINT
  LEFT JOIN itam.departamentos ultimo_departamento
    ON ultimo_responsable.tipo = 'DEPARTAMENTO'
    AND ultimo_departamento.id = ultimo_responsable.id::BIGINT
  LEFT JOIN LATERAL (
    SELECT h.detalle->>'resultado' AS resultado
    FROM itam.historial_eventos h
    WHERE h.dispositivo_id=d.id
      AND h.tipo_evento IN ('RESULTADO_OFFBOARDING','DEVOLVER_DISPOSITIVO')
      AND h.detalle ? 'resultado'
    ORDER BY h.fecha_evento DESC,h.id DESC
    LIMIT 1
  ) offboarding ON TRUE
  LEFT JOIN LATERAL (
    SELECT v.resultado, v.fecha_verificacion, v.observacion
    FROM itam.verificaciones_fisicas_dispositivo v
    WHERE v.dispositivo_id = d.id
    ORDER BY v.fecha_verificacion DESC, v.id DESC
    LIMIT 1
  ) verificacion ON TRUE
`;

export const listarDispositivos = async (
  filters: DispositivoFilters
): Promise<DispositivoRow[]> => {
  const values: unknown[] = [];
  const where: string[] = [];

  if (filters.q !== undefined) {
    values.push(`%${filters.q}%`);
    where.push(`
      (
        d.codigo_inventario::TEXT ILIKE $${values.length}
        OR tipo.nombre ILIKE $${values.length}
        OR d.marca ILIKE $${values.length}
        OR d.modelo ILIKE $${values.length}
        OR d.numero_serie ILIKE $${values.length}
        OR d.imei ILIKE $${values.length}
      )
    `);
  }

  if (filters.tipo !== undefined) {
    values.push(`%${filters.tipo}%`);
    where.push(`tipo.nombre ILIKE $${values.length}`);
  }

  if (filters.tipoDispositivoId !== undefined) {
    values.push(filters.tipoDispositivoId);
    where.push(`d.tipo_dispositivo_id = $${values.length}`);
  }

  if (filters.estado !== undefined) {
    values.push(filters.estado);
    where.push(`e.codigo = $${values.length}`);
  }

  if (filters.colaboradorId !== undefined) {
    values.push(filters.colaboradorId);
    where.push(`d.colaborador_id = $${values.length}`);
  }

  if (filters.departamentoId !== undefined) {
    values.push(filters.departamentoId);
    where.push(`d.departamento_id = $${values.length}`);
  }

  if (filters.familiaCodigoInventarioId !== undefined) {
    values.push(filters.familiaCodigoInventarioId);
    where.push(`tipo.familia_codigo_inventario_id = $${values.length}`);
  }

  if (filters.departamentoColaboradorId !== undefined) {
    values.push(filters.departamentoColaboradorId);
    where.push(`c.departamento_id = $${values.length}`);
  }

  if (filters.localidad !== undefined) {
    values.push(`%${filters.localidad}%`);
    where.push(`d.localidad ILIKE $${values.length}`);
  }

  if (filters.verificacion !== undefined) {
    values.push(filters.verificacion);
    where.push(`COALESCE(verificacion.resultado, 'PENDIENTE') = $${values.length}`);
  }

  const result = await pool.query<DispositivoRow>(
    `
      ${dispositivoSelect}
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY d.codigo_inventario ASC
    `,
    values
  );

  return result.rows;
};

export const obtenerDispositivoPorCodigo = async (
  codigoInventario: number,
  client?: PoolClient,
  forUpdate = false
): Promise<DispositivoRow | null> => {
  const result = await getDb(client).query<DispositivoRow>(
    `
      ${dispositivoSelect}
      WHERE d.codigo_inventario = $1
      LIMIT 1
      ${forUpdate ? "FOR UPDATE OF d" : ""}
    `,
    [codigoInventario]
  );

  return result.rows[0] ?? null;
};

export const obtenerDispositivoPorId = async (
  dispositivoId: number,
  client?: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await getDb(client).query<DispositivoRow>(
    `
      ${dispositivoSelect}
      WHERE d.id = $1
      LIMIT 1
    `,
    [dispositivoId]
  );

  return result.rows[0] ?? null;
};

export const obtenerEstadoDispositivoPorCodigo = async (
  codigo: string,
  client?: PoolClient
): Promise<EstadoRow | null> => {
  const result = await getDb(client).query<EstadoRow>(
    `
      SELECT id, codigo, nombre
      FROM itam.estados
      WHERE tipo_entidad = 'DISPOSITIVO'
        AND codigo = $1
        AND activo = TRUE
      LIMIT 1
    `,
    [codigo]
  );

  return result.rows[0] ?? null;
};

export const obtenerEstadoDispositivoPorId = async (
  estadoId: number,
  client?: PoolClient
): Promise<EstadoRow | null> => {
  const result = await getDb(client).query<EstadoRow>(
    `
      SELECT id, codigo, nombre
      FROM itam.estados
      WHERE tipo_entidad = 'DISPOSITIVO'
        AND id = $1
        AND activo = TRUE
      LIMIT 1
    `,
    [estadoId]
  );

  return result.rows[0] ?? null;
};

export const crearDispositivo = async (
  input: CrearDispositivoInput,
  codigoInventario: number,
  estadoId: string,
  client: PoolClient
): Promise<DispositivoRow> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      INSERT INTO itam.dispositivos (
        codigo_inventario,
        tipo_dispositivo_id,
        marca,
        modelo,
        numero_serie,
        imei,
        estado_id,
        localidad,
        ubicacion_detalle,
        observaciones,
        atributos_especificos,
        valor_comercial
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      input.tipoDispositivoId,
      input.marca ?? null,
      input.modelo ?? null,
      input.numeroSerie ?? null,
      input.imei ?? null,
      estadoId,
      input.localidad ?? null,
      input.ubicacionDetalle ?? null,
      input.observaciones ?? null,
      JSON.stringify(input.atributosEspecificos ?? {}),
      input.valorComercial ?? 0
    ]
  );

  const dispositivo = await obtenerDispositivoPorCodigo(
    result.rows[0]!.codigo_inventario,
    client
  );

  return dispositivo!;
};

export const actualizarDispositivo = async (
  codigoInventario: number,
  input: ActualizarDispositivoInput,
  client?: PoolClient
): Promise<DispositivoRow | null> => {
  const executor = getDb(client);
  const result = await executor.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        tipo_dispositivo_id = COALESCE($2, tipo_dispositivo_id),
        marca = CASE WHEN $3::boolean THEN $4 ELSE marca END,
        modelo = CASE WHEN $5::boolean THEN $6 ELSE modelo END,
        numero_serie = CASE
          WHEN $7::boolean THEN $8
          ELSE numero_serie
        END,
        imei = CASE WHEN $9::boolean THEN $10 ELSE imei END,
        localidad = CASE
          WHEN $11::boolean THEN $12
          ELSE localidad
        END,
        ubicacion_detalle = CASE
          WHEN $13::boolean THEN $14
          ELSE ubicacion_detalle
        END,
        observaciones = CASE
          WHEN $15::boolean THEN $16
          ELSE observaciones
        END,
        atributos_especificos = CASE
          WHEN $17::boolean THEN $18::jsonb
          ELSE atributos_especificos
        END,
        valor_comercial = CASE
          WHEN $19::boolean THEN $20
          ELSE valor_comercial
        END
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      input.tipoDispositivoId ?? null,
      input.marca !== undefined,
      input.marca ?? null,
      input.modelo !== undefined,
      input.modelo ?? null,
      input.numeroSerie !== undefined,
      input.numeroSerie ?? null,
      input.imei !== undefined,
      input.imei ?? null,
      input.localidad !== undefined,
      input.localidad ?? null,
      input.ubicacionDetalle !== undefined,
      input.ubicacionDetalle ?? null,
      input.observaciones !== undefined,
      input.observaciones ?? null,
      input.atributosEspecificos !== undefined,
      JSON.stringify(input.atributosEspecificos ?? {}),
      input.valorComercial !== undefined,
      input.valorComercial ?? null
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const obtenerResumenGerencial = async (): Promise<ResumenGerencialRow> => {
  const result = await pool.query<ResumenGerencialRow>(`
    SELECT
      COUNT(*) FILTER (
        WHERE COALESCE(e.codigo, '') NOT IN ('EXTRAVIADO', 'DADO_BAJA')
      ) AS inventario_operacional_cantidad,
      COALESCE(SUM(d.valor_comercial) FILTER (
        WHERE COALESCE(e.codigo, '') NOT IN ('EXTRAVIADO', 'DADO_BAJA')
      ), 0) AS inventario_operacional_valor,
      COUNT(*) FILTER (WHERE e.codigo = 'DISPONIBLE') AS disponibles_cantidad,
      COALESCE(SUM(d.valor_comercial) FILTER (WHERE e.codigo = 'DISPONIBLE'), 0) AS disponibles_valor,
      COUNT(*) FILTER (WHERE e.codigo = 'ASIGNADO') AS asignados_cantidad,
      COALESCE(SUM(d.valor_comercial) FILTER (WHERE e.codigo = 'ASIGNADO'), 0) AS asignados_valor,
      COUNT(*) FILTER (WHERE e.codigo = 'SERVICIO_TECNICO') AS servicio_tecnico_cantidad,
      COALESCE(SUM(d.valor_comercial) FILTER (WHERE e.codigo = 'SERVICIO_TECNICO'), 0) AS servicio_tecnico_valor,
      COUNT(*) FILTER (WHERE e.codigo = 'EXTRAVIADO') AS extraviados_cantidad,
      COALESCE(SUM(d.valor_comercial) FILTER (WHERE e.codigo = 'EXTRAVIADO'), 0) AS extraviados_valor,
      COUNT(*) FILTER (WHERE e.codigo = 'DADO_BAJA') AS bajas_cantidad,
      COALESCE(SUM(COALESCE(baja.valor_comercial_momento, d.valor_comercial)) FILTER (
        WHERE e.codigo = 'DADO_BAJA'
      ), 0) AS bajas_valor
    FROM itam.dispositivos d
    LEFT JOIN itam.estados e ON e.id = d.estado_id
    LEFT JOIN LATERAL (
      SELECT b.valor_comercial_momento
      FROM itam.bajas_dispositivo b
      WHERE b.dispositivo_id = d.id
      ORDER BY b.creado_en DESC, b.id DESC
      LIMIT 1
    ) baja ON TRUE
  `);
  return result.rows[0]!;
};

export const asignarDispositivoAColaborador = async (
  codigoInventario: number,
  colaboradorId: number,
  estadoId: string,
  client: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        colaborador_id = $2,
        departamento_id = NULL,
        recibido_por_id = NULL,
        estado_id = $3
      WHERE codigo_inventario = $1
        AND colaborador_id IS NULL
        AND departamento_id IS NULL
      RETURNING codigo_inventario
    `,
    [codigoInventario, colaboradorId, estadoId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const asignarDispositivoADepartamento = async (
  codigoInventario: number,
  departamentoId: number,
  recibidoPorId: number,
  estadoId: string,
  localidad: string | null | undefined,
  ubicacionDetalle: string | null | undefined,
  client: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        colaborador_id = NULL,
        departamento_id = $2,
        recibido_por_id = $3,
        estado_id = $4,
        localidad = CASE
          WHEN $5::boolean THEN $6
          ELSE localidad
        END,
        ubicacion_detalle = CASE
          WHEN $7::boolean THEN $8
          ELSE ubicacion_detalle
        END
      WHERE codigo_inventario = $1
        AND colaborador_id IS NULL
        AND departamento_id IS NULL
      RETURNING codigo_inventario
    `,
    [
      codigoInventario,
      departamentoId,
      recibidoPorId,
      estadoId,
      localidad !== undefined,
      localidad ?? null,
      ubicacionDetalle !== undefined,
      ubicacionDetalle ?? null
    ]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const registrarBajaDispositivo = async (
  dispositivoId: string,
  motivo: string,
  observaciones: string | null | undefined,
  valorComercial: number,
  responsable: string,
  ordenServicioId: string | null,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `INSERT INTO itam.bajas_dispositivo(
       dispositivo_id,motivo,observacion,valor_comercial_momento,
       responsable,orden_servicio_id
     ) VALUES ($1,$2,$3,$4,$5,$6)`,
    [dispositivoId,motivo,observaciones ?? null,valorComercial,responsable,ordenServicioId]
  );
};

export const devolverDispositivo = async (
  codigoInventario: number,
  estadoId: string,
  client: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        colaborador_id = NULL,
        departamento_id = NULL,
        recibido_por_id = NULL,
        estado_id = $2
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario, estadoId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const cambiarEstadoDispositivo = async (
  codigoInventario: number,
  estadoId: number,
  client: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET estado_id = $2
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario, estadoId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const anularBajaDispositivo = async (
  dispositivoId: string,
  motivo: string,
  client: PoolClient
): Promise<boolean> => {
  const result = await client.query(
    `UPDATE itam.bajas_dispositivo
     SET anulada=TRUE, anulada_en=NOW(), motivo_anulacion=$2
     WHERE dispositivo_id=$1 AND anulada=FALSE`,
    [dispositivoId, motivo]
  );
  return (result.rowCount ?? 0) > 0;
};

export const darDeBajaYLiberarCustodia = async (
  codigoInventario: number,
  estadoId: number,
  client: PoolClient
): Promise<DispositivoRow | null> => {
  const result = await client.query<{ codigo_inventario: number }>(
    `
      UPDATE itam.dispositivos
      SET
        estado_id = $2,
        colaborador_id = NULL,
        departamento_id = NULL,
        recibido_por_id = NULL
      WHERE codigo_inventario = $1
      RETURNING codigo_inventario
    `,
    [codigoInventario, estadoId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return obtenerDispositivoPorCodigo(
    result.rows[0].codigo_inventario,
    client
  );
};

export const insertarHistorialDispositivo = async (
  dispositivoId: string,
  tipoEvento: string,
  estadoAnteriorId: string | null,
  estadoNuevoId: string | null,
  responsable: string,
  observaciones: string | null | undefined,
  detalle: Record<string, unknown>,
  client: PoolClient
): Promise<void> => {
  await client.query(
    `
      INSERT INTO itam.historial_eventos (
        tipo_entidad,
        dispositivo_id,
        tipo_evento,
        estado_anterior_id,
        estado_nuevo_id,
        responsable,
        observaciones,
        detalle,
        usuario_ejecutor_id
      )
      VALUES (
        'DISPOSITIVO',
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        $7::jsonb,
        $8
      )
    `,
    [
      dispositivoId,
      tipoEvento,
      estadoAnteriorId,
      estadoNuevoId,
      responsable,
      observaciones ?? null,
      JSON.stringify(detalle),
      currentUserId()
    ]
  );
};

export const listarHistorialDispositivo = async (
  codigoInventario: number
): Promise<HistorialDispositivoRow[]> => {
  const result = await pool.query<HistorialDispositivoRow>(
    `
      SELECT
        h.id,
        h.tipo_entidad,
        h.dispositivo_id,
        h.tipo_evento,
        h.estado_anterior_id,
        anterior.codigo AS estado_anterior_codigo,
        anterior.nombre AS estado_anterior_nombre,
        h.estado_nuevo_id,
        nuevo.codigo AS estado_nuevo_codigo,
        nuevo.nombre AS estado_nuevo_nombre,
        h.responsable,
        h.observaciones,
        h.detalle,
        h.fecha_evento,
        h.usuario_ejecutor_id,
        ejecutor.nombre AS usuario_ejecutor_nombre,
        ejecutor.email AS usuario_ejecutor_email,
        historico.id AS colaborador_historico_id,
        historico.nombre AS colaborador_historico_nombre,
        historico.rut AS colaborador_historico_rut
      FROM itam.historial_eventos h
      INNER JOIN itam.dispositivos d
        ON d.id = h.dispositivo_id
      LEFT JOIN itam.estados anterior
        ON anterior.id = h.estado_anterior_id
      LEFT JOIN itam.estados nuevo
        ON nuevo.id = h.estado_nuevo_id
      LEFT JOIN itam.usuarios ejecutor
        ON ejecutor.id = h.usuario_ejecutor_id
      LEFT JOIN itam.colaboradores historico
        ON historico.id = CASE
          WHEN COALESCE(
            h.detalle->>'collaboratorId',
            h.detalle#>>'{custodiaNueva,id}'
          ) <> '' AND COALESCE(
            h.detalle->>'collaboratorId',
            h.detalle#>>'{custodiaNueva,id}'
          ) !~ '[^0-9]'
          THEN COALESCE(
            h.detalle->>'collaboratorId',
            h.detalle#>>'{custodiaNueva,id}'
          )::BIGINT
          ELSE NULL
        END
      WHERE d.codigo_inventario = $1
        AND h.tipo_entidad = 'DISPOSITIVO'
      ORDER BY h.fecha_evento DESC
    `,
    [codigoInventario]
  );

  return result.rows;
};

export const listarEvidenciasResponsablesDispositivo = async (
  codigoInventario: number
): Promise<EvidenciaResponsableRow[]> => {
  const result = await pool.query<EvidenciaResponsableRow>(
    `
      WITH evidencias_historial AS (
        SELECT
          h.fecha_evento AS fecha,
          h.tipo_evento,
          custodia.tipo,
          custodia.id AS responsable_id,
          COALESCE(NULLIF(custodia.nombre, ''), colaborador.nombre, departamento.nombre) AS nombre,
          COALESCE(NULLIF(custodia.rut, ''), colaborador.rut) AS rut,
          estado.codigo AS estado_resultante_codigo,
          estado.nombre AS estado_resultante_nombre,
          h.observaciones AS observacion,
          CASE
            WHEN baja.id IS NOT NULL THEN 'BAJA'
            ELSE 'HISTORIAL'
          END AS origen
        FROM itam.historial_eventos h
        INNER JOIN itam.dispositivos d ON d.id = h.dispositivo_id
        LEFT JOIN itam.estados estado ON estado.id = h.estado_nuevo_id
        LEFT JOIN itam.bajas_dispositivo baja
          ON baja.dispositivo_id = h.dispositivo_id
          AND baja.anulada = FALSE
          AND h.tipo_evento IN ('DAR_BAJA', 'DAR_BAJA_DESDE_SERVICIO')
        CROSS JOIN LATERAL (
          SELECT candidato.tipo, candidato.id, candidato.nombre, candidato.rut
          FROM (
            VALUES
              (
                CASE WHEN h.tipo_evento IN ('DEVOLVER_DISPOSITIVO', 'DAR_BAJA', 'DAR_BAJA_DESDE_SERVICIO') THEN 0 ELSE 1 END,
                h.detalle#>>'{custodiaAnterior,tipo}',
                h.detalle#>>'{custodiaAnterior,id}',
                h.detalle#>>'{custodiaAnterior,nombre}',
                h.detalle#>>'{custodiaAnterior,rut}'
              ),
              (
                CASE WHEN h.tipo_evento IN ('DEVOLVER_DISPOSITIVO', 'DAR_BAJA', 'DAR_BAJA_DESDE_SERVICIO') THEN 1 ELSE 0 END,
                h.detalle#>>'{custodiaNueva,tipo}',
                h.detalle#>>'{custodiaNueva,id}',
                h.detalle#>>'{custodiaNueva,nombre}',
                h.detalle#>>'{custodiaNueva,rut}'
              ),
              (
                2,
                CASE
                  WHEN COALESCE(h.detalle->>'collaboratorId', h.detalle->>'colaboradorId') ~ '^[0-9]+$' THEN 'COLABORADOR'
                  WHEN h.detalle->>'departamentoId' ~ '^[0-9]+$' THEN 'DEPARTAMENTO'
                  ELSE NULL
                END,
                COALESCE(h.detalle->>'collaboratorId', h.detalle->>'colaboradorId', h.detalle->>'departamentoId'),
                NULL,
                NULL
              )
          ) candidato(prioridad, tipo, id, nombre, rut)
          WHERE candidato.tipo IN ('COLABORADOR', 'DEPARTAMENTO')
            AND candidato.id ~ '^[0-9]+$'
          ORDER BY candidato.prioridad
          LIMIT 1
        ) custodia
        LEFT JOIN itam.colaboradores colaborador
          ON custodia.tipo = 'COLABORADOR' AND colaborador.id = custodia.id::BIGINT
        LEFT JOIN itam.departamentos departamento
          ON custodia.tipo = 'DEPARTAMENTO' AND departamento.id = custodia.id::BIGINT
        WHERE d.codigo_inventario = $1
          AND h.tipo_entidad = 'DISPOSITIVO'
      ),
      evidencias_comprobante AS (
        SELECT
          comprobante.fecha,
          'DEVOLVER_DISPOSITIVO'::TEXT AS tipo_evento,
          CASE WHEN comprobante.colaborador_id IS NOT NULL THEN 'COLABORADOR' ELSE 'DEPARTAMENTO' END AS tipo,
          COALESCE(comprobante.colaborador_id, comprobante.departamento_id)::TEXT AS responsable_id,
          COALESCE(colaborador.nombre, departamento.nombre) AS nombre,
          colaborador.rut,
          'DISPONIBLE'::TEXT AS estado_resultante_codigo,
          'Disponible'::TEXT AS estado_resultante_nombre,
          comprobante.observaciones AS observacion,
          'COMPROBANTE'::TEXT AS origen
        FROM itam.comprobantes_devolucion comprobante
        INNER JOIN itam.dispositivos d ON d.id = comprobante.dispositivo_id
        LEFT JOIN itam.colaboradores colaborador ON colaborador.id = comprobante.colaborador_id
        LEFT JOIN itam.departamentos departamento ON departamento.id = comprobante.departamento_id
        WHERE d.codigo_inventario = $1
      )
      SELECT * FROM evidencias_historial WHERE nombre IS NOT NULL
      UNION ALL
      SELECT * FROM evidencias_comprobante WHERE nombre IS NOT NULL
      ORDER BY fecha DESC, tipo_evento DESC
    `,
    [codigoInventario]
  );

  return result.rows;
};
