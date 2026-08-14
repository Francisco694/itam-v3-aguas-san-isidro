import { pool } from "../../config/database";
import { obtenerColaboradorPorId } from "../colaboradores/colaboradores.repository";
import { obtenerDepartamentoPorId } from "../departamentos/departamentos.repository";
import { toIsoDate, toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  isDatabaseBusinessRuleViolation,
  isForeignKeyViolation,
  isUniqueViolation
} from "../../shared/errors";
import {
  actualizarDispositivo,
  asignarDispositivoAColaborador,
  asignarDispositivoADepartamento,
  cambiarEstadoDispositivo,
  crearDispositivo,
  devolverDispositivo,
  insertarHistorialDispositivo,
  listarDispositivos,
  listarHistorialDispositivo,
  obtenerDispositivoPorCodigo,
  obtenerEstadoDispositivoPorCodigo,
  obtenerEstadoDispositivoPorId
} from "./dispositivos.repository";
import type {
  ActualizarDispositivoInput,
  AsignarColaboradorInput,
  AsignarDepartamentoInput,
  CambiarEstadoDispositivoInput,
  ColaboradorResumen,
  CrearDispositivoInput,
  DepartamentoResumen,
  DevolverDispositivoInput,
  DispositivoFilters,
  DispositivoResumen,
  DispositivoRow,
  EstadoResumen,
  HistorialDispositivo,
  HistorialDispositivoRow,
  SimAsociadaResumen
} from "./dispositivos.types";

const mapEstado = (
  id: string,
  codigo: string,
  nombre: string
): EstadoResumen => ({
  id,
  codigo,
  nombre
});

const mapColaborador = (
  id: string | null,
  rut: string | null,
  nombre: string | null,
  cargo: string | null,
  localidad: string | null
): ColaboradorResumen | null => {
  if (!id || !rut || !nombre) {
    return null;
  }

  return {
    id,
    rut,
    nombre,
    cargo,
    localidad
  };
};

const mapDepartamento = (
  id: string | null,
  nombre: string | null
): DepartamentoResumen | null => {
  if (!id || !nombre) {
    return null;
  }

  return { id, nombre };
};

const mapSimAsociada = (
  row: DispositivoRow
): SimAsociadaResumen | null => {
  if (
    !row.sim_id ||
    row.sim_codigo_inventario === null ||
    !row.iccid_codigo_fabrica
  ) {
    return null;
  }

  return {
    id: row.sim_id,
    codigoInventario: row.sim_codigo_inventario,
    iccidCodigoFabrica: row.iccid_codigo_fabrica,
    numeroAsociado: row.numero_asociado,
    compania: row.compania,
    estado:
      row.sim_estado_id &&
      row.sim_estado_codigo &&
      row.sim_estado_nombre
        ? mapEstado(
            row.sim_estado_id,
            row.sim_estado_codigo,
            row.sim_estado_nombre
          )
        : null
  };
};

const mapDispositivo = (
  row: DispositivoRow
): DispositivoResumen => ({
  id: row.dispositivo_id,
  codigoInventario: row.dispositivo_codigo_inventario,
  tipoDispositivo: row.tipo_dispositivo,
  marca: row.marca,
  modelo: row.modelo,
  numeroSerie: row.numero_serie,
  imei: row.imei,
  localidad: row.localidad,
  ubicacionDetalle: row.ubicacion_detalle,
  observaciones: row.observaciones,
  fechaRegistro: toIsoDate(row.fecha_registro),
  creadoEn: toIsoDateTime(row.creado_en),
  actualizadoEn: toIsoDateTime(row.actualizado_en),
  estado: mapEstado(
    row.estado_id,
    row.estado_codigo,
    row.estado_nombre
  ),
  colaborador: mapColaborador(
    row.colaborador_id,
    row.colaborador_rut,
    row.colaborador_nombre,
    row.colaborador_cargo,
    row.colaborador_localidad
  ),
  departamento: mapDepartamento(
    row.departamento_id,
    row.departamento_nombre
  ),
  recibidoPor: mapColaborador(
    row.recibido_por_id,
    row.recibido_por_rut,
    row.recibido_por_nombre,
    row.recibido_por_cargo,
    row.recibido_por_localidad
  ),
  simAsociada: mapSimAsociada(row)
});

