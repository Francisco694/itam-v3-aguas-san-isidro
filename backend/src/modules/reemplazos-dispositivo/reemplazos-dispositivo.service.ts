import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { currentUserId } from "../../shared/auth-context";
import { toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  isForeignKeyViolation,
  isUniqueViolation
} from "../../shared/errors";
import { obtenerColaboradorPorId } from "../colaboradores/colaboradores.repository";
import {
  buscarActaDetalleVigente,
  crearComprobante
} from "../comprobantes-devolucion/comprobantes-devolucion.repository";
import {
  cambiarEstadoDispositivo,
  darDeBajaYLiberarCustodia,
  devolverDispositivo,
  insertarHistorialDispositivo,
  obtenerDispositivoPorCodigo,
  obtenerEstadoDispositivoPorCodigo,
  registrarBajaDispositivo,
  asignarDispositivoAColaborador
} from "../dispositivos/dispositivos.repository";
import type { DispositivoRow, MotivoBaja } from "../dispositivos/dispositivos.types";
import { assertDispositivoSinSimParaBaja } from "../dispositivos/dispositivo-baja-rules";
import {
  actualizarVinculosLinea,
  crearLineaMovil,
  desasociarVinculoLineaSim,
  insertarHistorialLineaMovil,
  obtenerLineaPorDispositivo,
  obtenerLineaPorId,
  obtenerLineaPorNumero,
  obtenerLineaPorSim,
  sincronizarVinculoLineaSim
} from "../lineas-moviles/lineas-moviles.repository";
import { normalizarNumeroTelefonicoChileno } from "../sim/sim-phone";
import {
  asociarSimADispositivo,
  asignarSimAColaborador,
  cambiarEstadoSim,
  desasociarSimDeDispositivo,
  insertarHistorialSim,
  recibirSimEnTi,
  obtenerEstadoSimPorCodigo,
  obtenerSimPorCodigo,
  obtenerSimPorId
} from "../sim/sim.repository";
import { crearSimEnTransaccion } from "../sim/sim.service";
import {
  completarReemplazo,
  insertarReemplazoPendiente,
  listarReemplazosDeColaborador,
  listarReemplazosPendientes,
  obtenerReemplazoPendientePorDispositivoCodigo,
  obtenerReemplazoPendientePorId,
  replacementSelect
} from "./reemplazos-dispositivo.repository";
import type {
  AccionSimReemplazo,
  CrearReemplazoInput,
  DestinoDispositivoAnterior,
  LineaSimExistenteReemplazo,
  RecibirReemplazoInput,
  ReemplazoDispositivo,
  ReemplazoDispositivoRow
} from "./reemplazos-dispositivo.types";

const DESTINOS: readonly DestinoDispositivoAnterior[] = [
  "DISPONIBLE",
  "RETENIDO_REVISION",
  "DADO_BAJA"
];

export const destinosReemplazo = (): readonly DestinoDispositivoAnterior[] => DESTINOS;

const assertDestinoValido = (destino: string | undefined): DestinoDispositivoAnterior => {
  if (!destino || !DESTINOS.includes(destino as DestinoDispositivoAnterior)) {
    throw new ValidationError("El destino del dispositivo anterior no es válido para este flujo.");
  }
  return destino as DestinoDispositivoAnterior;
};

const assertNoTerminal = (device: DispositivoRow): void => {
  if (["EXTRAVIADO", "DADO_BAJA"].includes(device.estado_codigo)) {
    throw new ConflictError(`El dispositivo está en estado terminal ${device.estado_nombre} y no admite esta operación.`);
  }
};

const assertColaboradorActivoLocal = (collaborator: { activo: boolean } | null): void => {
  if (!collaborator) throw new NotFoundError("Colaborador no encontrado.");
  if (!collaborator.activo) throw new ConflictError("No se puede asignar custodia a un colaborador inactivo.");
};

const assertCustodiaLibre = (device: DispositivoRow): void => {
  if (device.colaborador_id || device.departamento_id) {
    throw new ConflictError("El dispositivo nuevo ya tiene un custodio vigente.");
  }
};

const mapReplacement = (row: ReemplazoDispositivoRow): ReemplazoDispositivo => ({
  id: row.id,
  estadoOperacion: row.estado_operacion,
  fechaInicio: toIsoDateTime(row.fecha_inicio),
  fechaRecepcionAnterior: row.fecha_recepcion_anterior ? toIsoDateTime(row.fecha_recepcion_anterior) : null,
  fechaCierre: row.fecha_cierre ? toIsoDateTime(row.fecha_cierre) : null,
  observacion: row.observacion,
  motivoCancelacion: row.motivo_cancelacion,
  destinoDispositivoAnterior: row.destino_dispositivo_anterior,
  colaborador: { id: row.colaborador_id, nombre: row.colaborador_nombre, rut: row.colaborador_rut },
  dispositivoAnterior: {
    id: row.dispositivo_anterior_id,
    codigoInventario: row.dispositivo_anterior_codigo,
    tipo: row.dispositivo_anterior_tipo,
    marca: row.dispositivo_anterior_marca,
    modelo: row.dispositivo_anterior_modelo,
    estado: { codigo: row.dispositivo_anterior_estado_codigo, nombre: row.dispositivo_anterior_estado_nombre }
  },
  dispositivoNuevo: {
    id: row.dispositivo_nuevo_id,
    codigoInventario: row.dispositivo_nuevo_codigo,
    tipo: row.dispositivo_nuevo_tipo,
    marca: row.dispositivo_nuevo_marca,
    modelo: row.dispositivo_nuevo_modelo,
    estado: { codigo: row.dispositivo_nuevo_estado_codigo, nombre: row.dispositivo_nuevo_estado_nombre }
  },
  usuarioInicio: row.usuario_inicio_id && row.usuario_inicio_nombre
    ? { id: row.usuario_inicio_id, nombre: row.usuario_inicio_nombre }
    : null,
  usuarioCierre: row.usuario_cierre_id && row.usuario_cierre_nombre
    ? { id: row.usuario_cierre_id, nombre: row.usuario_cierre_nombre }
    : null,
  comprobanteDevolucionId: row.comprobante_devolucion_id
});

const snapshot = (device: DispositivoRow): Record<string, unknown> => ({
  tipo: device.colaborador_id ? "COLABORADOR" : device.departamento_id ? "DEPARTAMENTO" : "NONE",
  id: device.colaborador_id ?? device.departamento_id,
  nombre: device.colaborador_nombre ?? device.departamento_nombre,
  rut: device.colaborador_rut
});

