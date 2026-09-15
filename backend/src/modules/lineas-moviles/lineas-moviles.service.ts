import type { PoolClient } from "pg";
import { AppError, ConflictError, ValidationError } from "../../shared/errors";
import { normalizarNumeroTelefonicoChileno } from "../sim/sim-phone";
import { insertarHistorialSim, obtenerEstadoSimPorCodigo } from "../sim/sim.repository";
import type { SimRow } from "../sim/sim.types";
import {
  actualizarLineaPorExtravio,
  asociarLineaMovil,
  crearLineaMovil,
  desvincularSimPorExtravio,
  guardarLineaMovilDeDispositivo,
  insertarHistorialLineaMovil,
  liberarLineaActualDeSim,
  liberarLineaDeSimAnterior,
  obtenerLineaPorDispositivo,
  obtenerLineaPorNumero,
  obtenerLineaPorSim,
  vincularLineaEnSim
} from "./lineas-moviles.repository";
import type {
  AccionLineaExtravio,
  EstadoLineaMovil,
  LineaMovilRow
} from "./lineas-moviles.types";

interface VincularLineaInput {
  numeroTelefonico: string;
  sim: SimRow;
  dispositivoId: string | null;
  dispositivoCodigoInventario?: number;
  colaboradorId: string | null;
  responsable: string;
  observaciones?: string | null;
  permitirReemplazoActivo?: boolean;
}

export const esReposicionLineaMovil = (
  linea: Pick<LineaMovilRow, "estado" | "sim_id"> | null,
  simObjetivoId: string
): boolean =>
  !!linea
  && ["PENDIENTE_REPOSICION", "BLOQUEADA", "SUSPENDIDA"].includes(linea.estado)
  && linea.sim_id !== simObjetivoId;

export const vincularLineaMovil = async (
  input: VincularLineaInput,
  client: PoolClient
): Promise<{ linea: LineaMovilRow; creada: boolean; reemplazo: boolean }> => {
  const numero = normalizarNumeroTelefonicoChileno(input.numeroTelefonico);
  const lineaActualDeSim = await obtenerLineaPorSim(input.sim.sim_id, client, true);
  const lineaActualDelDispositivo = input.dispositivoId
    ? await obtenerLineaPorDispositivo(input.dispositivoId, client, true)
    : null;
  let linea = await obtenerLineaPorNumero(numero, client, true);
  if (lineaActualDelDispositivo && linea && linea.id !== lineaActualDelDispositivo.id) {
    throw new ConflictError("El número telefónico ya existe en otra línea móvil.");
  }
  if (lineaActualDelDispositivo) linea = lineaActualDelDispositivo;
  const creada = !linea;
  const simAnteriorId = linea?.sim_id ?? null;
  const numeroAnterior = linea?.numero_telefonico ?? null;
  const esReposicionPendiente = esReposicionLineaMovil(linea, input.sim.sim_id);

  if (linea?.estado === "DADA_BAJA") {
    throw new ConflictError(
      "La línea móvil está dada de baja y requiere reactivación administrativa."
    );
  }
  if (
    linea?.sim_id
    && linea.sim_id !== input.sim.sim_id
    && !input.permitirReemplazoActivo
    && !["PENDIENTE_REPOSICION", "BLOQUEADA", "SUSPENDIDA"].includes(linea.estado)
  ) {
    throw new ConflictError("El número telefónico ya está asociado a otra SIM activa.");
  }
  if (linea?.sim_id && linea.sim_id !== input.sim.sim_id) {
    await liberarLineaDeSimAnterior(linea.sim_id, client);
  }
  if (lineaActualDeSim && lineaActualDeSim.id !== linea?.id) {
    const liberada = await liberarLineaActualDeSim(lineaActualDeSim.id, client);
    await insertarHistorialLineaMovil(
      liberada.id,
      "LINEA_DESASOCIADA_DE_SIM",
      input.responsable,
      input.observaciones,
      {
        simId: input.sim.sim_id,
        nuevaLineaNumero: numero,
        descripcion: "Línea móvil liberada al instalar otra línea en la SIM física."
      },
      client
    );
  }

  linea = linea
    ? await asociarLineaMovil(
        linea.id,
        numero,
        input.colaboradorId,
        input.dispositivoId,
        input.sim.sim_id,
        client
      )
    : await crearLineaMovil(
        numero,
        input.colaboradorId,
        input.dispositivoId,
        input.sim.sim_id,
        client
      );
  await vincularLineaEnSim(input.sim.sim_id, linea.id, numero, client);

  if (numeroAnterior && numeroAnterior !== numero) {
    await insertarHistorialLineaMovil(
      linea.id,
      "LINEA_MOVIL_NUMERO_ACTUALIZADO",
      input.responsable,
      input.observaciones,
      {
        numeroAnterior,
        numeroNuevo: numero,
        dispositivoId: input.dispositivoId,
        codigoInventario: input.dispositivoCodigoInventario,
        responsable: input.responsable,
        descripcion: "Número telefónico actualizado manualmente en línea móvil asociada al smartphone."
      },
      client
    );
  }

  if (creada) {
    await insertarHistorialLineaMovil(
      linea.id,
      "LINEA_MOVIL_CREADA",
      input.responsable,
      input.observaciones,
      { numeroTelefonico: numero, descripcion: "Línea móvil corporativa creada." },
      client
    );
  }

  const reemplazo = (!!simAnteriorId && simAnteriorId !== input.sim.sim_id) || esReposicionPendiente;
  await insertarHistorialLineaMovil(
    linea.id,
    reemplazo ? "LINEA_ASOCIADA_A_NUEVA_SIM" : "LINEA_MOVIL_ASOCIADA_A_SIM",
    input.responsable,
    input.observaciones,
    {
      simId: input.sim.sim_id,
      simCodigoInventario: input.sim.sim_codigo_inventario,
      dispositivoId: input.dispositivoId,
      simAnteriorId,
      descripcion: reemplazo
        ? "Línea móvil asociada a una nueva SIM de reemplazo."
        : "Línea móvil asociada a una SIM física."
    },
    client
  );
  return { linea, creada, reemplazo };
};

