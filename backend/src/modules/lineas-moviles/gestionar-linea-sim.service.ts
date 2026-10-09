import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import {
  ConflictError,
  isUniqueViolation,
  NotFoundError,
  ValidationError
} from "../../shared/errors";
import {
  insertarHistorialDispositivo,
  obtenerDispositivoPorCodigo
} from "../dispositivos/dispositivos.repository";
import { tipoDispositivoPermiteSim } from "../tipos-dispositivo/tipos-dispositivo.types";
import {
  asociarSimADispositivo,
  asignarSimAColaborador,
  cambiarEstadoSim,
  desasociarSimDeDispositivo,
  existeOtraLineaConNumero,
  insertarHistorialSim,
  obtenerEstadoSimPorCodigo,
  obtenerSimPorCodigo,
  obtenerSimPorId
} from "../sim/sim.repository";
import { normalizarNumeroTelefonicoChileno } from "../sim/sim-phone";
import {
  actualizarNumeroLineaMovil,
  actualizarVinculosLinea,
  crearLineaMovil,
  insertarHistorialLineaMovil,
  obtenerLineaPorDispositivo,
  obtenerLineaPorId,
  obtenerLineaPorSim,
  sincronizarVinculoLineaSim
} from "./lineas-moviles.repository";
import type {
  GestionarLineaSimInput,
  GestionarLineaSimOperacion,
  GestionarLineaSimResult,
  GestionarLineaSimSnapshot
} from "./gestionar-linea-sim.types";

const operationOf = (
  mantenerSim: boolean,
  mantenerNumero: boolean
): GestionarLineaSimOperacion => {
  if (mantenerSim && mantenerNumero) return "MANTENER_SIM_MANTENER_NUMERO";
  if (mantenerSim) return "MANTENER_SIM_CAMBIAR_NUMERO";
  if (mantenerNumero) return "CAMBIAR_SIM_MANTENER_NUMERO";
  return "CAMBIAR_SIM_CAMBIAR_NUMERO";
};

const simSnapshot = (sim: Awaited<ReturnType<typeof obtenerSimPorCodigo>>): GestionarLineaSimSnapshot | null => {
  if (!sim) return null;
  return {
    id: sim.sim_id,
    codigoInventario: sim.sim_codigo_inventario,
    iccid: sim.iccid_codigo_fabrica,
    estado: sim.estado_codigo,
    dispositivoId: sim.dispositivo_id,
    lineaMovilId: sim.linea_movil_id,
    colaboradorId: sim.colaborador_id
  };
};

const validateTargetSim = (
  sim: NonNullable<Awaited<ReturnType<typeof obtenerSimPorCodigo>>>
): void => {
  if (sim.estado_codigo !== "DISPONIBLE") {
    throw new ConflictError(
      "La SIM destino debe estar en estado DISPONIBLE."
    );
  }
  if (sim.dispositivo_id !== null) {
    throw new ConflictError("La SIM destino ya está instalada en otro dispositivo.");
  }
  if (sim.colaborador_id !== null) {
    throw new ConflictError("La SIM destino ya tiene una custodia registrada.");
  }
};

const buildResult = async (
  codigoInventario: number,
  dispositivoId: string,
  operacion: GestionarLineaSimOperacion,
  numeroAnterior: string | null,
  numeroNuevo: string | null,
  simAnterior: Awaited<ReturnType<typeof obtenerSimPorCodigo>>,
  lineaId: string | null,
  simActualId: string | null,
  client: PoolClient
): Promise<GestionarLineaSimResult> => {
  const linea = lineaId ? await obtenerLineaPorId(lineaId, client) : null;
  const simActual = simActualId
    ? await obtenerSimPorId(simActualId, client)
    : null;

  return {
    operacion,
    dispositivo: { id: dispositivoId, codigoInventario },
    linea: linea
      ? {
          id: linea.id,
          numeroTelefonico: linea.numero_telefonico,
          estado: linea.estado,
          dispositivoId: linea.dispositivo_id,
          simId: linea.sim_id
        }
      : null,
    simAnterior: simSnapshot(simAnterior),
    simActual: simSnapshot(simActual),
    numeroAnterior,
    numeroNuevo
  };
};

/**
 * Ejecuta la gestión dentro de una transacción ya abierta.
 * La función no hace BEGIN/COMMIT y está pensada para pruebas y composición
 * con otras operaciones atómicas del backend.
 */