const assertNoOpenTechnicalOrder = async (deviceId: string, client: PoolClient): Promise<void> => {
  const result = await client.query(
    `SELECT id FROM itam.ordenes_servicio_tecnico
     WHERE dispositivo_id = $1
       AND estado NOT IN ('CERRADA', 'BAJA', 'REPARACION_RECHAZADA')
     LIMIT 1`,
    [deviceId]
  );
  if (result.rows[0]) throw new ConflictError("El equipo ya se encuentra en servicio técnico.");
};

const assertSimDestinoReemplazoValido = (
  sim: NonNullable<Awaited<ReturnType<typeof obtenerSimPorCodigo>>>
): void => {
  if (sim.estado_codigo !== "DISPONIBLE") {
    throw new ConflictError("La SIM seleccionada no está disponible para este reemplazo.");
  }
  if (sim.dispositivo_id || sim.colaborador_id) {
    throw new ConflictError("La SIM seleccionada ya está ocupada o tiene una asociación incompatible.");
  }
};

type SimRecepcionReemplazo = {
  simId: string;
  simCodigoInventario: number;
  simIccid: string | null;
  dispositivoAnteriorId: string;
  colaboradorAnteriorId: string | null;
  lineaAnteriorId: string | null;
  lineaNumeroTelefonico: string | null;
  replacementId: string;
  responsable: string;
  observaciones?: string | null;
};

const recibirSimPorReemplazoEnTi = async (
  context: SimRecepcionReemplazo,
  comprobanteDevolucionId: string,
  client: PoolClient
): Promise<void> => {
  const sim = await obtenerSimPorId(context.simId, client, true);
  if (!sim) throw new NotFoundError("La SIM que debía recibirse ya no existe.");
  if (sim.dispositivo_id && sim.dispositivo_id !== context.dispositivoAnteriorId) {
  }
  if (!["ASIGNADA", "DISPONIBLE"].includes(sim.estado_codigo)) {
    throw new ConflictError(`La SIM no puede recibirse por TI desde el estado ${sim.estado_codigo}.`);
  }

  const availableState = await obtenerEstadoSimPorCodigo("DISPONIBLE", client);
  if (!availableState) throw new NotFoundError("No existe un estado DISPONIBLE activo para SIM.");
  const received = await recibirSimEnTi(sim.sim_id, availableState.id, client);
  if (!received) throw new NotFoundError("No fue posible registrar la recepción física de la SIM.");

  if (context.lineaAnteriorId) {
    const linea = await obtenerLineaPorId(context.lineaAnteriorId, client, true);
    if (!linea) throw new NotFoundError("La línea asociada a la SIM ya no existe.");
    if (linea.sim_id !== received.sim_id) {
      throw new ConflictError("La línea asociada a la SIM cambió durante la recepción.");
    }
    await actualizarVinculosLinea(linea.id, null, null, client);
    await insertarHistorialLineaMovil(
      linea.id,
      "SIM_RECEPCIONADA_POR_TI",
      context.responsable,
      context.observaciones,
      {
        simId: received.sim_id,
        codigoInventarioSim: context.simCodigoInventario,
        reemplazoId: context.replacementId,
        comprobanteDevolucionId,
        dispositivoAnteriorId: context.dispositivoAnteriorId,
        dispositivoId: null,
        colaboradorId: null,
        numeroTelefonico: linea.numero_telefonico,
        motivo: "REEMPLAZO_DISPOSITIVO"
      },
      client
    );
  }

  await insertarHistorialSim(
    received.sim_id,
    "SIM_RECEPCIONADA_POR_TI",
    sim.estado_id,
    availableState.id,
    context.responsable,
    context.observaciones,
    {
      simId: received.sim_id,
      codigoInventario: context.simCodigoInventario,
      dispositivoAnteriorId: context.dispositivoAnteriorId,
      colaboradorAnteriorId: context.colaboradorAnteriorId,
      reemplazoId: context.replacementId,
      fecha: new Date().toISOString(),
      usuarioEjecutor: currentUserId(),
      lineaAnteriorId: context.lineaAnteriorId,
      comprobanteDevolucionId,
      motivo: "REEMPLAZO_DISPOSITIVO",
      origen: "REEMPLAZO_DISPOSITIVO"
    },
    client
  );
};

const registrarSimNoEntregadaEnDevolucion = async (
  context: SimRecepcionReemplazo,
  comprobanteDevolucionId: string,
  client: PoolClient
): Promise<void> => {
  const sim = await obtenerSimPorId(context.simId, client, true);
  if (!sim) throw new NotFoundError("La SIM que continúa bajo custodia ya no existe.");
  if (sim.dispositivo_id && sim.dispositivo_id !== context.dispositivoAnteriorId) {
    throw new ConflictError("La SIM está asociada a otro dispositivo y no puede resolverse en este reemplazo.");
  }
  if (sim.colaborador_id !== context.colaboradorAnteriorId) {
    throw new ConflictError("La custodia actual de la SIM no coincide con el colaborador del reemplazo.");
  }

  const detached = await desasociarSimDeDispositivo(sim.sim_codigo_inventario, client);
  if (!detached) throw new NotFoundError("No fue posible retirar el vínculo técnico de la SIM.");

  if (context.lineaAnteriorId) {
    const linea = await obtenerLineaPorId(context.lineaAnteriorId, client, true);
    if (!linea) throw new NotFoundError("La línea asociada a la SIM ya no existe.");
    if (linea.sim_id !== detached.sim_id) {
      throw new ConflictError("La línea asociada a la SIM cambió durante la recepción.");
    }
    await actualizarVinculosLinea(linea.id, null, context.colaboradorAnteriorId, client);
    await insertarHistorialLineaMovil(
      linea.id,
      "SIM_NO_ENTREGADA_EN_DEVOLUCION",
      context.responsable,
      context.observaciones,
      {
        simId: detached.sim_id,
        codigoInventarioSim: context.simCodigoInventario,
        reemplazoId: context.replacementId,
        comprobanteDevolucionId,
        dispositivoAnteriorId: context.dispositivoAnteriorId,
        dispositivoId: null,
        colaboradorId: context.colaboradorAnteriorId,
        numeroTelefonico: linea.numero_telefonico,
        motivo: "REEMPLAZO_DISPOSITIVO"
      },
      client
    );
  }

  await insertarHistorialSim(
    detached.sim_id,
    "SIM_NO_ENTREGADA_EN_DEVOLUCION",
    detached.estado_id,
    detached.estado_id,
    context.responsable,
    context.observaciones,
    {
      simId: detached.sim_id,
      codigoInventario: context.simCodigoInventario,
      iccid: context.simIccid,
      colaboradorId: context.colaboradorAnteriorId,
      lineaMovilId: context.lineaAnteriorId,
      numeroTelefonico: context.lineaNumeroTelefonico,
      dispositivoAnteriorId: context.dispositivoAnteriorId,
      reemplazoId: context.replacementId,
      comprobanteDevolucionId,
      fecha: new Date().toISOString(),
      usuarioEjecutor: currentUserId(),
      motivo: "REEMPLAZO_DISPOSITIVO",
      origen: "REEMPLAZO_DISPOSITIVO"
    },
    client
  );
};