const mapHistorial = (
  row: HistorialDispositivoRow
): HistorialDispositivo => ({
  id: row.id,
  tipoEntidad: row.tipo_entidad,
  dispositivoId: row.dispositivo_id,
  tipoEvento: row.tipo_evento,
  estadoAnterior:
    row.estado_anterior_id &&
    row.estado_anterior_codigo &&
    row.estado_anterior_nombre
      ? mapEstado(
          row.estado_anterior_id,
          row.estado_anterior_codigo,
          row.estado_anterior_nombre
        )
      : null,
  estadoNuevo:
    row.estado_nuevo_id &&
    row.estado_nuevo_codigo &&
    row.estado_nuevo_nombre
      ? mapEstado(
          row.estado_nuevo_id,
          row.estado_nuevo_codigo,
          row.estado_nuevo_nombre
        )
      : null,
  responsable: row.responsable,
  observaciones: row.observaciones,
  detalle: row.detalle,
  fechaEvento: toIsoDateTime(row.fecha_evento)
});

const normalizarErrorDispositivo = (error: unknown): never => {
  if (isUniqueViolation(error)) {
    throw new ConflictError(
      "Ya existe un recurso con alguno de los identificadores informados."
    );
  }

  if (isForeignKeyViolation(error)) {
    throw new ConflictError(
      "La operación referencia un recurso que no existe o no es válido."
    );
  }

  if (isDatabaseBusinessRuleViolation(error)) {
    throw new ConflictError(
      "La operación viola una regla de negocio del inventario."
    );
  }

  throw error;
};

const obtenerEstadoObligatorio = async (
  codigo: string
): Promise<EstadoResumen> => {
  const estado = await obtenerEstadoDispositivoPorCodigo(codigo);

  if (!estado) {
    throw new ConflictError(
      `No existe un estado activo de dispositivo con código ${codigo}.`
    );
  }

  return mapEstado(estado.id, estado.codigo, estado.nombre);
};

export const obtenerDispositivos = async (
  filters: DispositivoFilters
): Promise<DispositivoResumen[]> => {
  const dispositivos = await listarDispositivos(filters);

  return dispositivos.map(mapDispositivo);
};

export const obtenerDispositivo = async (
  codigoInventario: number
): Promise<DispositivoResumen> => {
  const dispositivo = await obtenerDispositivoPorCodigo(
    codigoInventario
  );

  if (!dispositivo) {
    throw new NotFoundError("Dispositivo no encontrado.");
  }

  return mapDispositivo(dispositivo);
};

export const crearNuevoDispositivo = async (
  input: CrearDispositivoInput
): Promise<DispositivoResumen> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const estadoDisponible =
      await obtenerEstadoDispositivoPorCodigo(
        "DISPONIBLE",
        client
      );

    if (!estadoDisponible) {
      throw new ConflictError(
        "No existe un estado DISPONIBLE activo para dispositivos."
      );
    }

    const dispositivo = await crearDispositivo(
      input,
      estadoDisponible.id,
      client
    );

    await insertarHistorialDispositivo(
      dispositivo.dispositivo_id,
      "ALTA_DISPOSITIVO",
      null,
      estadoDisponible.id,
      input.responsable,
      input.observaciones,
      {
        codigoInventario: input.codigoInventario,
        tipoDispositivo: input.tipoDispositivo
      },
      client
    );

    await client.query("COMMIT");

    return mapDispositivo(dispositivo);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    client.release();
  }
};

export const actualizarDispositivoExistente = async (
  codigoInventario: number,
  input: ActualizarDispositivoInput
): Promise<DispositivoResumen> => {
  try {
    const dispositivo = await actualizarDispositivo(
      codigoInventario,
      input
    );

    if (!dispositivo) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    return mapDispositivo(dispositivo);
  } catch (error) {
    return normalizarErrorDispositivo(error);
  }
};