export const vincularLineaMovilADispositivo = async (
  numeroTelefonico: string,
  dispositivoId: string,
  codigoInventario: number,
  colaboradorId: string | null,
  responsable: string,
  observaciones: string | null | undefined,
  client: PoolClient,
  sim: SimRow | null = null
): Promise<{ linea: LineaMovilRow; creada: boolean; numeroActualizado: boolean }> => {
  const numero = normalizarNumeroTelefonicoChileno(numeroTelefonico);
  const lineaDelDispositivo = await obtenerLineaPorDispositivo(dispositivoId, client, true);
  const linea = await obtenerLineaPorNumero(numero, client, true);
  const simId = sim?.sim_id ?? null;
  const lineaActualDeSim = simId ? await obtenerLineaPorSim(simId, client, true) : null;

  if (lineaDelDispositivo) {
    if (linea && linea.id !== lineaDelDispositivo.id) {
      throw new ConflictError("El número telefónico ya está asociado a otro equipo.");
    }
    if (lineaActualDeSim && lineaActualDeSim.id !== lineaDelDispositivo.id) {
      const liberada = await liberarLineaActualDeSim(lineaActualDeSim.id, client);
      await insertarHistorialLineaMovil(
        liberada.id,
        "LINEA_DESASOCIADA_DE_SIM",
        responsable,
        observaciones,
        {
          simId,
          nuevaLineaNumero: numero,
          descripcion: "Linea movil liberada al instalar otra linea en la SIM fisica."
        },
        client
      );
    }
    if (lineaDelDispositivo.sim_id && lineaDelDispositivo.sim_id !== simId) {
      await liberarLineaDeSimAnterior(lineaDelDispositivo.sim_id, client);
    }
    const numeroAnterior = lineaDelDispositivo.numero_telefonico;
    const numeroActualizado = numeroAnterior !== numero;
    const { linea: actualizada, operacion } = await guardarLineaMovilDeDispositivo(
      numero,
      dispositivoId,
      colaboradorId,
      client,
      lineaDelDispositivo.id,
      simId
    );
    if (!actualizada) throw new AppError(500, "LINEA_MOVIL_SAVE_UNCONFIRMED", "No se pudo confirmar el guardado de la línea móvil.");
    if (simId) await vincularLineaEnSim(simId, actualizada.id, numero, client);
    console.log("[asociar-linea] insert/update resultado", {
      operacion,
      lineaId: actualizada.id,
      numeroTelefonico: actualizada.numero_telefonico,
      dispositivoId: actualizada.dispositivo_id,
      simId: actualizada.sim_id
    });
    if (!numeroActualizado) {
      return { linea: actualizada, creada: false, numeroActualizado: false };
    }
    await insertarHistorialLineaMovil(
      actualizada.id,
      "LINEA_MOVIL_NUMERO_ACTUALIZADO",
      responsable,
      observaciones,
      {
        numeroAnterior,
        numeroNuevo: numero,
        dispositivoId,
        codigoInventario,
        responsable,
        descripcion: "Número telefónico actualizado manualmente en línea móvil asociada al smartphone."
      },
      client
    );
    return { linea: actualizada, creada: false, numeroActualizado: true };
  }
  if (linea?.estado === "ACTIVA" && linea.dispositivo_id && linea.dispositivo_id !== dispositivoId) {
    throw new ConflictError("El número telefónico ya está asociado a otro equipo.");
  }
  if (linea?.sim_id && linea.sim_id !== simId) {
    throw new ConflictError("El número telefónico ya está asociado a una SIM.");
  }
  if (linea?.estado === "DADA_BAJA") {
    throw new ConflictError("La línea móvil está dada de baja y requiere reactivación administrativa.");
  }

  if (lineaActualDeSim && lineaActualDeSim.id !== linea?.id) {
    const liberada = await liberarLineaActualDeSim(lineaActualDeSim.id, client);
    await insertarHistorialLineaMovil(
      liberada.id,
      "LINEA_DESASOCIADA_DE_SIM",
      responsable,
      observaciones,
      {
        simId,
        nuevaLineaNumero: numero,
        descripcion: "Linea movil liberada al instalar otra linea en la SIM fisica."
      },
      client
    );
  }

  const { linea: actualizada, operacion } = await guardarLineaMovilDeDispositivo(
    numero,
    dispositivoId,
    colaboradorId,
    client,
    linea?.id,
    simId
  );
  if (!actualizada) throw new AppError(500, "LINEA_MOVIL_SAVE_UNCONFIRMED", "No se pudo confirmar el guardado de la línea móvil.");
  if (simId) await vincularLineaEnSim(simId, actualizada.id, numero, client);
  console.log("[asociar-linea] insert/update resultado", {
    operacion,
    lineaId: actualizada.id,
    numeroTelefonico: actualizada.numero_telefonico,
    dispositivoId: actualizada.dispositivo_id,
    simId: actualizada.sim_id
  });

  if (!linea) {
    await insertarHistorialLineaMovil(
      actualizada.id,
      "LINEA_MOVIL_CREADA",
      responsable,
      observaciones,
      { numeroTelefonico: numero, descripcion: "Línea móvil corporativa creada." },
      client
    );
  }
  await insertarHistorialLineaMovil(
    actualizada.id,
    simId ? "LINEA_MOVIL_ASOCIADA_A_SIM" : "LINEA_MOVIL_ASOCIADA_A_DISPOSITIVO",
    responsable,
    observaciones,
    {
      dispositivoId,
      codigoInventario,
      numeroTelefonico: numero,
      ...(sim ? { simId: sim.sim_id, simCodigoInventario: sim.sim_codigo_inventario } : {}),
      descripcion: simId
        ? "Linea movil asociada al Smartphone y a una SIM fisica."
        : "Linea movil asociada directamente al Smartphone."
    },
    client
  );
  return { linea: actualizada, creada: !linea, numeroActualizado: false };
};