const obtenerContextoSimReemplazo = async (
  anterior: DispositivoRow,
  replacementId: string,
  responsable: string,
  observaciones: string | null | undefined,
  client: PoolClient
): Promise<SimRecepcionReemplazo | null> => {
  const lineaDirecta = await obtenerLineaPorDispositivo(anterior.dispositivo_id, client, true);
  const simId = anterior.sim_id ?? lineaDirecta?.sim_id ?? null;
  if (!simId) return null;

  const sim = await obtenerSimPorId(simId, client, true);
  if (!sim) throw new NotFoundError("La SIM asociada al dispositivo anterior no existe.");
  if (sim.dispositivo_id && sim.dispositivo_id !== anterior.dispositivo_id) {
    throw new ConflictError("La SIM del dispositivo anterior está asociada a otro dispositivo.");
  }
  if (sim.colaborador_id !== anterior.colaborador_id) {
    throw new ConflictError("La custodia de la SIM no coincide con la custodia del dispositivo anterior.");
  }
  if (lineaDirecta?.sim_id && lineaDirecta.sim_id !== sim.sim_id) {
    throw new ConflictError("Las referencias de SIM y línea del dispositivo anterior son inconsistentes.");
  }
  if (lineaDirecta && sim.linea_movil_id && lineaDirecta.id !== sim.linea_movil_id) {
    throw new ConflictError("La SIM y la línea del dispositivo anterior apuntan a líneas diferentes.");
  }

  const lineaId = sim.linea_movil_id ?? lineaDirecta?.id ?? null;
  const linea = lineaId ? await obtenerLineaPorId(lineaId, client, true) : null;
  if (lineaId && !linea) throw new NotFoundError("La línea asociada a la SIM no existe.");
  if (linea && linea.sim_id && linea.sim_id !== sim.sim_id) {
    throw new ConflictError("La línea asociada a la SIM apunta a otra SIM.");
  }

  return {
    simId: sim.sim_id,
    simCodigoInventario: sim.sim_codigo_inventario,
    simIccid: sim.iccid_codigo_fabrica,
    dispositivoAnteriorId: anterior.dispositivo_id,
    colaboradorAnteriorId: anterior.colaborador_id,
    lineaAnteriorId: linea?.id ?? null,
    lineaNumeroTelefonico: linea?.numero_telefonico ?? null,
    replacementId,
    responsable,
    observaciones
  };
};

const asociarSimAReemplazo = async (
  sim: NonNullable<Awaited<ReturnType<typeof obtenerSimPorCodigo>>>,
  nuevo: DispositivoRow,
  input: CrearReemplazoInput,
  client: PoolClient
): Promise<void> => {
  if (!nuevo.colaborador_id) {
    throw new ConflictError("La custodia de SIM en dispositivos asignados a departamentos aún no está modelada.");
  }
  if (!await asociarSimADispositivo(sim.sim_codigo_inventario, nuevo.dispositivo_id, client)) {
    throw new NotFoundError("No fue posible asociar la SIM al dispositivo nuevo.");
  }
  const assignedState = await obtenerEstadoSimPorCodigo("ASIGNADA", client);
  if (!assignedState) throw new NotFoundError("No existe un estado ASIGNADA activo para SIM.");
  await asignarSimAColaborador(sim.sim_codigo_inventario, Number(nuevo.colaborador_id), client);
  if (sim.estado_codigo !== "ASIGNADA") await cambiarEstadoSim(sim.sim_codigo_inventario, assignedState.id, client);
  await insertarHistorialSim(sim.sim_id, "REEMPLAZO_SIM_ASOCIADA", sim.estado_id, assignedState.id, input.responsable, input.observaciones, {
    dispositivoNuevoCodigo: nuevo.dispositivo_codigo_inventario,
    reemplazoSim: true
  }, client);
};

const crearLineaNuevaParaReemplazo = async (
  numeroTelefonico: string,
  nuevo: DispositivoRow,
  input: CrearReemplazoInput,
  replacementId: string,
  client: PoolClient
): Promise<Awaited<ReturnType<typeof obtenerLineaPorId>>> => {
  const numero = normalizarNumeroTelefonicoChileno(numeroTelefonico);
  const existente = await obtenerLineaPorNumero(numero, client, true);
  if (existente) {
    throw new ConflictError(
      `El número telefónico ya existe en una línea con estado ${existente.estado}; no se reutiliza automáticamente.`
    );
  }
  const delDispositivo = await obtenerLineaPorDispositivo(nuevo.dispositivo_id, client, true);
  if (delDispositivo) {
    throw new ConflictError("El dispositivo nuevo ya tiene una línea móvil registrada.");
  }
  const linea = await crearLineaMovil(
    numero,
    nuevo.colaborador_id,
    nuevo.dispositivo_id,
    null,
    client
  );
  await insertarHistorialLineaMovil(
    linea.id,
    "LINEA_MOVIL_CREADA",
    input.responsable,
    input.observaciones,
    {
      numeroTelefonico: numero,
      dispositivoId: nuevo.dispositivo_id,
      colaboradorId: nuevo.colaborador_id,
      reemplazoId: replacementId,
      motivo: "REEMPLAZO_DISPOSITIVO"
    },
    client
  );
  return linea;
};

