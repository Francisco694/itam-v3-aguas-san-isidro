import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { ConflictError, NotFoundError, ValidationError, isUniqueViolation } from "../../shared/errors";
import { insertarHistorialDispositivo, obtenerDispositivoPorCodigo } from "../dispositivos/dispositivos.repository";
import { tipoDispositivoPermiteSim } from "../tipos-dispositivo/tipos-dispositivo.types";
import { crearSimEnTransaccion } from "../sim/sim.service";
import {
  asociarSimADispositivo,
  desasociarSimDeDispositivo,
  insertarHistorialSim,
  obtenerEstadoSimPorCodigo,
  obtenerSimPorId
} from "../sim/sim.repository";
import { normalizarNumeroTelefonicoChileno } from "../sim/sim-phone";
import {
  actualizarVinculosLinea,
  crearLineaMovil,
  desasociarVinculoLineaSim,
  insertarHistorialLineaMovil,
  obtenerLineaPorDispositivo,
  obtenerLineaPorId,
  obtenerLineaPorNumero,
  sincronizarVinculoLineaSim
} from "./lineas-moviles.repository";
import type { LineaMovilRow } from "./lineas-moviles.types";
import type { RegistrarSimNuevaInput, RegistrarSimNuevaResult } from "./registrar-sim-linea.types";

const estadosLineaOperables = ["ACTIVA"] as const;

const validarLineaObjetivo = (
  linea: LineaMovilRow,
  dispositivoId: string,
  colaboradorId: string | null,
  simAnteriorId: string | null
): void => {
  if (!estadosLineaOperables.includes(linea.estado as (typeof estadosLineaOperables)[number])) {
    throw new ConflictError(`La línea está en estado ${linea.estado} y no puede reutilizarse automáticamente.`);
  }
  if (linea.dispositivo_id && linea.dispositivo_id !== dispositivoId) {
    throw new ConflictError("La línea ya pertenece a otro dispositivo.");
  }
  if (linea.colaborador_id && linea.colaborador_id !== colaboradorId) {
    throw new ConflictError("La línea ya pertenece a otro colaborador.");
  }
  if (linea.sim_id && linea.sim_id !== simAnteriorId) {
    throw new ConflictError("La línea ya está asociada a otra SIM.");
  }
};

const limpiarLineaAnterior = async (
  linea: LineaMovilRow,
  simAnteriorId: string | null,
  dispositivoId: string,
  responsable: string,
  observaciones: string | null | undefined,
  client: PoolClient
): Promise<void> => {
  if (simAnteriorId && linea.sim_id === simAnteriorId) {
    await desasociarVinculoLineaSim(linea.id, simAnteriorId, client);
  }
  await actualizarVinculosLinea(linea.id, null, null, client);
  await insertarHistorialLineaMovil(
    linea.id,
    "LINEA_DESASOCIADA_POR_SIM_NUEVA",
    responsable,
    observaciones,
    { dispositivoId, simAnteriorId, numeroTelefonico: linea.numero_telefonico },
    client
  );
};