interface ExtravioLineaInput {
  accion: AccionLineaExtravio | undefined;
  sim: SimRow | null;
  responsable: string;
  observaciones?: string | null;
}

export const resolverPlanExtravioLinea = (
  accion: Exclude<AccionLineaExtravio, "NO_APLICA">
): { estadoLinea: EstadoLineaMovil; estadoSim: "BLOQUEADA" | "DADA_BAJA" | "EXTRAVIADA"; eventoLinea: string } => {
  switch (accion) {
    case "CONSERVAR_BLOQUEAR":
      return { estadoLinea: "PENDIENTE_REPOSICION", estadoSim: "BLOQUEADA", eventoLinea: "LINEA_CONSERVADA_POR_REPOSICION" };
    case "DAR_BAJA":
      return { estadoLinea: "DADA_BAJA", estadoSim: "DADA_BAJA", eventoLinea: "LINEA_DADA_BAJA_POR_EXTRAVIO" };
    case "PENDIENTE_CONFIRMAR":
      return { estadoLinea: "SUSPENDIDA", estadoSim: "EXTRAVIADA", eventoLinea: "LINEA_PENDIENTE_CONFIRMACION_POR_EXTRAVIO" };
  }
};

export const gestionarLineaPorExtravio = async (
  input: ExtravioLineaInput,
  client: PoolClient
): Promise<void> => {
  if (!input.sim) {
    if (input.accion && input.accion !== "NO_APLICA") {
      throw new ValidationError("El Smartphone no tiene una SIM o línea asociada.");
    }
    return;
  }
  if (!input.accion) {
    throw new ValidationError("Indique qué hacer con la línea telefónica.");
  }
  if (input.accion === "NO_APLICA") {
    throw new ValidationError(
      "No aplica solo puede seleccionarse cuando el Smartphone no tiene SIM."
    );
  }

  const plan = resolverPlanExtravioLinea(input.accion);
  const estadoSim = await obtenerEstadoSimPorCodigo(plan.estadoSim, client);
  if (!estadoSim) throw new ConflictError(`No existe el estado ${plan.estadoSim} para SIM.`);

  const linea = await obtenerLineaPorSim(input.sim.sim_id, client, true);
  if (!linea && input.accion === "CONSERVAR_BLOQUEAR") {
    throw new ValidationError("La SIM no tiene una línea móvil registrada para conservar.");
  }

  await desvincularSimPorExtravio(input.sim.sim_id, estadoSim.id, client);
  await insertarHistorialSim(
    input.sim.sim_id,
    input.accion === "CONSERVAR_BLOQUEAR"
      ? "SIM_BLOQUEADA_POR_EXTRAVIO"
      : input.accion === "DAR_BAJA"
        ? "SIM_DADA_BAJA_POR_EXTRAVIO"
        : "SIM_EXTRAVIADA_PENDIENTE_CONFIRMACION",
    input.sim.estado_id,
    estadoSim.id,
    input.responsable,
    input.observaciones,
    {
      numeroTelefonico: linea?.numero_telefonico ?? input.sim.numero_asociado,
      descripcion: input.accion === "CONSERVAR_BLOQUEAR"
        ? "SIM bloqueada por extravío del Smartphone; la línea se conserva."
        : "SIM desvinculada por extravío del Smartphone."
    },
    client
  );

  if (linea) {
    const actualizada = await actualizarLineaPorExtravio(linea.id, plan.estadoLinea, client);
    await insertarHistorialLineaMovil(
      actualizada.id,
      plan.eventoLinea,
      input.responsable,
      input.observaciones,
      {
        numeroTelefonico: actualizada.numero_telefonico,
        estado: actualizada.estado,
        simAnteriorId: input.sim.sim_id,
        descripcion: input.accion === "CONSERVAR_BLOQUEAR"
          ? "Número telefónico conservado y pendiente de una SIM de reposición."
          : "Línea móvil actualizada por extravío del Smartphone."
      },
      client
    );
  }
};