const crearSimNuevaEnReemplazo = async (
  anterior: DispositivoRow,
  nuevo: DispositivoRow,
  oldSim: Awaited<ReturnType<typeof obtenerSimPorCodigo>>,
  oldLine: Awaited<ReturnType<typeof obtenerLineaPorId>>,
  input: CrearReemplazoInput,
  replacementId: string,
  client: PoolClient
): Promise<{
  sim: NonNullable<Awaited<ReturnType<typeof obtenerSimPorCodigo>>>;
  linea: Awaited<ReturnType<typeof obtenerLineaPorId>>;
  transfiereLinea: boolean;
}> => {
  const spec = input.simNueva;
  if (!spec) throw new ValidationError("Debe informar los datos de la SIM nueva.");
  if (!nuevo.colaborador_id) {
    throw new ConflictError("La custodia de SIM en dispositivos asignados a departamentos aún no está modelada.");
  }

  let linea: Awaited<ReturnType<typeof obtenerLineaPorId>> = null;
  if (spec.linea === "CONSERVAR_NUMERO") {
    if (!oldLine) throw new ConflictError("No existe una línea actual para conservar el número.");
    if (oldLine.estado !== "ACTIVA") {
      throw new ConflictError(`La línea actual está en estado ${oldLine.estado} y no puede transferirse automáticamente.`);
    }
    if (oldLine.sim_id && oldSim && oldLine.sim_id !== oldSim.sim_id) {
      throw new ConflictError("La línea actual y la SIM anterior son inconsistentes.");
    }
    linea = oldLine;
  } else if (spec.linea === "NUMERO_NUEVO") {
    if (!spec.numeroTelefonico?.trim()) throw new ValidationError("Debe informar el número telefónico nuevo.");
    linea = await crearLineaNuevaParaReemplazo(spec.numeroTelefonico, nuevo, input, replacementId, client);
  }

  const sim = await crearSimEnTransaccion(
    {
      iccidCodigoFabrica: spec.iccidCodigoFabrica,
      compania: spec.compania,
      observaciones: spec.observaciones ?? input.observaciones,
      responsable: input.responsable
    },
    client,
    {
      estadoCodigo: "ASIGNADA",
      dispositivoId: nuevo.dispositivo_id,
      colaboradorId: nuevo.colaborador_id,
      // La línea puede seguir apuntando a la SIM anterior. Se transfiere
      // después de crear la SIM nueva para respetar la unicidad actual de
      // línea↔SIM y dejar ambas referencias sincronizadas en una sola TX.
      lineaMovilId: null,
      detalle: {
        reemplazoId: replacementId,
        dispositivoNuevoId: nuevo.dispositivo_id,
        dispositivoNuevoCodigo: nuevo.dispositivo_codigo_inventario,
        colaboradorId: nuevo.colaborador_id,
        lineaMovilId: linea?.id ?? null,
        numeroTelefonico: linea?.numero_telefonico ?? null,
        motivo: "REEMPLAZO_DISPOSITIVO"
      }
    }
  );

  if (linea) {
    await sincronizarVinculoLineaSim(
      linea.id,
      sim.sim_id,
      spec.linea === "CONSERVAR_NUMERO"
        ? "REEMPLAZO_SIM_NUEVA_CONSERVAR_NUMERO"
        : "REEMPLAZO_SIM_NUEVA_NUMERO_NUEVO",
      client,
      oldSim?.sim_id ?? null
    );
    await actualizarVinculosLinea(linea.id, nuevo.dispositivo_id, nuevo.colaborador_id, client);
    await insertarHistorialLineaMovil(
      linea.id,
      spec.linea === "CONSERVAR_NUMERO"
        ? "LINEA_ASOCIADA_A_NUEVA_SIM"
        : "LINEA_MOVIL_ASOCIADA_A_SIM",
      input.responsable,
      input.observaciones,
      {
        reemplazoId: replacementId,
        simId: sim.sim_id,
        simCodigoInventario: sim.sim_codigo_inventario,
        simAnteriorId: oldSim?.sim_id ?? null,
        dispositivoId: nuevo.dispositivo_id,
        colaboradorId: nuevo.colaborador_id,
        numeroTelefonico: linea.numero_telefonico,
        motivo: "REEMPLAZO_DISPOSITIVO"
      },
      client
    );
  }

  return {
    sim,
    linea,
    transfiereLinea: spec.linea === "CONSERVAR_NUMERO"
  };
};

