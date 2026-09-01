import { pool } from "../../config/database";
import type { PoolClient } from "pg";
import { obtenerColaboradorPorId } from "../colaboradores/colaboradores.repository";
import { obtenerDispositivoPorCodigo } from "../dispositivos/dispositivos.repository";
import { generateInventoryCode } from "../inventory-codes/inventory-code.service";
import {
  cerrarAsociacionSimDispositivo,
  cerrarCustodiaSim,
  crearAsociacionSimDispositivo,
  crearCustodiaSim,
  obtenerAsociacionVigenteDispositivo,
  obtenerAsociacionVigenteSim,
  obtenerCustodiaVigenteSim
} from "../custodias/custodias.repository";
import { toIsoDate, toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  isDatabaseBusinessRuleViolation,
  isForeignKeyViolation,
  isUniqueViolation
} from "../../shared/errors";
import {
  actualizarSim,
  asociarSimADispositivo,
  asignarSimAColaborador,
  cambiarEstadoSim,
  crearSim,
  desasignarSimDeColaborador,
  desasociarSimDeDispositivo,
  insertarHistorialSim,
  listarHistorialSim,
  listarSim,
  obtenerEstadoSimPorCodigo,
  obtenerEstadoSimPorId,
  obtenerSimPorCodigo,
  obtenerSimPorDispositivoId
} from "./sim.repository";
import type {
  ActualizarSimInput,
  AsociarDispositivoInput,
  AsignarColaboradorSimInput,
  CambiarEstadoSimInput,
  ColaboradorResumen,
  CrearSimInput,
  DispositivoResumen,
  HistorialSim,
  HistorialSimRow,
  ResponsableInput,
  SimResumen,
  SimRow
} from "./sim.types";

const estadoSimAsignada = "ASIGNADA";
const estadoSimDisponible = "DISPONIBLE";
const estadosSimOperables = [
  estadoSimAsignada,
  estadoSimDisponible
];

const mapEstado = (
  id: string,
  codigo: string,
  nombre: string
) => ({
  id,
  codigo,
  nombre
});

const mapColaborador = (
  row: SimRow
): ColaboradorResumen | null => {
  if (
    !row.colaborador_id ||
    !row.colaborador_rut ||
    !row.colaborador_nombre
  ) {
    return null;
  }

  return {
    id: row.colaborador_id,
    rut: row.colaborador_rut,
    nombre: row.colaborador_nombre,
    cargo: row.colaborador_cargo
  };
};

const mapDispositivo = (
  row: SimRow
): DispositivoResumen | null => {
  if (
    !row.dispositivo_id ||
    row.dispositivo_codigo_inventario === null ||
    !row.tipo_dispositivo
  ) {
    return null;
  }

  return {
    id: row.dispositivo_id,
    codigoInventario: row.dispositivo_codigo_inventario,
    tipoDispositivo: row.tipo_dispositivo,
    marca: row.dispositivo_marca,
    modelo: row.dispositivo_modelo,
    estado:
      row.dispositivo_estado_id &&
      row.dispositivo_estado_codigo &&
      row.dispositivo_estado_nombre
        ? mapEstado(
            row.dispositivo_estado_id,
            row.dispositivo_estado_codigo,
            row.dispositivo_estado_nombre
          )
        : null
  };
};

const mapSim = (row: SimRow): SimResumen => ({
  id: row.sim_id,
  codigoInventario: row.sim_codigo_inventario,
  iccidCodigoFabrica: row.iccid_codigo_fabrica,
  numeroAsociado: row.numero_asociado,
  compania: row.compania,
  estado: mapEstado(
    row.estado_id,
    row.estado_codigo,
    row.estado_nombre
  ),
  colaborador: mapColaborador(row),
  dispositivo: mapDispositivo(row),
  observaciones: row.observaciones,
  fechaRegistro: toIsoDate(row.fecha_registro),
  creadoEn: toIsoDateTime(row.creado_en),
  actualizadoEn: toIsoDateTime(row.actualizado_en)
});