export const asignarAColaborador = async (
  codigoInventario: number,
  input: AsignarColaboradorInput
): Promise<DispositivoResumen> => {
  const colaborador = await obtenerColaboradorPorId(
    input.colaboradorId
  );

  if (!colaborador) {
    throw new NotFoundError("Colaborador no encontrado.");
  }

  const estadoAsignado = await obtenerEstadoObligatorio("ASIGNADO");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const anterior = await obtenerDispositivoPorCodigo(
      codigoInventario,
      client
    );

    if (!anterior) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    const actualizado = await asignarDispositivoAColaborador(
      codigoInventario,
      input.colaboradorId,
      estadoAsignado.id,
      client
    );

    if (!actualizado) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    await insertarHistorialDispositivo(
      actualizado.dispositivo_id,
      "ASIGNAR_COLABORADOR",
      anterior.estado_id,
      estadoAsignado.id,
      input.responsable,
      input.observaciones,
      {
        colaboradorId: input.colaboradorId
      },
      client
    );

    await client.query("COMMIT");

    return mapDispositivo(actualizado);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    client.release();
  }
};

export const asignarADepartamento = async (
  codigoInventario: number,
  input: AsignarDepartamentoInput
): Promise<DispositivoResumen> => {
  const departamento = await obtenerDepartamentoPorId(
    input.departamentoId
  );

  if (!departamento) {
    throw new NotFoundError("Departamento no encontrado.");
  }

  const recibidoPor = await obtenerColaboradorPorId(
    input.recibidoPorId
  );

  if (!recibidoPor) {
    throw new NotFoundError("Colaborador receptor no encontrado.");
  }

  const estadoAsignado = await obtenerEstadoObligatorio("ASIGNADO");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const anterior = await obtenerDispositivoPorCodigo(
      codigoInventario,
      client
    );

    if (!anterior) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    const actualizado = await asignarDispositivoADepartamento(
      codigoInventario,
      input.departamentoId,
      input.recibidoPorId,
      estadoAsignado.id,
      input.localidad,
      input.ubicacionDetalle,
      client
    );

    if (!actualizado) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    await insertarHistorialDispositivo(
      actualizado.dispositivo_id,
      "ASIGNAR_DEPARTAMENTO",
      anterior.estado_id,
      estadoAsignado.id,
      input.responsable,
      input.observaciones,
      {
        departamentoId: input.departamentoId,
        recibidoPorId: input.recibidoPorId
      },
      client
    );

    await client.query("COMMIT");

    return mapDispositivo(actualizado);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    client.release();
  }
};

export const devolverDispositivoExistente = async (
  codigoInventario: number,
  input: DevolverDispositivoInput
): Promise<DispositivoResumen> => {
  const estadoRetenido = await obtenerEstadoObligatorio(
    "RETENIDO_REVISION"
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const anterior = await obtenerDispositivoPorCodigo(
      codigoInventario,
      client
    );

    if (!anterior) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    const actualizado = await devolverDispositivo(
      codigoInventario,
      estadoRetenido.id,
      client
    );

    if (!actualizado) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    await insertarHistorialDispositivo(
      actualizado.dispositivo_id,
      "DEVOLVER_DISPOSITIVO",
      anterior.estado_id,
      estadoRetenido.id,
      input.responsable,
      input.observaciones,
      {},
      client
    );

    await client.query("COMMIT");

    return mapDispositivo(actualizado);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    client.release();
  }
};

export const cambiarEstadoDispositivoExistente = async (
  codigoInventario: number,
  input: CambiarEstadoDispositivoInput
): Promise<DispositivoResumen> => {
  const estado = await obtenerEstadoDispositivoPorId(input.estadoId);

  if (!estado) {
    throw new NotFoundError(
      "Estado de dispositivo no encontrado o inactivo."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const anterior = await obtenerDispositivoPorCodigo(
      codigoInventario,
      client
    );

    if (!anterior) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    const actualizado = await cambiarEstadoDispositivo(
      codigoInventario,
      input.estadoId,
      client
    );

    if (!actualizado) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    await insertarHistorialDispositivo(
      actualizado.dispositivo_id,
      "CAMBIAR_ESTADO",
      anterior.estado_id,
      estado.id,
      input.responsable,
      input.observaciones,
      {
        estadoCodigo: estado.codigo
      },
      client
    );

    await client.query("COMMIT");

    return mapDispositivo(actualizado);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    client.release();
  }
};

export const obtenerHistorialDispositivo = async (
  codigoInventario: number
): Promise<HistorialDispositivo[]> => {
  const dispositivo = await obtenerDispositivoPorCodigo(
    codigoInventario
  );

  if (!dispositivo) {
    throw new NotFoundError("Dispositivo no encontrado.");
  }

  const rows = await listarHistorialDispositivo(codigoInventario);

  return rows.map(mapHistorial);
};