const resolverSimReemplazo = async (
  anterior: DispositivoRow,
  nuevo: DispositivoRow,
  input: CrearReemplazoInput,
  replacementId: string,
  client: PoolClient
): Promise<SimRecepcionReemplazo | null> => {
  const oldLine = await obtenerLineaPorDispositivo(anterior.dispositivo_id, client, true);
  const oldSim = anterior.sim_id
    ? await obtenerSimPorId(anterior.sim_id, client, true)
    : oldLine?.sim_id
      ? await obtenerSimPorId(oldLine.sim_id, client, true)
      : null;
  if (oldLine && oldSim && oldLine.sim_id !== oldSim.sim_id) {
    throw new ConflictError("Las referencias SIM/línea del dispositivo anterior son inconsistentes.");
  }
  if (oldSim && oldSim.dispositivo_id && oldSim.dispositivo_id !== anterior.dispositivo_id) {
    throw new ConflictError("La SIM registrada en el dispositivo anterior está asociada a otro dispositivo.");
  }
  const accion: AccionSimReemplazo = input.accionSim ?? (oldSim && input.entregaAnterior
    ? (() => { throw new ConflictError("Debe resolver la SIM asociada al dispositivo anterior antes de continuar."); })()
    : "SIN_SIM");
  if (accion === "MOVER_SIM_ACTUAL" && !oldSim) throw new ValidationError("No existe una SIM actual para mover.");
  if (accion === "MOVER_SIM_ACTUAL" && !input.entregaAnterior) {
    throw new ConflictError("No se puede mover la SIM mientras el dispositivo anterior siga bajo custodia.");
  }
  if (accion === "USAR_SIM_EXISTENTE" && !input.simDestinoCodigo) throw new ValidationError("Debe seleccionar la SIM que se utilizará en el reemplazo.");
  if (accion === "USAR_SIM_EXISTENTE" && !input.entregaAnterior && input.conservarNumero === true) {
    throw new ConflictError("No se puede mover el número del equipo anterior mientras su devolución esté pendiente.");
  }

  let targetSim: Awaited<ReturnType<typeof obtenerSimPorCodigo>> = null;
  let targetLine: Awaited<ReturnType<typeof obtenerLineaPorId>> = null;
  let lineaSimExistente: LineaSimExistenteReemplazo | null = null;
  if (accion === "USAR_SIM_EXISTENTE") {
    targetSim = await obtenerSimPorCodigo(input.simDestinoCodigo!, client, true);
    if (!targetSim) throw new NotFoundError("SIM destino no encontrada.");
    assertSimDestinoReemplazoValido(targetSim);
    targetLine = await obtenerLineaPorSim(targetSim.sim_id, client, true);
    if (targetLine && targetSim.linea_movil_id && targetLine.id !== targetSim.linea_movil_id) {
      throw new ConflictError("La SIM seleccionada tiene referencias de línea inconsistentes.");
    }
    if (targetLine && (targetLine.dispositivo_id || (targetLine.colaborador_id && targetLine.colaborador_id !== nuevo.colaborador_id))) {
      throw new ConflictError("La línea de la SIM seleccionada ya está bajo otra custodia.");
    }
    lineaSimExistente = input.lineaSimExistente
      ?? (input.conservarNumero === true ? "CONSERVAR_NUMERO" : targetLine ? "USAR_NUMERO_SIM" : "SIN_LINEA");
    if (lineaSimExistente === "CONSERVAR_NUMERO" && !oldLine) {
      throw new ConflictError("No existe una línea actual para conservar el número.");
    }
    if (lineaSimExistente === "USAR_NUMERO_SIM" && !targetLine) {
      throw new ConflictError("La SIM seleccionada no tiene una línea/número que pueda utilizarse.");
    }
    if (lineaSimExistente === "NUMERO_NUEVO" && !input.numeroTelefonicoNuevo?.trim()) {
      throw new ValidationError("Debe informar el número telefónico nuevo.");
    }
    if (!input.entregaAnterior && lineaSimExistente === "CONSERVAR_NUMERO") {
      throw new ConflictError("No se puede mover el número del equipo anterior mientras su devolución esté pendiente.");
    }
  }

  let nuevaSimTransfiereLinea = false;
  if (accion === "REGISTRAR_SIM_NUEVA") {
    const creada = await crearSimNuevaEnReemplazo(
      anterior,
      nuevo,
      oldSim,
      oldLine,
      input,
      replacementId,
      client
    );
    targetSim = creada.sim;
    targetLine = creada.linea;
    nuevaSimTransfiereLinea = creada.transfiereLinea;
  }

  const detalle = {
    reemplazoId: replacementId,
    accionSim: accion,
    simAnteriorCodigo: oldSim?.sim_codigo_inventario ?? null,
    simDestinoCodigo: targetSim?.sim_codigo_inventario ?? null,
    lineaAnteriorId: oldLine?.id ?? null,
    lineaDestinoId: targetLine?.id ?? null
  };

  const lineaTransferida = nuevaSimTransfiereLinea || (accion === "USAR_SIM_EXISTENTE" && lineaSimExistente === "CONSERVAR_NUMERO");
  const simReceiptContext = oldSim && input.entregaAnterior && accion !== "MOVER_SIM_ACTUAL"
    ? {
        simId: oldSim.sim_id,
        simCodigoInventario: oldSim.sim_codigo_inventario,
        simIccid: oldSim.iccid_codigo_fabrica,
        dispositivoAnteriorId: anterior.dispositivo_id,
        colaboradorAnteriorId: anterior.colaborador_id,
        lineaAnteriorId: lineaTransferida ? null : oldLine?.id ?? null,
        lineaNumeroTelefonico: lineaTransferida ? null : oldLine?.numero_telefonico ?? null,
        replacementId,
        responsable: input.responsable,
        observaciones: input.observaciones
      }
    : null;

  if (!input.entregaAnterior) {
    if (accion === "USAR_SIM_EXISTENTE") {
      if ((lineaSimExistente === "NUMERO_NUEVO" || lineaSimExistente === "SIN_LINEA") && targetLine?.sim_id) {
        await desasociarVinculoLineaSim(targetLine.id, targetLine.sim_id, client);
        await insertarHistorialLineaMovil(targetLine.id, "REEMPLAZO_SIM_LINEA_DESVINCULADA", input.responsable, input.observaciones, detalle, client);
      }
      await asociarSimAReemplazo(targetSim!, nuevo, input, client);
      if (lineaSimExistente === "NUMERO_NUEVO") {
        const nuevaLinea = await crearLineaNuevaParaReemplazo(input.numeroTelefonicoNuevo!, nuevo, input, replacementId, client);
        await sincronizarVinculoLineaSim(nuevaLinea!.id, targetSim!.sim_id, "REEMPLAZO_SIM_NUMERO_NUEVO", client);
        await insertarHistorialLineaMovil(nuevaLinea!.id, "REEMPLAZO_SIM_ASOCIADA", input.responsable, input.observaciones, detalle, client);
      } else if (lineaSimExistente === "USAR_NUMERO_SIM" && targetLine) {
        await actualizarVinculosLinea(targetLine.id, nuevo.dispositivo_id, nuevo.colaborador_id, client);
        await insertarHistorialLineaMovil(targetLine.id, "REEMPLAZO_SIM_ASOCIADA", input.responsable, input.observaciones, detalle, client);
      }
      await insertarHistorialDispositivo(nuevo.dispositivo_id, "REEMPLAZO_SIM_RESUELTA", nuevo.estado_id, nuevo.estado_id, input.responsable, input.observaciones, detalle, client);
    }
    return null;
  }

    if (accion === "SIN_SIM") {
    if (oldLine) {
      await actualizarVinculosLinea(oldLine.id, null, null, client);
      await insertarHistorialLineaMovil(oldLine.id, "REEMPLAZO_SIM_RECEPCIONADA", input.responsable, input.observaciones, detalle, client);
    }
    if (oldSim) {
      await desasociarSimDeDispositivo(oldSim.sim_codigo_inventario, client);
    }
  } else if (accion === "MOVER_SIM_ACTUAL") {
    await desasociarSimDeDispositivo(oldSim!.sim_codigo_inventario, client);
    if (oldLine) {
      await sincronizarVinculoLineaSim(oldLine.id, oldSim!.sim_id, "REEMPLAZO_MOVER_SIM", client);
      await actualizarVinculosLinea(oldLine.id, nuevo.dispositivo_id, nuevo.colaborador_id, client);
      await insertarHistorialLineaMovil(oldLine.id, "REEMPLAZO_MOVER_SIM", input.responsable, input.observaciones, detalle, client);
    }
    await asociarSimADispositivo(oldSim!.sim_codigo_inventario, nuevo.dispositivo_id, client);
    if (!nuevo.colaborador_id) throw new ConflictError("La SIM no puede asignarse sin custodio colaborador.");
    const assignedState = await obtenerEstadoSimPorCodigo("ASIGNADA", client);
    if (!assignedState) throw new NotFoundError("No existe un estado ASIGNADA activo para SIM.");
    const assigned = await asignarSimAColaborador(oldSim!.sim_codigo_inventario, Number(nuevo.colaborador_id), client);
    if (!assigned) throw new NotFoundError("No fue posible asignar la SIM al colaborador del equipo nuevo.");
    const stateUpdated = await cambiarEstadoSim(oldSim!.sim_codigo_inventario, assignedState.id, client);
    if (!stateUpdated) throw new NotFoundError("No fue posible marcar la SIM como ASIGNADA.");
    await insertarHistorialSim(oldSim!.sim_id, "REEMPLAZO_MOVER_SIM", oldSim!.estado_id, assignedState.id, input.responsable, input.observaciones, detalle, client);
  } else if (accion === "REGISTRAR_SIM_NUEVA") {
    // La SIM y la línea ya fueron creadas/resueltas dentro de la transacción.
  } else if (accion === "USAR_SIM_EXISTENTE" && lineaSimExistente === "CONSERVAR_NUMERO") {
    if (!oldLine) throw new ConflictError("No existe una línea actual para conservar el número.");
    if (oldSim) await desasociarSimDeDispositivo(oldSim.sim_codigo_inventario, client);
    await sincronizarVinculoLineaSim(oldLine.id, targetSim!.sim_id, "REEMPLAZO_USAR_SIM_CONSERVAR_NUMERO", client, oldSim?.sim_id ?? null);
    await actualizarVinculosLinea(oldLine.id, nuevo.dispositivo_id, nuevo.colaborador_id, client);
    await asociarSimAReemplazo(targetSim!, nuevo, input, client);
    await insertarHistorialLineaMovil(oldLine.id, "REEMPLAZO_USAR_SIM_CONSERVAR_NUMERO", input.responsable, input.observaciones, detalle, client);
  } else if (accion === "USAR_SIM_EXISTENTE") {
    if (lineaSimExistente === "USAR_NUMERO_SIM" && !targetLine) throw new ConflictError("La SIM seleccionada no tiene una línea/número que pueda utilizarse.");
    if (oldLine) {
      await actualizarVinculosLinea(oldLine.id, null, null, client);
      await insertarHistorialLineaMovil(oldLine.id, "REEMPLAZO_SIM_RECEPCIONADA", input.responsable, input.observaciones, detalle, client);
    }
    if (oldSim) await desasociarSimDeDispositivo(oldSim.sim_codigo_inventario, client);
    if ((lineaSimExistente === "NUMERO_NUEVO" || lineaSimExistente === "SIN_LINEA") && targetLine?.sim_id) {
      await desasociarVinculoLineaSim(targetLine.id, targetLine.sim_id, client);
      await insertarHistorialLineaMovil(targetLine.id, "REEMPLAZO_SIM_LINEA_DESVINCULADA", input.responsable, input.observaciones, detalle, client);
    }
    await asociarSimAReemplazo(targetSim!, nuevo, input, client);
    if (lineaSimExistente === "NUMERO_NUEVO") {
      const nuevaLinea = await crearLineaNuevaParaReemplazo(input.numeroTelefonicoNuevo!, nuevo, input, replacementId, client);
      await sincronizarVinculoLineaSim(nuevaLinea!.id, targetSim!.sim_id, "REEMPLAZO_SIM_NUMERO_NUEVO", client);
      await insertarHistorialLineaMovil(nuevaLinea!.id, "REEMPLAZO_SIM_ASOCIADA", input.responsable, input.observaciones, detalle, client);
    } else if (lineaSimExistente === "USAR_NUMERO_SIM") {
      await actualizarVinculosLinea(targetLine!.id, nuevo.dispositivo_id, nuevo.colaborador_id, client);
      await insertarHistorialLineaMovil(targetLine!.id, "REEMPLAZO_USAR_SIM_LINEA_DESTINO", input.responsable, input.observaciones, detalle, client);
    }
  }

  await insertarHistorialDispositivo(nuevo.dispositivo_id, "REEMPLAZO_SIM_RESUELTA", nuevo.estado_id, nuevo.estado_id, input.responsable, input.observaciones, detalle, client);
  return simReceiptContext;
};