const mapHistorial = (row: HistorialSimRow): HistorialSim => ({
  id: row.id,
  tipoEntidad: row.tipo_entidad,
  simId: row.sim_id,
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

const normalizarErrorSim = (error: unknown): never => {
  if (isUniqueViolation(error)) {
    throw new ConflictError(
      "Ya existe un recurso con alguno de los identificadores informados."
    );
  }

  if (isForeignKeyViolation(error)) {
    throw new ConflictError(
      "La operaciÃ³n referencia un recurso que no existe o no es vÃ¡lido."
    );
  }

  if (isDatabaseBusinessRuleViolation(error)) {
    throw new ConflictError(
      "La operaciÃ³n viola una regla de negocio del inventario."
    );
  }

  throw error;
};

const validarSimOperable = (sim: SimRow): void => {
  if (!estadosSimOperables.includes(sim.estado_codigo)) {
    throw new ConflictError(
      `La SIM se encuentra en estado ${sim.estado_codigo}; requiere un cambio de estado explÃ­cito antes de esta operaciÃ³n.`
    );
  }
};

const obtenerEstadoSimObligatorio = async (
  codigo: string,
  client: PoolClient
) => {
  const estado = await obtenerEstadoSimPorCodigo(codigo, client);

  if (!estado) {
    throw new ConflictError(
      `No existe un estado ${codigo} activo para SIM.`
    );
  }

  return estado;
};

const aplicarEstadoAutomatico = async (
  sim: SimRow,
  estadoCodigo: string,
  client: PoolClient
): Promise<SimRow> => {
  if (sim.estado_codigo === estadoCodigo) {
    return sim;
  }

  const estado = await obtenerEstadoSimObligatorio(
    estadoCodigo,
    client
  );

  const actualizada = await cambiarEstadoSim(
    sim.sim_codigo_inventario,
    estado.id,
    client
  );

  if (!actualizada) {
    throw new NotFoundError("SIM no encontrada.");
  }

  return actualizada;
};

export const obtenerSims = async (): Promise<SimResumen[]> => {
  const rows = await listarSim();

  return rows.map(mapSim);
};

export const obtenerSim = async (
  codigoInventario: number
): Promise<SimResumen> => {
  const sim = await obtenerSimPorCodigo(codigoInventario);

  if (!sim) {
    throw new NotFoundError("SIM no encontrada.");
  }

  return mapSim(sim);
};

export const crearNuevaSim = async (
  input: CrearSimInput
): Promise<SimResumen> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const estadoDisponible = await obtenerEstadoSimPorCodigo(
      "DISPONIBLE",
      client
    );

    if (!estadoDisponible) {
      throw new ConflictError(
        "No existe un estado DISPONIBLE activo para SIM."
      );
    }

    const codigoInventario = await generateInventoryCode(
      "SIM",
      null,
      client
    );
    const sim = await crearSim(
      input,
      codigoInventario,
      estadoDisponible.id,
      client
    );

    await insertarHistorialSim(
      sim.sim_id,
      "ALTA_SIM",
      null,
      estadoDisponible.id,
      input.responsable,
      input.observaciones,
      {
        codigoInventario,
        iccidCodigoFabrica: input.iccidCodigoFabrica
      },
      client
    );

    await client.query("COMMIT");

    return mapSim(sim);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorSim(error);
  } finally {
    client.release();
  }
};

export const actualizarSimExistente = async (
  codigoInventario: number,
  input: ActualizarSimInput
): Promise<SimResumen> => {
  try {
    const sim = await actualizarSim(codigoInventario, input);

    if (!sim) {
      throw new NotFoundError("SIM no encontrada.");
    }

    return mapSim(sim);
  } catch (error) {
    return normalizarErrorSim(error);
  }
};