export const gestionarLineaSimEnTransaccion = async (
  codigoInventario: number,
  input: GestionarLineaSimInput,
  client: PoolClient
): Promise<GestionarLineaSimResult> => {
  const operacion = operationOf(input.mantenerSim, input.mantenerNumero);
  const dispositivo = await obtenerDispositivoPorCodigo(
    codigoInventario,
    client,
    true
  );
  if (!dispositivo) throw new NotFoundError("Dispositivo no encontrado.");

  const permiteSim = tipoDispositivoPermiteSim(
    dispositivo.tipo_dispositivo_nombre,
    dispositivo.tipo_dispositivo_configuracion_formulario,
    dispositivo.atributos_especificos
  );
  if (!permiteSim) {
    throw new ValidationError(
      "El tipo de dispositivo no está configurado para gestionar SIM."
    );
  }

  let linea = await obtenerLineaPorDispositivo(
    dispositivo.dispositivo_id,
    client,
    true
  );
  let simActual = dispositivo.sim_id
    ? await obtenerSimPorId(dispositivo.sim_id, client, true)
    : null;

  if (!simActual && linea?.sim_id) {
    simActual = await obtenerSimPorId(linea.sim_id, client, true);
  }
  if (!linea && simActual?.linea_movil_id) {
    linea = await obtenerLineaPorId(simActual.linea_movil_id, client, true);
  }

  if (linea && linea.dispositivo_id !== dispositivo.dispositivo_id) {
    throw new ConflictError(
      "La línea móvil no pertenece al dispositivo seleccionado."
    );
  }
  if (linea && simActual && linea.sim_id !== simActual.sim_id) {
    throw new ConflictError(
      "Las referencias actuales entre dispositivo, línea y SIM son inconsistentes."
    );
  }
  if (simActual && simActual.dispositivo_id !== dispositivo.dispositivo_id) {
    throw new ConflictError(
      "La SIM actual no pertenece al dispositivo seleccionado."
    );
  }

  if (input.mantenerSim && input.simDestinoCodigo !== null) {
    throw new ValidationError(
      "No informe una SIM destino cuando la operación conserva la SIM."
    );
  }
  if (!input.mantenerSim && input.simDestinoCodigo === null) {
    throw new ValidationError("Debe seleccionar una SIM destino.");
  }
  if (input.mantenerNumero && input.numeroNuevo !== null) {
    throw new ValidationError(
      "No informe un número nuevo cuando la operación conserva el número."
    );
  }
  if (!input.mantenerNumero && !input.numeroNuevo?.trim()) {
    throw new ValidationError("Debe informar el número telefónico nuevo.");
  }
  if (input.mantenerSim && !simActual) {
    throw new ConflictError("No existe una SIM actual que se pueda conservar.");
  }
  if (
    input.mantenerSim
    && simActual
    && !["DISPONIBLE", "ASIGNADA"].includes(simActual.estado_codigo)
  ) {
    throw new ConflictError(
      "La SIM actual no puede conservarse porque está en un estado terminal."
    );
  }
  // Este caso es deliberadamente de solo lectura: conservar ambas cosas no
  // debe generar eventos ni reescribir referencias ya existentes.
  if (input.mantenerSim && input.mantenerNumero) {
    return buildResult(
      codigoInventario,
      dispositivo.dispositivo_id,
      operacion,
      linea?.numero_telefonico ?? null,
      linea?.numero_telefonico ?? null,
      simActual,
      linea?.id ?? null,
      simActual?.sim_id ?? null,
      client
    );
  }

  let simDestino = simActual;
  if (!input.mantenerSim) {
    simDestino = await obtenerSimPorCodigo(input.simDestinoCodigo!, client, true);
    if (!simDestino) throw new NotFoundError("SIM destino no encontrada.");
    validateTargetSim(simDestino);

    const lineaSimDestino = await obtenerLineaPorSim(simDestino.sim_id, client, true);
    if (lineaSimDestino) {
      if (lineaSimDestino.sim_id !== simDestino.sim_id) {
        throw new ConflictError("La línea existente de la SIM destino tiene referencias inconsistentes.");
      }
      if (lineaSimDestino.estado !== "ACTIVA") {
        throw new ConflictError("La línea existente de la SIM destino no está activa.");
      }
      if (lineaSimDestino.dispositivo_id && lineaSimDestino.dispositivo_id !== dispositivo.dispositivo_id) {
        throw new ConflictError("La línea de la SIM destino ya está asociada a otro equipo.");
      }
      if (lineaSimDestino.colaborador_id && lineaSimDestino.colaborador_id !== dispositivo.colaborador_id) {
        throw new ConflictError("La línea de la SIM destino ya está asociada a otro colaborador.");
      }
      if (linea && linea.id !== lineaSimDestino.id) {
        throw new ConflictError("El dispositivo y la SIM destino tienen números distintos; elija un número explícitamente.");
      }
      linea ??= lineaSimDestino;
    }

    const activeTargetRelation = await client.query<{ id: string }>(
      `SELECT id FROM itam.lineas_moviles_sim_historial
        WHERE sim_id = $1 AND fecha_fin IS NULL
          AND ($2::bigint IS NULL OR linea_movil_id <> $2)
        LIMIT 1`,
      [simDestino.sim_id, lineaSimDestino?.id ?? null]
    );
    if (activeTargetRelation.rows[0]) {
      throw new ConflictError("La SIM destino ya tiene una asociación histórica activa.");
    }
  }

  if (input.mantenerNumero && !linea && !input.mantenerSim) {
    // Una SIM puede instalarse antes de registrar su número telefónico.
    if (!simDestino || simDestino.linea_movil_id) {
      throw new ConflictError("No se pudo confirmar que la SIM destino esté libre de línea móvil.");
    }
  } else if (input.mantenerNumero && !linea) {
    throw new ConflictError("El dispositivo no tiene una línea móvil vigente.");
  }

  const numeroAnterior = linea?.numero_telefonico ?? null;
  const numeroNuevo = input.mantenerNumero
    ? numeroAnterior
    : normalizarNumeroTelefonicoChileno(input.numeroNuevo!);

  if (!linea && !input.mantenerSim && input.mantenerNumero) {
    const estadoSimAnterior = simActual?.estado_id ?? null;
    const estadoSimAsignada = await obtenerEstadoSimPorCodigo("ASIGNADA", client);
    if (!estadoSimAsignada) throw new ConflictError("No existe un estado ASIGNADA activo para SIM.");
    const detalle = {
      dispositivoCodigoInventario: codigoInventario,
      lineaMovilId: null,
      numeroAnterior: null,
      numeroNuevo: null,
      simAnteriorCodigoInventario: simActual?.sim_codigo_inventario ?? null,
      simNuevaCodigoInventario: simDestino!.sim_codigo_inventario,
      operacion
    };

    if (simActual) {
      await desasociarSimDeDispositivo(simActual.sim_codigo_inventario, client);
      await insertarHistorialSim(simActual.sim_id, "DESASOCIAR_SIM_GESTION_ATOMICA", estadoSimAnterior, estadoSimAnterior, input.responsable, input.observaciones, detalle, client);
    }
    const asociada = await asociarSimADispositivo(simDestino!.sim_codigo_inventario, dispositivo.dispositivo_id, client);
    if (!asociada) throw new NotFoundError("SIM destino no encontrada.");
    if (dispositivo.colaborador_id) {
      await asignarSimAColaborador(simDestino!.sim_codigo_inventario, Number(dispositivo.colaborador_id), client);
    }
    const actualizada = await cambiarEstadoSim(simDestino!.sim_codigo_inventario, estadoSimAsignada.id, client);
    if (!actualizada) throw new NotFoundError("SIM destino no encontrada.");

    await insertarHistorialSim(simDestino!.sim_id, "ASOCIAR_SIM_GESTION_ATOMICA", simDestino!.estado_id, estadoSimAsignada.id, input.responsable, input.observaciones, detalle, client);
    await insertarHistorialDispositivo(dispositivo.dispositivo_id, "GESTION_LINEA_SIM_ATOMICA", dispositivo.estado_id, dispositivo.estado_id, input.responsable, input.observaciones, detalle, client);
    return buildResult(codigoInventario, dispositivo.dispositivo_id, operacion, null, null, simActual, null, simDestino!.sim_id, client);
  }
  if (!input.mantenerNumero) {
    const numeroDuplicado = await existeOtraLineaConNumero(
      numeroNuevo!,
      simActual?.sim_id ?? null,
      client,
      simDestino?.sim_id ?? null,
      dispositivo.dispositivo_id
    );
    if (numeroDuplicado) {
      throw new ConflictError(
        "El número telefónico ya está registrado en otra línea activa."
      );
    }
  }

  const lineaCreada = !linea;
  if (lineaCreada) {
    if (!numeroNuevo || !simDestino) {
      throw new ConflictError("No se puede crear una línea sin número y SIM asociada.");
    }
    linea = await crearLineaMovil(
      numeroNuevo,
      dispositivo.colaborador_id,
      dispositivo.dispositivo_id,
      simDestino.sim_id,
      client
    );
  }

  if (!linea) throw new ConflictError("No se pudo confirmar la línea móvil.");
  const estadoSimAnterior = simActual?.estado_id ?? null;
  const estadoSimDestinoAnterior = simDestino?.estado_id ?? null;
  const detalleBase = {
    dispositivoCodigoInventario: codigoInventario,
    lineaMovilId: linea.id,
    numeroAnterior,
    numeroNuevo,
    simAnteriorCodigoInventario: simActual?.sim_codigo_inventario ?? null,
    simNuevaCodigoInventario: simDestino?.sim_codigo_inventario ?? null,
    operacion
  };

  if (!input.mantenerNumero && numeroNuevo !== numeroAnterior && !lineaCreada) {
    await actualizarNumeroLineaMovil(linea.id, numeroNuevo!, client);
    await insertarHistorialLineaMovil(
      linea.id,
      "NUMERO_TELEFONICO_ACTUALIZADO_ATOMICO",
      input.responsable,
      input.observaciones,
      detalleBase,
      client
    );
  }

  if (!input.mantenerSim) {
    if (simActual) {
      await desasociarSimDeDispositivo(
        simActual.sim_codigo_inventario,
        client
      );
    }

    await sincronizarVinculoLineaSim(
      linea.id,
      simDestino!.sim_id,
      "GESTION_ATOMICA_SIM_LINEA",
      client,
      simActual?.sim_id ?? null
    );
    if (linea.dispositivo_id !== dispositivo.dispositivo_id || linea.colaborador_id !== dispositivo.colaborador_id) {
      await actualizarVinculosLinea(linea.id, dispositivo.dispositivo_id, dispositivo.colaborador_id, client);
    }
    await asociarSimADispositivo(
      simDestino!.sim_codigo_inventario,
      dispositivo.dispositivo_id,
      client
    );

    const estadoAsignada = await obtenerEstadoSimPorCodigo("ASIGNADA", client);
    if (!estadoAsignada) {
      throw new ConflictError("No existe un estado ASIGNADA activo para SIM.");
    }
    if (dispositivo.colaborador_id) {
      await asignarSimAColaborador(
        simDestino!.sim_codigo_inventario,
        Number(dispositivo.colaborador_id),
        client
      );
      if (simDestino!.estado_codigo !== "ASIGNADA") {
        await cambiarEstadoSim(
          simDestino!.sim_codigo_inventario,
          estadoAsignada.id,
          client
        );
      }
    }

    if (simActual) {
      await insertarHistorialSim(
        simActual.sim_id,
        "DESASOCIAR_SIM_GESTION_ATOMICA",
        estadoSimAnterior,
        estadoSimAnterior,
        input.responsable,
        input.observaciones,
        detalleBase,
        client
      );
    }
    await insertarHistorialSim(
      simDestino!.sim_id,
      "ASOCIAR_SIM_GESTION_ATOMICA",
      estadoSimDestinoAnterior,
      estadoAsignada.id,
      input.responsable,
      input.observaciones,
      detalleBase,
      client
    );
    await insertarHistorialLineaMovil(
      linea.id,
      "SIM_ASOCIADA_GESTION_ATOMICA",
      input.responsable,
      input.observaciones,
      detalleBase,
      client
    );
  } else if (!input.mantenerNumero) {
    // Aun sin cambiar de SIM, se actualiza el espejo legacy para que las
    // lecturas antiguas sigan mostrando el número actual durante la transición.
    await sincronizarVinculoLineaSim(
      linea.id,
      simActual!.sim_id,
      "ACTUALIZACION_NUMERO_GESTION_ATOMICA",
      client
    );
    await insertarHistorialSim(
      simActual!.sim_id,
      "NUMERO_TELEFONICO_ACTUALIZADO_ATOMICO",
      estadoSimAnterior,
      estadoSimAnterior,
      input.responsable,
      input.observaciones,
      detalleBase,
      client
    );
  }

  await insertarHistorialDispositivo(
    dispositivo.dispositivo_id,
    "GESTION_LINEA_SIM_ATOMICA",
    dispositivo.estado_id,
    dispositivo.estado_id,
    input.responsable,
    input.observaciones,
    detalleBase,
    client
  );

  const result = await buildResult(
    codigoInventario,
    dispositivo.dispositivo_id,
    operacion,
    numeroAnterior,
    numeroNuevo,
    simActual,
    linea.id,
    simDestino?.sim_id ?? null,
    client
  );
  return result;
};

export const gestionarLineaSim = async (
  codigoInventario: number,
  input: GestionarLineaSimInput
): Promise<GestionarLineaSimResult> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await gestionarLineaSimEnTransaccion(
      codigoInventario,
      input,
      client
    );
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "La operación no pudo completarse porque la SIM o el número ya está en uso."
      );
    }
    throw error;
  } finally {
    client.release();
  }
};