const aplicarDestino = async (
  anterior: DispositivoRow,
  destino: DestinoDispositivoAnterior,
  input: { motivoBaja?: MotivoBaja; observaciones?: string | null; responsable: string },
  client: PoolClient
): Promise<DispositivoRow> => {
  const estado = await obtenerEstadoDispositivoPorCodigo(destino, client);
  if (!estado) throw new NotFoundError(`No existe el estado de destino ${destino}.`);

  if (destino === "DADO_BAJA") {
    assertDispositivoSinSimParaBaja(anterior);
    if (!input.motivoBaja) throw new ValidationError("El motivo de baja es obligatorio para este destino.");
    const activeDisposal = await client.query<{ id: string }>(
      `SELECT id FROM itam.bajas_dispositivo WHERE dispositivo_id = $1 AND anulada = FALSE LIMIT 1`,
      [anterior.dispositivo_id]
    );
    if (activeDisposal.rows[0]) throw new ConflictError("El dispositivo anterior ya tiene una baja patrimonial activa.");
    const updated = await darDeBajaYLiberarCustodia(anterior.dispositivo_codigo_inventario, Number(estado.id), client);
    if (!updated) throw new NotFoundError("No fue posible aplicar la baja del dispositivo anterior.");
    await registrarBajaDispositivo(
      anterior.dispositivo_id,
      input.motivoBaja,
      input.observaciones,
      Number(anterior.valor_comercial),
      input.responsable,
      null,
      client
    );
    return updated;
  }

  const updated = await cambiarEstadoDispositivo(anterior.dispositivo_codigo_inventario, Number(estado.id), client);
  if (!updated) throw new NotFoundError("No fue posible aplicar el destino del dispositivo anterior.");
  return updated;
};