export const registrarSimNuevaEnTransaccion = async (
  codigoInventario: number,
  input: RegistrarSimNuevaInput,
  client: PoolClient
): Promise<RegistrarSimNuevaResult> => {
    const dispositivo = await obtenerDispositivoPorCodigo(codigoInventario, client, true);
    if (!dispositivo) throw new NotFoundError("Dispositivo no encontrado.");
    if (!tipoDispositivoPermiteSim(dispositivo.tipo_dispositivo_nombre, dispositivo.tipo_dispositivo_configuracion_formulario)) {
      throw new ValidationError("El tipo de dispositivo no está configurado para gestionar SIM.");
    }
    if (!dispositivo.colaborador_id) {
      throw new ConflictError("La custodia de SIM requiere un colaborador asignado; la custodia departamental aún no está modelada.");
    }

    const lineaActual = await obtenerLineaPorDispositivo(dispositivo.dispositivo_id, client, true);
    const simAnterior = dispositivo.sim_id
      ? await obtenerSimPorId(dispositivo.sim_id, client, true)
      : lineaActual?.sim_id ? await obtenerSimPorId(lineaActual.sim_id, client, true) : null;
    if (dispositivo.sim_id && !simAnterior) throw new ConflictError("La SIM actual del dispositivo no existe.");
    if (simAnterior && simAnterior.dispositivo_id !== dispositivo.dispositivo_id) {
      throw new ConflictError("La SIM actual no pertenece al dispositivo seleccionado.");
    }
    if (lineaActual && simAnterior && lineaActual.sim_id && lineaActual.sim_id !== simAnterior.sim_id) {
      throw new ConflictError("Las referencias actuales entre dispositivo, línea y SIM son inconsistentes.");
    }

    let lineaObjetivo: LineaMovilRow | null = null;
    let lineaCreada = false;
    let lineaActualLimpiada = false;
    if (input.accionLinea === "USAR_LINEA_EXISTENTE") {
      if (!input.lineaMovilId) throw new ValidationError("Debe seleccionar la línea móvil existente.");
      lineaObjetivo = await obtenerLineaPorId(String(input.lineaMovilId), client, true);
      if (!lineaObjetivo) throw new NotFoundError("La línea móvil seleccionada no existe.");
      validarLineaObjetivo(lineaObjetivo, dispositivo.dispositivo_id, dispositivo.colaborador_id, simAnterior?.sim_id ?? null);
    } else if (input.accionLinea === "CREAR_LINEA_NUEVA") {
      if (!input.numeroNuevo?.trim()) throw new ValidationError("Debe informar el número telefónico nuevo.");
      const numero = normalizarNumeroTelefonicoChileno(input.numeroNuevo);
      if (await obtenerLineaPorNumero(numero, client, true)) {
        throw new ConflictError("El número telefónico ya existe; seleccione la línea existente.");
      }
      if (lineaActual) {
        await limpiarLineaAnterior(lineaActual, simAnterior?.sim_id ?? null, dispositivo.dispositivo_id, input.responsable, input.observaciones, client);
        lineaActualLimpiada = true;
      }
      lineaObjetivo = await crearLineaMovil(numero, dispositivo.colaborador_id, dispositivo.dispositivo_id, null, client);
      lineaCreada = true;
      await insertarHistorialLineaMovil(
        lineaObjetivo.id,
        "LINEA_MOVIL_CREADA",
        input.responsable,
        input.observaciones,
        { numeroTelefonico: numero, dispositivoId: dispositivo.dispositivo_id, colaboradorId: dispositivo.colaborador_id, motivo: "REGISTRO_SIM_NUEVA" },
        client
      );
    } else if (input.accionLinea !== "SIN_LINEA") {
      throw new ValidationError("La acción de línea no es válida.");
    }

    if (simAnterior) {
      await desasociarSimDeDispositivo(simAnterior.sim_codigo_inventario, client);
      await insertarHistorialSim(
        simAnterior.sim_id,
        "DESASOCIAR_SIM_REGISTRO_NUEVA",
        simAnterior.estado_id,
        simAnterior.estado_id,
        input.responsable,
        input.observaciones,
        { dispositivoCodigoInventario: codigoInventario, motivo: "LIBERACION_TECNICA_PREVIA" },
        client
      );
    }

    const simNueva = await crearSimEnTransaccion(
      {
        iccidCodigoFabrica: input.iccidCodigoFabrica,
        compania: input.compania,
        observaciones: input.observaciones,
        responsable: input.responsable
      },
      client,
      {
        estadoCodigo: "ASIGNADA",
        dispositivoId: dispositivo.dispositivo_id,
        colaboradorId: dispositivo.colaborador_id,
        lineaMovilId: null,
        detalle: {
          dispositivoCodigoInventario: codigoInventario,
          lineaMovilId: lineaObjetivo?.id ?? null,
          accionLinea: input.accionLinea,
          origen: "GESTION_LINEA_SIM"
        }
      }
    );

    if (lineaActual && lineaActual.id !== lineaObjetivo?.id && !lineaActualLimpiada) {
      await limpiarLineaAnterior(lineaActual, simAnterior?.sim_id ?? null, dispositivo.dispositivo_id, input.responsable, input.observaciones, client);
    }

    if (lineaObjetivo) {
      await sincronizarVinculoLineaSim(
        lineaObjetivo.id,
        simNueva.sim_id,
        "REGISTRO_SIM_NUEVA",
        client,
        simAnterior?.sim_id ?? null
      );
      await actualizarVinculosLinea(lineaObjetivo.id, dispositivo.dispositivo_id, dispositivo.colaborador_id, client);
      await insertarHistorialLineaMovil(
        lineaObjetivo.id,
        "SIM_NUEVA_ASOCIADA",
        input.responsable,
        input.observaciones,
        {
          simCodigoInventario: simNueva.sim_codigo_inventario,
          dispositivoCodigoInventario: codigoInventario,
          lineaCreada,
          numeroTelefonico: lineaObjetivo.numero_telefonico
        },
        client
      );
    }

    const estadoAsignada = await obtenerEstadoSimPorCodigo("ASIGNADA", client);
    if (!estadoAsignada) throw new NotFoundError("No existe un estado ASIGNADA activo para SIM.");
    await insertarHistorialSim(
      simNueva.sim_id,
      "SIM_ASOCIADA_A_DISPOSITIVO",
      estadoAsignada.id,
      estadoAsignada.id,
      input.responsable,
      input.observaciones,
      {
        dispositivoCodigoInventario: codigoInventario,
        lineaMovilId: lineaObjetivo?.id ?? null,
        numeroTelefonico: lineaObjetivo?.numero_telefonico ?? null,
        accionLinea: input.accionLinea
      },
      client
    );
    await insertarHistorialDispositivo(
      dispositivo.dispositivo_id,
      "SIM_NUEVA_REGISTRADA_Y_ASOCIADA",
      dispositivo.estado_id,
      dispositivo.estado_id,
      input.responsable,
      input.observaciones,
      { simCodigoInventario: simNueva.sim_codigo_inventario, lineaMovilId: lineaObjetivo?.id ?? null, accionLinea: input.accionLinea },
      client
    );

    return {
      operacion: "REGISTRAR_SIM_NUEVA",
      sim: {
        id: simNueva.sim_id,
        codigoInventario: simNueva.sim_codigo_inventario,
        iccid: simNueva.iccid_codigo_fabrica,
        estado: simNueva.estado_codigo,
        dispositivoId: simNueva.dispositivo_id,
        colaboradorId: simNueva.colaborador_id,
        lineaMovilId: lineaObjetivo?.id ?? null
      },
      linea: lineaObjetivo ? { id: lineaObjetivo.id, numeroTelefonico: lineaObjetivo.numero_telefonico, estado: "ACTIVA" } : null,
      dispositivo: { id: dispositivo.dispositivo_id, codigoInventario }
    };
};

export const registrarSimNuevaEnDispositivo = async (
  codigoInventario: number,
  input: RegistrarSimNuevaInput
): Promise<RegistrarSimNuevaResult> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await registrarSimNuevaEnTransaccion(codigoInventario, input, client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    if (isUniqueViolation(error)) throw new ConflictError("La SIM, el ICCID o el número informado ya está en uso.");
    throw error;
  } finally {
    client.release();
  }
};