export const asociarDispositivo = async (
  codigoInventario: number,
  input: AsociarDispositivoInput
): Promise<SimResumen> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sim = await obtenerSimPorCodigo(codigoInventario, client);

    if (!sim) {
      throw new NotFoundError("SIM no encontrada.");
    }

    validarSimOperable(sim);

    if (sim.dispositivo_id) {
      throw new ConflictError(
        "La SIM ya estÃ¡ asociada a un dispositivo."
      );
    }

    const dispositivo = await obtenerDispositivoPorCodigo(
      input.dispositivoCodigoInventario,
      client
    );

    if (!dispositivo) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    const simDelDispositivo = await obtenerSimPorDispositivoId(
      dispositivo.dispositivo_id,
      client
    );

    if (simDelDispositivo) {
      throw new ConflictError(
        "El dispositivo ya tiene una SIM asociada."
      );
    }

    const asociacionDispositivo = await obtenerAsociacionVigenteDispositivo(
      dispositivo.dispositivo_id,
      client
    );
    if (asociacionDispositivo) {
      throw new ConflictError("El dispositivo ya tiene una SIM asociada.");
    }
    await crearAsociacionSimDispositivo(
      sim.sim_id,
      dispositivo.dispositivo_id,
      { responsable: input.responsable },
      client
    );

    const asociada = await asociarSimADispositivo(
      codigoInventario,
      dispositivo.dispositivo_id,
      client
    );

    if (!asociada) {
      throw new NotFoundError("SIM no encontrada.");
    }

    const actualizada = await aplicarEstadoAutomatico(
      asociada,
      estadoSimAsignada,
      client
    );

    await insertarHistorialSim(
      actualizada.sim_id,
      "ASOCIAR_DISPOSITIVO",
      sim.estado_id,
      actualizada.estado_id,
      input.responsable,
      input.observaciones,
      {
        dispositivoCodigoInventario:
          input.dispositivoCodigoInventario,
        estadoAutomatico: actualizada.estado_codigo
      },
      client
    );

    await client.query("COMMIT");

    return mapSim(actualizada);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorSim(error);
  } finally {
    client.release();
  }
};

export const desasociarDispositivo = async (
  codigoInventario: number,
  input: ResponsableInput
): Promise<SimResumen> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sim = await obtenerSimPorCodigo(codigoInventario, client);

    if (!sim) {
      throw new NotFoundError("SIM no encontrada.");
    }

    validarSimOperable(sim);

    const asociacionVigente = await obtenerAsociacionVigenteSim(
      sim.sim_id,
      client,
      true
    );
    if (!asociacionVigente) {
      throw new ConflictError("La SIM no tiene una asociacion vigente.");
    }
    await cerrarAsociacionSimDispositivo(
      asociacionVigente.id,
      { responsable: input.responsable, motivo: "DESASOCIACION" },
      client
    );

    const desasociada = await desasociarSimDeDispositivo(
      codigoInventario,
      client
    );

    if (!desasociada) {
      throw new NotFoundError("SIM no encontrada.");
    }

    const estadoObjetivo = desasociada.colaborador_id
      ? estadoSimAsignada
      : estadoSimDisponible;
    const actualizada = await aplicarEstadoAutomatico(
      desasociada,
      estadoObjetivo,
      client
    );

    await insertarHistorialSim(
      actualizada.sim_id,
      "DESASOCIAR_DISPOSITIVO",
      sim.estado_id,
      actualizada.estado_id,
      input.responsable,
      input.observaciones,
      {
        dispositivoAnteriorId: sim.dispositivo_id,
        estadoAutomatico: actualizada.estado_codigo
      },
      client
    );

    await client.query("COMMIT");

    return mapSim(actualizada);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorSim(error);
  } finally {
    client.release();
  }
};