const registrarRecepcion = async (
  replacement: ReemplazoDispositivoRow,
  anterior: DispositivoRow,
  input: RecibirReemplazoInput,
  simReceipt: SimRecepcionReemplazo | null,
  simEntregada: boolean | null,
  client: PoolClient,
  detectarSimPendiente = true
): Promise<{ updated: DispositivoRow; comprobante: { id: string; numeroComprobante: string; fecha: string; resultado: "DEVUELTO" | "DANADO" } }> => {
  const destino = assertDestinoValido(input.destinoDispositivoAnterior);
  assertNoTerminal(anterior);
  if (anterior.colaborador_id !== replacement.colaborador_id) {
    throw new ConflictError("El dispositivo anterior ya no está bajo custodia del colaborador esperado.");
  }
  if (anterior.departamento_id) throw new ConflictError("El dispositivo anterior ya no está bajo custodia directa del colaborador esperado.");
  await assertNoOpenTechnicalOrder(anterior.dispositivo_id, client);
  const detectedSim = simReceipt ?? (detectarSimPendiente
    ? await obtenerContextoSimReemplazo(
        anterior,
        replacement.id,
        input.responsable,
        input.observaciones,
        client
      )
    : null);
  if (!simReceipt && detectedSim && simEntregada === null) {
    throw new ValidationError("Debe indicar si la SIM también fue entregada físicamente.");
  }
  const resolvedSimEntregada = simReceipt ? true : detectedSim ? simEntregada : null;

  const actaDetalleId = await buscarActaDetalleVigente(
    anterior.dispositivo_id,
    anterior.colaborador_id,
    anterior.departamento_id,
    client
  );
  const retainedState = await obtenerEstadoDispositivoPorCodigo("RETENIDO_REVISION", client);
  if (!retainedState) throw new NotFoundError("No existe el estado RETENIDO_REVISION.");
  const retained = await devolverDispositivo(anterior.dispositivo_codigo_inventario, String(retainedState.id), client);
  if (!retained) throw new NotFoundError("No fue posible registrar la recepción del dispositivo anterior.");
  const comprobante = await crearComprobante({
    dispositivoId: anterior.dispositivo_id,
    actaEntregaDetalleId: actaDetalleId,
    colaboradorId: anterior.colaborador_id,
    departamentoId: null,
    devueltoPorId: anterior.colaborador_id,
    condicion: input.condicion,
    resultado: input.resultado ?? "DEVUELTO",
    observaciones: input.observaciones,
    responsableTi: input.responsable,
    origen: "REEMPLAZO"
  }, client);
  if (detectedSim && resolvedSimEntregada === true) {
    await recibirSimPorReemplazoEnTi(detectedSim, comprobante.id, client);
  } else if (detectedSim && resolvedSimEntregada === false) {
    await registrarSimNoEntregadaEnDevolucion(detectedSim, comprobante.id, client);
  }
  const current = await obtenerDispositivoPorCodigo(anterior.dispositivo_codigo_inventario, client, true);
  if (!current) throw new NotFoundError("No fue posible recargar el dispositivo recibido.");
  const updated = await aplicarDestino(current, destino, input, client);
  return {
    updated,
    comprobante: {
      id: comprobante.id,
      numeroComprobante: comprobante.numero_comprobante,
      fecha: toIsoDateTime(comprobante.fecha),
      resultado: comprobante.resultado
    }
  };
};

const normalizarError = (error: unknown): never => {
  if (isUniqueViolation(error)) {
    const constraint = typeof error === "object" && error !== null && "constraint" in error ? String(error.constraint) : "";
    if (constraint === "uq_reemplazo_pendiente_anterior") throw new ConflictError("El dispositivo anterior ya tiene un reemplazo pendiente de devolución.");
    if (constraint === "uq_reemplazo_pendiente_nuevo") throw new ConflictError("El dispositivo nuevo ya participa en un reemplazo pendiente.");
    if (constraint === "uq_reemplazo_comprobante") throw new ConflictError("El comprobante ya está asociado a otro reemplazo.");
    throw new ConflictError("El reemplazo ya fue registrado o entra en conflicto con otra operación.");
  }
  if (isForeignKeyViolation(error)) throw new ConflictError("El reemplazo referencia un recurso que no existe o no es válido.");
  throw error;
};

