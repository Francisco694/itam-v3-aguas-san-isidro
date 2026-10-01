import { pool } from "../../config/database";
import type { PoolClient } from "pg";
import { obtenerColaboradorPorId } from "../colaboradores/colaboradores.repository";
import { insertarHistorialDispositivo, obtenerDispositivoPorCodigo } from "../dispositivos/dispositivos.repository";
import { generateInventoryCode } from "../inventory-codes/inventory-code.service";
import { toIsoDate, toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
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
  existeOtraSimOperableConNumero,
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
import { tipoDispositivoPermiteSim } from "../tipos-dispositivo/tipos-dispositivo.types";
import { normalizarNumeroTelefonicoChileno } from "./sim-phone";
import { vincularLineaMovil, vincularLineaMovilADispositivo } from "../lineas-moviles/lineas-moviles.service";
import { actualizarVinculosLinea } from "../lineas-moviles/lineas-moviles.repository";

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
  numeroAsociado: row.linea_numero_telefonico ?? row.numero_asociado,
  lineaMovil: row.linea_movil_id && row.linea_numero_telefonico && row.linea_estado
    ? { id: row.linea_movil_id, numeroTelefonico: row.linea_numero_telefonico, estado: row.linea_estado }
    : null,
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

const validarSimOperable = (sim: SimRow): void => {
  if (!estadosSimOperables.includes(sim.estado_codigo)) {
    throw new ConflictError(
      `La SIM se encuentra en estado ${sim.estado_codigo}; requiere un cambio de estado explícito antes de esta operación.`
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

    const numeroAsociado = input.numeroAsociado?.trim()
      ? normalizarNumeroTelefonicoChileno(input.numeroAsociado)
      : null;
    if (
      numeroAsociado
      && await existeOtraSimOperableConNumero(numeroAsociado, null, client)
    ) {
      throw new ConflictError(
        "El número telefónico ya está registrado en otra SIM activa."
      );
    }
    const inputNormalizado: CrearSimInput = { ...input, numeroAsociado };

    const codigoInventario = await generateInventoryCode(
      "SIM",
      null,
      client
    );
    let sim = await crearSim(
      inputNormalizado,
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

    if (numeroAsociado) {
      const vinculacion = await vincularLineaMovil(
        {
          numeroTelefonico: numeroAsociado,
          sim,
          dispositivoId: null,
          colaboradorId: null,
          responsable: input.responsable,
          observaciones: input.observaciones
        },
        client
      );
      await insertarHistorialSim(
        sim.sim_id,
        "LINEA_MOVIL_ASOCIADA_A_SIM",
        estadoDisponible.id,
        estadoDisponible.id,
        input.responsable,
        input.observaciones,
        {
          lineaMovilId: vinculacion.linea.id,
          numeroTelefonico: vinculacion.linea.numero_telefonico,
          descripcion: "Línea móvil asociada al registrar la SIM física."
        },
        client
      );
      sim = await obtenerSimPorCodigo(codigoInventario, client) ?? sim;
    }

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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const actual = await obtenerSimPorCodigo(codigoInventario, client, true);

    if (!actual) {
      throw new NotFoundError("SIM no encontrada.");
    }

    const inputNormalizado: ActualizarSimInput = { ...input };
    if (input.numeroAsociado !== undefined) {
      const numeroIngresado = input.numeroAsociado?.trim() || null;
      if (!numeroIngresado && (actual.dispositivo_id || actual.linea_movil_id)) {
        throw new ValidationError(
          "La línea móvil debe conservarse o reasignarse mediante un flujo explícito."
        );
      }

      inputNormalizado.numeroAsociado = numeroIngresado
        ? normalizarNumeroTelefonicoChileno(numeroIngresado)
        : null;
      if (
        inputNormalizado.numeroAsociado
        && await existeOtraSimOperableConNumero(
          inputNormalizado.numeroAsociado,
          actual.sim_id,
          client
        )
      ) {
        throw new ConflictError(
          "El número telefónico ya está registrado en otra SIM activa."
        );
      }
    }

    let sim = await actualizarSim(codigoInventario, inputNormalizado, client);

    if (!sim) {
      throw new NotFoundError("SIM no encontrada.");
    }

    if (inputNormalizado.numeroAsociado) {
      const vinculacion = await vincularLineaMovil(
        {
          numeroTelefonico: inputNormalizado.numeroAsociado,
          sim: actual,
          dispositivoId: actual.dispositivo_id,
          colaboradorId: actual.colaborador_id,
          responsable: "Actualización de ficha SIM",
          observaciones: input.observaciones
        },
        client
      );
      await insertarHistorialSim(
        actual.sim_id,
        "NUMERO_TELEFONICO_REGISTRADO",
        actual.estado_id,
        actual.estado_id,
        "Actualización de ficha SIM",
        input.observaciones,
        {
          lineaMovilId: vinculacion.linea.id,
          numeroAnterior: actual.linea_numero_telefonico ?? actual.numero_asociado,
          numeroTelefonico: vinculacion.linea.numero_telefonico,
          descripcion: "Número telefónico actualizado en la línea móvil asociada."
        },
        client
      );
      sim = await obtenerSimPorCodigo(codigoInventario, client) ?? sim;
    }

    await client.query("COMMIT");
    return mapSim(sim);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorSim(error);
  } finally {
    client.release();
  }
};

export const asociarDispositivo = async (
  codigoInventario: number,
  input: AsociarDispositivoInput
): Promise<SimResumen> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sim = await obtenerSimPorCodigo(codigoInventario, client, true);

    if (!sim) {
      throw new NotFoundError("SIM no encontrada.");
    }

    validarSimOperable(sim);

    if (sim.dispositivo_id) {
      throw new ConflictError(
        "La SIM ya está asociada a un dispositivo."
      );
    }

    const dispositivo = await obtenerDispositivoPorCodigo(
      input.dispositivoCodigoInventario,
      client,
      true
    );

    if (!dispositivo) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }
    if (!tipoDispositivoPermiteSim(
      dispositivo.tipo_dispositivo_nombre,
      dispositivo.tipo_dispositivo_configuracion_formulario
    )) {
      throw new ValidationError("El tipo de dispositivo no está configurado para llevar SIM.");
    }
    const numeroIngresado = input.numeroAsociado?.trim()
      || sim.numero_asociado?.trim()
      || null;
    if (!numeroIngresado) {
      throw new ValidationError("El número telefónico es obligatorio para la SIM seleccionada.");
    }
    const numeroAsociado = normalizarNumeroTelefonicoChileno(numeroIngresado);

    const simDelDispositivo = await obtenerSimPorDispositivoId(
      dispositivo.dispositivo_id,
      client
    );

    if (await existeOtraSimOperableConNumero(
      numeroAsociado,
      sim.sim_id,
      client,
      input.reemplazarSimActual ? simDelDispositivo?.sim_id ?? null : null
    )) {
      throw new ConflictError(
        "El número telefónico ya está registrado en otra SIM activa."
      );
    }

    if (simDelDispositivo && !input.reemplazarSimActual) {
      throw new ConflictError(
        "El dispositivo ya tiene una SIM asociada."
      );
    }
    if (simDelDispositivo?.sim_id === sim.sim_id) {
      throw new ConflictError("La SIM seleccionada ya está asociada a este Smartphone.");
    }

    const linea = await vincularLineaMovilADispositivo(
      numeroAsociado,
      dispositivo.dispositivo_id,
      input.dispositivoCodigoInventario,
      dispositivo.colaborador_id,
      input.responsable,
      input.observaciones,
      client,
      sim
    );

    let simAnteriorReemplazada: SimRow | null = null;
    if (simDelDispositivo) {
      const desasociadaAnterior = await desasociarSimDeDispositivo(
        simDelDispositivo.sim_codigo_inventario,
        client
      );
      if (!desasociadaAnterior) throw new NotFoundError("SIM anterior no encontrada.");
      simAnteriorReemplazada = await aplicarEstadoAutomatico(
        desasociadaAnterior,
        "REEMPLAZADA",
        client
      );
    }

    const asociada = await asociarSimADispositivo(
      codigoInventario,
      dispositivo.dispositivo_id,
      client,
      numeroAsociado
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
      "SIM_ASOCIADA",
      sim.estado_id,
      actualizada.estado_id,
      input.responsable,
      input.observaciones,
      {
        dispositivoCodigoInventario:
          input.dispositivoCodigoInventario,
        lineaMovilId: linea.linea.id,
        numeroAsociado: actualizada.numero_asociado,
        estadoAutomatico: actualizada.estado_codigo,
        descripcion: "SIM asociada al smartphone con número telefónico registrado."
      },
      client
    );

    await insertarHistorialSim(
      actualizada.sim_id,
      "NUMERO_TELEFONICO_REGISTRADO",
      actualizada.estado_id,
      actualizada.estado_id,
      input.responsable,
      input.observaciones,
      {
        numeroAnterior: sim.numero_asociado,
        numeroTelefonico: actualizada.numero_asociado,
        descripcion: "Número telefónico registrado o actualizado en la SIM."
      },
      client
    );

    await insertarHistorialDispositivo(
      dispositivo.dispositivo_id,
      "SIM_ASOCIADA_A_DISPOSITIVO",
      dispositivo.estado_id,
      dispositivo.estado_id,
      input.responsable,
      input.observaciones,
      {
        simCodigoInventario: actualizada.sim_codigo_inventario,
        lineaMovilId: linea.linea.id,
        numeroAsociado: actualizada.numero_asociado,
        descripcion: "SIM asociada al smartphone con número telefónico registrado."
      },
      client
    );

    if (simDelDispositivo && simAnteriorReemplazada) {
      await insertarHistorialSim(
        simAnteriorReemplazada.sim_id,
        "SIM_REEMPLAZADA",
        simDelDispositivo.estado_id,
        simAnteriorReemplazada.estado_id,
        input.responsable,
        input.observaciones,
        {
          dispositivoCodigoInventario: input.dispositivoCodigoInventario,
          simNuevaCodigoInventario: actualizada.sim_codigo_inventario,
          lineaMovilId: linea.linea.id,
          descripcion: "SIM física reemplazada conservando la línea móvil del Smartphone."
        },
        client
      );
    }

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

    if (sim.linea_movil_id) {
      await actualizarVinculosLinea(
        sim.linea_movil_id,
        null,
        desasociada.colaborador_id,
        client
      );
    }

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
    if (sim.linea_movil_id) {
      await actualizarVinculosLinea(
        sim.linea_movil_id,
        asignada.dispositivo_id,
        String(input.colaboradorId),
        client
      );
    }

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
    if (sim.linea_movil_id) {
      await actualizarVinculosLinea(
        sim.linea_movil_id,
        desasignada.dispositivo_id,
        null,
        client
      );
    }

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