export const asignarColaboradorSim = async (
  codigoInventario: number,
  input: AsignarColaboradorSimInput
): Promise<SimResumen> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const colaborador = await obtenerColaboradorPorId(input.colaboradorId, client);
    if (!colaborador) throw new NotFoundError("Colaborador no encontrado.");
    if (!colaborador.activo) {
      throw new ConflictError("No se puede asignar una SIM a un colaborador inactivo.");
    }

    const sim = await obtenerSimPorCodigo(codigoInventario, client);

    if (!sim) {
      throw new NotFoundError("SIM no encontrada.");
    }

    validarSimOperable(sim);

    const custodiaSimVigente = await obtenerCustodiaVigenteSim(
      sim.sim_id,
      client,
      true
    );
    if (custodiaSimVigente) {
      throw new ConflictError("La SIM ya tiene una custodia vigente.");
    }
    await crearCustodiaSim(
      {
        simId: sim.sim_id,
        colaboradorId: input.colaboradorId,
        tipoInicio: "ASIGNACION",
        origen: "API",
        evidencia: { responsable: input.responsable },
        nivelConfianza: "ALTA"
      },
      client
    );

    const asignada = await asignarSimAColaborador(
      codigoInventario,
      input.colaboradorId,
      client
    );

    if (!asignada) {
      throw new NotFoundError("SIM no encontrada.");
    }

    const actualizada = await aplicarEstadoAutomatico(
      asignada,
      estadoSimAsignada,
      client
    );

    await insertarHistorialSim(
      actualizada.sim_id,
      "ASIGNAR_COLABORADOR",
      sim.estado_id,
      actualizada.estado_id,
      input.responsable,
      input.observaciones,
      {
        colaboradorId: input.colaboradorId,
        estadoAutomatico: actualizada.estado_codigo
      },
      client
    );

    await client.query("COMMIT");

    return mapSim(actualizada);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorSim(error);
  } finally {
    client.release();
  }
};

export const desasignarColaboradorSim = async (
  codigoInventario: number,
  input: ResponsableInput
): Promise<SimResumen> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sim = await obtenerSimPorCodigo(codigoInventario, client);

    if (!sim) {
      throw new NotFoundError("SIM no encontrada.");
    }

    validarSimOperable(sim);

    const custodiaParaCerrar = await obtenerCustodiaVigenteSim(
      sim.sim_id,
      client,
      true
    );
    if (!custodiaParaCerrar) {
      throw new ConflictError("La SIM no tiene una custodia vigente.");
    }
    await cerrarCustodiaSim(
      custodiaParaCerrar.id,
      {
        tipoCierre: "DEVOLUCION",
        fechaFin: new Date(),
        fechaCierreRealConocida: true,
        evidencia: { responsable: input.responsable }
      },
      client
    );

    const desasignada = await desasignarSimDeColaborador(
      codigoInventario,
      client
    );

    if (!desasignada) {
      throw new NotFoundError("SIM no encontrada.");
    }

    const estadoObjetivo = desasignada.dispositivo_id
      ? estadoSimAsignada
      : estadoSimDisponible;
    const actualizada = await aplicarEstadoAutomatico(
      desasignada,
      estadoObjetivo,
      client
    );

    await insertarHistorialSim(
      actualizada.sim_id,
      "DESASIGNAR_COLABORADOR",
      sim.estado_id,
      actualizada.estado_id,
      input.responsable,
      input.observaciones,
      {
        colaboradorAnteriorId: sim.colaborador_id,
        estadoAutomatico: actualizada.estado_codigo
      },
      client
    );

    await client.query("COMMIT");

    return mapSim(actualizada);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorSim(error);
  } finally {
    client.release();
  }
};

export const cambiarEstadoSimExistente = async (
  codigoInventario: number,
  input: CambiarEstadoSimInput
): Promise<SimResumen> => {
  const estado = await obtenerEstadoSimPorId(input.estadoId);

  if (!estado) {
    throw new NotFoundError("Estado de SIM no encontrado o inactivo.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sim = await obtenerSimPorCodigo(codigoInventario, client);

    if (!sim) {
      throw new NotFoundError("SIM no encontrada.");
    }

    const actualizada = await cambiarEstadoSim(
      codigoInventario,
      input.estadoId,
      client
    );

    if (!actualizada) {
      throw new NotFoundError("SIM no encontrada.");
    }

    await insertarHistorialSim(
      actualizada.sim_id,
      "CAMBIAR_ESTADO",
      sim.estado_id,
      estado.id,
      input.responsable,
      input.observaciones,
      {
        estadoCodigo: estado.codigo
      },
      client
    );

    await client.query("COMMIT");

    return mapSim(actualizada);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorSim(error);
  } finally {
    client.release();
  }
};

export const obtenerHistorialSim = async (
  codigoInventario: number
): Promise<HistorialSim[]> => {
  const sim = await obtenerSimPorCodigo(codigoInventario);

  if (!sim) {
    throw new NotFoundError("SIM no encontrada.");
  }

  const rows = await listarHistorialSim(codigoInventario);

  return rows.map(mapHistorial);
};