export const crearReemplazoDispositivo = async (input: CrearReemplazoInput): Promise<ReemplazoDispositivo> => {
  if (input.dispositivoAnteriorCodigo === input.dispositivoNuevoCodigo) throw new ValidationError("El dispositivo anterior y el nuevo deben ser distintos.");
  if (input.entregaAnterior) assertDestinoValido(input.destinoDispositivoAnterior);
  const actorId = currentUserId();
  if (!actorId) throw new ConflictError("La sesión no permite identificar al usuario ejecutor.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const colaborador = await obtenerColaboradorPorId(input.colaboradorId, client);
    assertColaboradorActivoLocal(colaborador);
    const lockedCollaborator = await client.query<{ id: string }>(
      "SELECT id FROM itam.colaboradores WHERE id = $1 FOR UPDATE",
      [input.colaboradorId]
    );
    if (!lockedCollaborator.rows[0]) throw new NotFoundError("Colaborador no encontrado.");
    const anterior = await obtenerDispositivoPorCodigo(input.dispositivoAnteriorCodigo, client, true);
    const nuevo = await obtenerDispositivoPorCodigo(input.dispositivoNuevoCodigo, client, true);
    if (!anterior || !nuevo) throw new NotFoundError("No se encontró uno de los dispositivos del reemplazo.");
    assertNoTerminal(anterior);
    assertNoTerminal(nuevo);
    if (anterior.colaborador_id !== String(input.colaboradorId) || anterior.departamento_id) {
      throw new ConflictError("El dispositivo anterior no pertenece actualmente al colaborador seleccionado.");
    }
    assertCustodiaLibre(nuevo);
    await assertNoOpenTechnicalOrder(nuevo.dispositivo_id, client);
    await assertNoOpenTechnicalOrder(anterior.dispositivo_id, client);

    const replacementId = await insertarReemplazoPendiente({
      colaboradorId: input.colaboradorId,
      dispositivoAnteriorId: anterior.dispositivo_id,
      dispositivoNuevoId: nuevo.dispositivo_id,
      observacion: input.observaciones ?? null,
      usuarioInicioId: actorId
    }, client);

    const estadoAsignado = await obtenerEstadoDispositivoPorCodigo("ASIGNADO", client);
    if (!estadoAsignado) throw new NotFoundError("No existe el estado ASIGNADO.");
    const nuevoAsignado = await asignarDispositivoAColaborador(
      input.dispositivoNuevoCodigo,
      input.colaboradorId,
      String(estadoAsignado.id),
      client
    );
    if (!nuevoAsignado) throw new ConflictError("El dispositivo nuevo dejó de estar disponible para asignación.");

    const simReceipt = await resolverSimReemplazo(
      anterior,
      nuevoAsignado,
      input,
      replacementId,
      client
    );

    await insertarHistorialDispositivo(
      nuevoAsignado.dispositivo_id,
      input.entregaAnterior ? "REEMPLAZO_ENTREGA_INMEDIATA" : "REEMPLAZO_ENTREGA_PENDIENTE",
      nuevo.estado_id,
      nuevoAsignado.estado_id,
      input.responsable,
      input.observaciones,
      {
        reemplazoId: replacementId,
        operacion: "REEMPLAZO",
        colaboradorId: input.colaboradorId,
        dispositivoAnteriorCodigo: anterior.dispositivo_codigo_inventario,
        dispositivoNuevoCodigo: nuevoAsignado.dispositivo_codigo_inventario,
        entregaAnterior: input.entregaAnterior
      },
      client
    );

    if (input.entregaAnterior) {
      const received = await registrarRecepcion(
        { ...({} as ReemplazoDispositivoRow), id: replacementId, colaborador_id: String(input.colaboradorId) },
        anterior,
        {
          destinoDispositivoAnterior: input.destinoDispositivoAnterior!,
          motivoBaja: input.motivoBaja,
          condicion: input.condicion,
          resultado: input.resultado,
          observaciones: input.observaciones,
          responsable: input.responsable
        },
        simReceipt,
        true,
        client,
        false
      );
      if (!await completarReemplazo(replacementId, {
        comprobanteDevolucionId: received.comprobante.id,
        destinoDispositivoAnterior: input.destinoDispositivoAnterior!,
        usuarioCierreId: actorId
      }, client)) throw new ConflictError("El reemplazo no pudo marcarse como completado.");
      await insertarHistorialDispositivo(
        received.updated.dispositivo_id,
        "REEMPLAZO_RECEPCION_ANTERIOR",
        anterior.estado_id,
        received.updated.estado_id,
        input.responsable,
        input.observaciones,
        {
          reemplazoId: replacementId,
          dispositivoAnteriorCodigo: anterior.dispositivo_codigo_inventario,
          dispositivoNuevoCodigo: nuevoAsignado.dispositivo_codigo_inventario,
          comprobanteDevolucionId: received.comprobante.id,
          destinoDispositivoAnterior: input.destinoDispositivoAnterior
        },
        client
      );
    } else {
      await insertarHistorialDispositivo(
        anterior.dispositivo_id,
        "REEMPLAZO_DEVOLUCION_PENDIENTE",
        anterior.estado_id,
        anterior.estado_id,
        input.responsable,
        input.observaciones,
        {
          reemplazoId: replacementId,
          dispositivoAnteriorCodigo: anterior.dispositivo_codigo_inventario,
          dispositivoNuevoCodigo: nuevoAsignado.dispositivo_codigo_inventario,
          entregaAnterior: false,
          custodioConservado: true,
          custodiaAnterior: snapshot(anterior)
        },
        client
      );
    }

    const result = await client.query<ReemplazoDispositivoRow>(`${replacementSelect} WHERE r.id = $1`, [replacementId]);
    await client.query("COMMIT");
    return mapReplacement(result.rows[0]!);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarError(error);
  } finally {
    client.release();
  }
};

export const recibirReemplazoPendiente = async (id: string, input: RecibirReemplazoInput): Promise<ReemplazoDispositivo> => {
  const actorId = currentUserId();
  if (!actorId) throw new ConflictError("La sesión no permite identificar al usuario ejecutor.");
  assertDestinoValido(input.destinoDispositivoAnterior);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const replacement = await obtenerReemplazoPendientePorId(id, client);
    if (!replacement) throw new ConflictError("El reemplazo no existe o ya fue cerrado.");
    const anterior = await obtenerDispositivoPorCodigo(replacement.dispositivo_anterior_codigo, client, true);
    if (!anterior) throw new NotFoundError("No se encontró el dispositivo anterior.");
    const received = await registrarRecepcion(replacement, anterior, input, null, input.simEntregada ?? null, client);
    if (!await completarReemplazo(id, {
      comprobanteDevolucionId: received.comprobante.id,
      destinoDispositivoAnterior: input.destinoDispositivoAnterior,
      usuarioCierreId: actorId
    }, client)) throw new ConflictError("El reemplazo ya fue cerrado por otra operación.");
    await insertarHistorialDispositivo(
      received.updated.dispositivo_id,
      "REEMPLAZO_RECEPCION_POSTERIOR",
      anterior.estado_id,
      received.updated.estado_id,
      input.responsable,
      input.observaciones,
      {
        reemplazoId: id,
        dispositivoAnteriorCodigo: anterior.dispositivo_codigo_inventario,
        comprobanteDevolucionId: received.comprobante.id,
        destinoDispositivoAnterior: input.destinoDispositivoAnterior
      },
      client
    );
    const result = await client.query<ReemplazoDispositivoRow>(`${replacementSelect} WHERE r.id = $1`, [id]);
    await client.query("COMMIT");
    return {
      ...mapReplacement(result.rows[0]!),
      comprobante: {
        id: received.comprobante.id,
        numeroComprobante: received.comprobante.numeroComprobante,
        fecha: received.comprobante.fecha,
        resultado: received.comprobante.resultado
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarError(error);
  } finally {
    client.release();
  }
};

export const obtenerReemplazosPendientes = async (): Promise<ReemplazoDispositivo[]> => (await listarReemplazosPendientes()).map(mapReplacement);
export const obtenerReemplazosDeColaborador = async (colaboradorId: number): Promise<ReemplazoDispositivo[]> => (await listarReemplazosDeColaborador(colaboradorId)).map(mapReplacement);
export const buscarReemplazoPendientePorDispositivo = obtenerReemplazoPendientePorDispositivoCodigo;
