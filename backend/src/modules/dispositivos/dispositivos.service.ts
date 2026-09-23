import { pool } from "../../config/database";
import { obtenerColaboradorPorId } from "../colaboradores/colaboradores.repository";
import { obtenerDepartamentoPorId } from "../departamentos/departamentos.repository";
import {
  buscarActaDetalleVigente,
  crearComprobante
} from "../comprobantes-devolucion/comprobantes-devolucion.repository";
import { generateInventoryCodeByFamilyId } from "../inventory-codes/inventory-code.service";
import {
  resolverTipoActivo,
  resolverTipoActivoParaAlta
} from "../tipos-dispositivo/tipos-dispositivo.service";
import {
  asociarSimADispositivo,
  asignarSimAColaborador,
  cambiarEstadoSim,
  existeOtraSimOperableConNumero,
  insertarHistorialSim,
  obtenerEstadoSimPorCodigo,
  obtenerSimPorCodigo,
  obtenerSimPorId,
  obtenerSimPorDispositivoId
} from "../sim/sim.repository";
import type { SimRow } from "../sim/sim.types";
import { normalizarNumeroTelefonicoChileno } from "../sim/sim-phone";
import {
  gestionarLineaPorExtravio,
  vincularLineaMovilADispositivo
} from "../lineas-moviles/lineas-moviles.service";
import type { LineaMovilRow } from "../lineas-moviles/lineas-moviles.types";
import { toIsoDate, toIsoDateTime } from "../../shared/dates";
import {
  AppError,
  ConflictError,
  NotFoundError,
  ValidationError,
  isDatabaseBusinessRuleViolation,
  isForeignKeyViolation,
  isUniqueViolation
} from "../../shared/errors";
import {
  actualizarDispositivo,
  asignarDispositivoAColaborador,
  asignarDispositivoADepartamento,
  buscarDispositivoPorIdentificador,
  cambiarEstadoDispositivo,
  anularBajaDispositivo,
  crearDispositivo,
  darDeBajaYLiberarCustodia,
  devolverDispositivo,
  insertarHistorialDispositivo,
  listarDispositivos,
  listarEvidenciasResponsablesDispositivo,
  listarHistorialDispositivo,
  obtenerDispositivoPorCodigo,
  obtenerDispositivoPorId,
  obtenerEstadoDispositivoPorCodigo,
  obtenerEstadoDispositivoPorId,
  obtenerResumenGerencial,
  obtenerResumenHistoricoPorTipo,
  obtenerResumenInventarioActivoPorTipo,
  obtenerResumenInventarioActivoVerificadoPorTipo,
  registrarBajaDispositivo
} from "./dispositivos.repository";
import type {
  ActualizarDispositivoInput,
  AsignarColaboradorInput,
  AsociarLineaDispositivoInput,
  AsignarDepartamentoInput,
  CambiarEstadoDispositivoInput,
  ColaboradorResumen,
  CrearDispositivoInput,
  DepartamentoResumen,
  DarBajaDispositivoInput,
  DevolverDispositivoInput,
  DispositivoFilters,
  DispositivoResumen,
  DispositivoRow,
  EvidenciaResponsableRow,
  EstadoResumen,
  HistorialDispositivo,
  HistorialDispositivoRow,
  MovimientoResponsable,
  ResponsableTrazabilidad,
  RegistrarResultadoOffboardingInput,
  ResultadoDevolucion,
  ResumenGerencial,
  SimAsociadaResumen,
  TrazabilidadDispositivo,
  TipoIdentificadorDispositivo,
  UltimoResponsableTrazabilidad
} from "./dispositivos.types";
import { insertarVerificacionFisica } from "./physical-verifications.repository";

export const obtenerIndicadoresGerenciales = async (): Promise<ResumenGerencial> => {
  const [row, porTipo, verificadoPorTipo, historicoPorTipo] = await Promise.all([
    obtenerResumenGerencial(),
    obtenerResumenInventarioActivoPorTipo(),
    obtenerResumenInventarioActivoVerificadoPorTipo(),
    obtenerResumenHistoricoPorTipo()
  ]);
  const metric = (cantidad: string | number, valor: string | number) => ({
    cantidad: Number(cantidad) || 0,
    valor: Number(valor) || 0
  });
  const inventarioActivoCantidad = porTipo.reduce(
    (total, item) => total + Number(item.cantidad),
    0
  );
  const valorInventarioActivoReal = porTipo.reduce(
    (total, item) => total + (Number(item.valor_total) || 0),
    0
  );
  const porcentaje = (parte: number, total: number) =>
    total ? Math.round((parte * 1000) / total) / 10 : 0;
  const inventarioActual = {
    cantidad: inventarioActivoCantidad,
    valorTotal: valorInventarioActivoReal
  };
  const cantidadVerificada = verificadoPorTipo.reduce(
    (total, item) => total + Number(item.cantidad),
    0
  );
  const valorVerificado = verificadoPorTipo.reduce(
    (total, item) => total + (Number(item.valor_total) || 0),
    0
  );
  const inventarioActivoRealPorTipo = porTipo.map((item) => ({
    tipo: item.tipo_nombre,
    cantidad: Number(item.cantidad) || 0,
    valorTotal: Number(item.valor_total) || 0,
    porcentajeCantidad: porcentaje(Number(item.cantidad) || 0, inventarioActivoCantidad)
  }));
  const inventarioActivoRealVerificadoPorTipo = verificadoPorTipo.map((item) => ({
    tipo: item.tipo_nombre,
    cantidad: Number(item.cantidad) || 0,
    valorTotal: Number(item.valor_total) || 0,
    porcentajeCantidad: porcentaje(Number(item.cantidad) || 0, cantidadVerificada),
    porcentajeValor: porcentaje(Number(item.valor_total) || 0, valorVerificado)
  }));
  const historicoTotal = historicoPorTipo.reduce(
    (total, item) => total + Number(item.cantidad),
    0
  );
  return {
    inventarioActual,
    dispositivosVerificados: {
      cantidad: cantidadVerificada,
      porcentajeSobreInventarioActual: porcentaje(cantidadVerificada, inventarioActual.cantidad),
      valorTotal: valorVerificado,
      pendientes: Math.max(0, inventarioActual.cantidad - cantidadVerificada)
    },
    inventarioActivoRealPorTipo,
    inventarioActivoRealVerificadoPorTipo,
    verificadosPorTipo: inventarioActivoRealVerificadoPorTipo,
    historicoRegistradoPorTipo: historicoPorTipo.map((item) => ({
      tipo: item.tipo_nombre,
      cantidad: Number(item.cantidad) || 0,
      porcentajeCantidad: porcentaje(Number(item.cantidad) || 0, historicoTotal),
      valorHistorico: Number(item.valor_total) || 0
    })),
    inventarioOperacional: metric(
      row.inventario_operacional_cantidad,
      row.inventario_operacional_valor
    ),
    disponibles: metric(row.disponibles_cantidad, row.disponibles_valor),
    asignados: metric(row.asignados_cantidad, row.asignados_valor),
    servicioTecnico: metric(
      row.servicio_tecnico_cantidad,
      row.servicio_tecnico_valor
    ),
    extraviados: metric(row.extraviados_cantidad, row.extraviados_valor),
    bajas: metric(row.bajas_cantidad, row.bajas_valor),
    valorInventarioActivoReal,
    valorInventarioActivoPorTipo: inventarioActivoRealPorTipo
  };
};

export const validarIdentificadorDispositivo = async (
  tipo: TipoIdentificadorDispositivo,
  valor: string,
  excludeCodigoInventario?: number
) => {
  const encontrado = await buscarDispositivoPorIdentificador(
    tipo,
    valor,
    excludeCodigoInventario
  );

  return encontrado
    ? {
        disponible: false,
        codigoInventario: encontrado.codigo_inventario,
        tipoDispositivo: encontrado.tipo_dispositivo,
        marca: encontrado.marca,
        modelo: encontrado.modelo
      }
    : { disponible: true };
};
import type { ConfiguracionFormularioTipo } from "../tipos-dispositivo/tipos-dispositivo.types";

export const normalizeSpecificAttributes = (
  attributes: Record<string, string | number | null> | undefined,
  configuration: ConfiguracionFormularioTipo
): Record<string, string | number | null> => {
  const provided = attributes ?? {};
  const allowed = new Map(
    configuration.camposEspecificos.map((field) => [field.clave, field])
  );
  const unknown = Object.keys(provided).find((key) => !allowed.has(key));
  if (unknown) {
    throw new ValidationError(
      `El atributo ${unknown} no corresponde al tipo de activo seleccionado.`
    );
  }

  const normalized: Record<string, string | number | null> = {};
  for (const field of configuration.camposEspecificos) {
    const value = provided[field.clave];
    const empty = value === undefined || value === null || value === "";
    if (field.requerido && empty) {
      throw new ValidationError(`${field.etiqueta} es obligatorio.`);
    }
    if (empty) continue;

    if (field.tipo === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new ValidationError(`${field.etiqueta} debe ser un número.`);
      }
      if (field.min !== undefined && value < field.min) {
        throw new ValidationError(`${field.etiqueta} debe ser mayor o igual a ${field.min}.`);
      }
      if (field.max !== undefined && value > field.max) {
        throw new ValidationError(`${field.etiqueta} debe ser menor o igual a ${field.max}.`);
      }
      normalized[field.clave] = value;
      continue;
    }

    if (typeof value !== "string") {
      throw new ValidationError(`${field.etiqueta} debe ser texto.`);
    }
    const clean = value.trim();
    if (field.maxLength !== undefined && clean.length > field.maxLength) {
      throw new ValidationError(
        `${field.etiqueta} admite hasta ${field.maxLength} caracteres.`
      );
    }
    if (field.tipo === "select" && !field.opciones?.includes(clean)) {
      throw new ValidationError(`${field.etiqueta} no contiene una opción válida.`);
    }
    normalized[field.clave] = clean;
  }
  return normalized;
};

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
  localidad: string | null,
  departamentoId: string | null = null,
  departamentoNombre: string | null = null
): ColaboradorResumen | null => {
  if (!id || !rut || !nombre) {
    return null;
  }

  return {
    id,
    rut,
    nombre,
    cargo,
    localidad,
    departamento:
      departamentoId && departamentoNombre
        ? { id: departamentoId, nombre: departamentoNombre }
        : null
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
    row.sim_codigo_inventario === null
  ) {
    return null;
  }

  return {
    id: row.sim_id,
    codigoInventario: row.sim_codigo_inventario,
    iccidCodigoFabrica: row.iccid_codigo_fabrica,
    numeroAsociado: row.sim_linea_numero_telefonico ?? row.numero_asociado,
    lineaMovil: row.sim_linea_movil_id && row.sim_linea_numero_telefonico && row.sim_linea_estado
      ? {
          id: row.sim_linea_movil_id,
          numeroTelefonico: row.sim_linea_numero_telefonico,
          estado: row.sim_linea_estado
        }
      : null,
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
  tipo: {
    id: row.tipo_dispositivo_id,
    nombre: row.tipo_dispositivo_nombre,
    descripcion: row.tipo_dispositivo_descripcion,
    activo: row.tipo_dispositivo_activo,
    requiereImei: row.tipo_dispositivo_requiere_imei,
    configuracionFormulario: row.tipo_dispositivo_configuracion_formulario,
    familiaCodigoInventario:
      row.tipo_familia_id &&
      row.tipo_familia_nombre &&
      row.tipo_familia_prefijo &&
      row.tipo_familia_activa !== null
        ? {
            id: row.tipo_familia_id,
            nombre: row.tipo_familia_nombre,
            prefijo: row.tipo_familia_prefijo,
            activo: row.tipo_familia_activa,
            estrategiaCodigo: row.tipo_familia_estrategia!,
            agrupaTipos: row.tipo_familia_agrupa_tipos ?? false,
            etiquetaOperativa: row.tipo_familia_etiqueta_operativa
          }
        : null
  },
  marca: row.marca,
  modelo: row.modelo,
  numeroSerie: row.numero_serie,
  imei: row.imei,
  localidad: row.localidad,
  ubicacionDetalle: row.ubicacion_detalle,
  observaciones: row.observaciones,
  atributosEspecificos: row.atributos_especificos,
  valorComercial: Number(row.valor_comercial),
  facturaAdquisicion:row.factura_adquisicion_id&&row.numero_factura?{id:row.factura_adquisicion_id,numeroFactura:row.numero_factura,fechaFactura:row.fecha_factura?toIsoDate(row.fecha_factura):null,proveedor:row.factura_proveedor,montoTotal:row.factura_monto_total===null?null:Number(row.factura_monto_total),observaciones:row.factura_observaciones,referenciaDocumental:row.factura_referencia_documental,documento:row.factura_documento_nombre_original&&row.factura_documento_mime_type&&row.factura_documento_tamano_bytes!==null?{nombreOriginal:row.factura_documento_nombre_original,mimeType:row.factura_documento_mime_type,tamanoBytes:Number(row.factura_documento_tamano_bytes)}:null}:null,
  fechaRegistro: toIsoDate(row.fecha_registro),
  fechaIngresoInventario: toIsoDateTime(row.fecha_ingreso_inventario),
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
    row.colaborador_localidad,
    row.colaborador_departamento_id,
    row.colaborador_departamento_nombre
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
  simAsociada: mapSimAsociada(row),
  lineaMovil: row.linea_movil_id && row.linea_numero_telefonico && row.linea_estado
    ? {
        id: row.linea_movil_id,
        numeroTelefonico: row.linea_numero_telefonico,
        estado: row.linea_estado
      }
    : null,
  numeroTelefonico: row.linea_numero_telefonico ?? row.numero_asociado,
  tipoCustodia: row.colaborador_id
    ? "COLABORADOR"
    : row.departamento_id
      ? "DEPARTAMENTO"
      : "NONE",
  ultimoResponsableConocido:
    row.ultimo_responsable_tipo &&
    row.ultimo_responsable_nombre &&
    row.ultimo_responsable_fecha
      ? {
          tipo: row.ultimo_responsable_tipo,
          nombre: row.ultimo_responsable_nombre,
          rut: row.ultimo_responsable_rut,
          fechaMovimiento: toIsoDateTime(row.ultimo_responsable_fecha)
        }
      : null,
  ultimoResultadoOffboarding: row.ultimo_resultado_offboarding
  ,
  origenRegistro: row.origen_registro,
  creadoManualmente: row.origen_registro === "MANUAL",
  verificacionFisica: row.ultima_verificacion_resultado
    ? {
        resultado: row.ultima_verificacion_resultado,
        fechaVerificacion: toIsoDateTime(row.ultima_verificacion_fecha!),
        observacion: row.ultima_verificacion_observacion
      }
    : null
});

const custodySnapshot = (row: DispositivoRow) => {
  if (row.colaborador_id) {
    return {
      tipo: "COLABORADOR",
      id: row.colaborador_id,
      nombre: row.colaborador_nombre,
      rut: row.colaborador_rut,
      departamento: row.colaborador_departamento_nombre
    };
  }

  if (row.departamento_id) {
    return {
      tipo: "DEPARTAMENTO",
      id: row.departamento_id,
      nombre: row.departamento_nombre,
      recibidoPor: row.recibido_por_id
        ? {
            id: row.recibido_por_id,
            nombre: row.recibido_por_nombre,
            rut: row.recibido_por_rut,
            cargo: row.recibido_por_cargo
          }
        : null
    };
  }

  return { tipo: "NONE" };
};

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
  fechaEvento: toIsoDateTime(row.fecha_evento),
  usuarioEjecutor:row.usuario_ejecutor_id&&row.usuario_ejecutor_nombre&&row.usuario_ejecutor_email?{id:row.usuario_ejecutor_id,nombre:row.usuario_ejecutor_nombre,email:row.usuario_ejecutor_email}:null,
  colaboradorHistorico:row.colaborador_historico_id&&row.colaborador_historico_nombre&&row.colaborador_historico_rut?{id:row.colaborador_historico_id,nombre:row.colaborador_historico_nombre,rut:row.colaborador_historico_rut}:null
});

const normalizarErrorDispositivo = (error: unknown): never => {
  if (isUniqueViolation(error)) {
    const constraint = typeof error === "object" && error !== null && "constraint" in error
      ? String(error.constraint)
      : "";
    if (constraint === "uq_dispositivos_imei") {
      throw new ConflictError("Este IMEI ya está registrado en ITAM.");
    }
    if (constraint === "uq_dispositivos_numero_serie") {
      throw new ConflictError("Este número de serie ya está registrado en ITAM.");
    }
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

export const asociarLineaADispositivo = async (
  codigoInventario: number,
  input: AsociarLineaDispositivoInput
): Promise<LineaMovilRow> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    console.log("[asociar-linea] codigo recibido", codigoInventario);
    const dispositivo = await obtenerDispositivoPorCodigo(codigoInventario, client, true);
    if (!dispositivo) throw new NotFoundError("No existe el equipo indicado.");
    console.log("[asociar-linea] dispositivo encontrado", {
      codigoInventario,
      dispositivoId: dispositivo.dispositivo_id,
      colaboradorId: dispositivo.colaborador_id
    });
    if (dispositivo.tipo_dispositivo_nombre.trim().toUpperCase() !== "SMARTPHONE") {
      throw new ValidationError("Solo los smartphones pueden tener línea móvil.");
    }
    let sim: SimRow | null = null;
    let estadoSimAsignada: { id: string; codigo: string; nombre: string } | null = null;
    if (input.simId) {
      sim = await obtenerSimPorId(input.simId, client, true);
      if (!sim) throw new NotFoundError("SIM no encontrada.");
      const simActualDelDispositivo = await obtenerSimPorDispositivoId(dispositivo.dispositivo_id, client);
      if (simActualDelDispositivo && simActualDelDispositivo.sim_id !== sim.sim_id) {
        throw new ConflictError("El Smartphone ya tiene una SIM asociada.");
      }
      if (sim.dispositivo_id && sim.dispositivo_id !== dispositivo.dispositivo_id) {
        throw new ConflictError("La SIM seleccionada ya está asociada a otro equipo.");
      }
      if (sim.colaborador_id && dispositivo.colaborador_id && sim.colaborador_id !== dispositivo.colaborador_id) {
        throw new ConflictError("La SIM seleccionada está asignada a otro colaborador.");
      }
      if (!["DISPONIBLE", "ASIGNADA"].includes(sim.estado_codigo)) {
        throw new ConflictError("La SIM seleccionada no está disponible para asociar.");
      }
      estadoSimAsignada = await obtenerEstadoSimPorCodigo("ASIGNADA", client);
      if (!estadoSimAsignada) {
        throw new ConflictError("No existe un estado ASIGNADA activo para SIM.");
      }
    }
    const vinculacion = await vincularLineaMovilADispositivo(
      input.numeroTelefonico,
      dispositivo.dispositivo_id,
      dispositivo.dispositivo_codigo_inventario,
      dispositivo.colaborador_id,
      input.responsable,
      input.observaciones,
      client,
      sim
    );
    if (sim && estadoSimAsignada) {
      const asociada = await asociarSimADispositivo(
        sim.sim_codigo_inventario,
        dispositivo.dispositivo_id,
        client,
        vinculacion.linea.numero_telefonico
      );
      if (!asociada) throw new NotFoundError("SIM no encontrada.");
      if (dispositivo.colaborador_id) {
        await asignarSimAColaborador(sim.sim_codigo_inventario, Number(dispositivo.colaborador_id), client);
      }
      const simActualizada = await cambiarEstadoSim(
        sim.sim_codigo_inventario,
        estadoSimAsignada.id,
        client
      );
      if (!simActualizada) throw new NotFoundError("SIM no encontrada.");
      await insertarHistorialSim(
        simActualizada.sim_id,
        "SIM_ASOCIADA",
        sim.estado_id,
        simActualizada.estado_id,
        input.responsable,
        input.observaciones,
        {
          dispositivoCodigoInventario: dispositivo.dispositivo_codigo_inventario,
          lineaMovilId: vinculacion.linea.id,
          numeroTelefonico: vinculacion.linea.numero_telefonico,
          estadoAutomatico: simActualizada.estado_codigo,
          descripcion: "SIM asociada al smartphone con número telefónico registrado."
        },
        client
      );
    }
    if (vinculacion.creada || vinculacion.numeroActualizado) {
      await insertarHistorialDispositivo(
        dispositivo.dispositivo_id,
        vinculacion.numeroActualizado
          ? "LINEA_MOVIL_NUMERO_ACTUALIZADO"
          : "LINEA_MOVIL_ASOCIADA_A_DISPOSITIVO",
        dispositivo.estado_id,
        dispositivo.estado_id,
        input.responsable,
        input.observaciones,
        {
          lineaMovilId: vinculacion.linea.id,
          numeroTelefonico: vinculacion.linea.numero_telefonico,
          descripcion: vinculacion.numeroActualizado
            ? "Número telefónico actualizado manualmente en línea móvil asociada al smartphone."
            : "Línea móvil asociada al Smartphone sin SIM física."
        },
        client
      );
    }
    if (
      !vinculacion.linea?.id
      || !vinculacion.linea.numero_telefonico
      || !vinculacion.linea.estado
      || !vinculacion.linea.dispositivo_id
    ) {
      throw new AppError(
        500,
        "LINEA_MOVIL_SAVE_UNCONFIRMED",
        "No se pudo confirmar el guardado de la línea móvil."
      );
    }
    await client.query("COMMIT");
    return vinculacion.linea;
  } catch (error) {
    console.error("[asociar-linea] error", error);
    await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    client.release();
  }
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

export const obtenerDispositivoPorIdInterno = async (
  dispositivoId: number
): Promise<DispositivoResumen> => {
  const dispositivo = await obtenerDispositivoPorId(dispositivoId);

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

    const tipo = await resolverTipoActivoParaAlta(
      input.tipoDispositivoId,
      client
    );
    const atributosEspecificos = normalizeSpecificAttributes(
      input.atributosEspecificos,
      tipo.configuracion_formulario
    );
    const codigoInventario = await generateInventoryCodeByFamilyId(
      tipo.familia_codigo_inventario_id!,
      "DISPOSITIVO",
      client
    );
    const dispositivo = await crearDispositivo(
      { ...input, atributosEspecificos },
      codigoInventario,
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
        codigoInventario,
        tipoDispositivo: { id: tipo.id, nombre: tipo.nombre },
        atributosEspecificos
      },
      client
    );

    const identificadorEsperado = tipo.nombre.trim().toUpperCase() === "SMARTPHONE"
      ? dispositivo.imei
      : dispositivo.numero_serie;
    await insertarVerificacionFisica(
      {
        id: dispositivo.dispositivo_id,
        estado_id: dispositivo.estado_id,
        estado_codigo: dispositivo.estado_codigo,
        tipo_nombre: dispositivo.tipo_dispositivo_nombre,
        numero_serie: dispositivo.numero_serie,
        imei: dispositivo.imei,
        colaborador_id: dispositivo.colaborador_id,
        departamento_id: dispositivo.departamento_id,
        origen_registro: "MANUAL"
      },
      {
        encontrado: true,
        identificadorComprobado: identificadorEsperado,
        identificadorEsperado,
        resultado: "VERIFICADO",
        observacion: "Equipo verificado automáticamente al registrarse manualmente en ITAM.",
        responsable: input.responsable,
        motivo: "registro manual del equipo",
        tipoEvento: "EQUIPO_VERIFICADO_POR_REGISTRO_MANUAL",
        descripcion: "Equipo verificado automáticamente al registrarse manualmente en ITAM."
      },
      client
    );

    const dispositivoCreado = await obtenerDispositivoPorCodigo(codigoInventario, client);
    if (!dispositivoCreado) {
      throw new AppError(500, "DEVICE_CREATE_UNCONFIRMED", "No se pudo confirmar el registro del equipo.");
    }
    await client.query("COMMIT");

    return mapDispositivo(dispositivoCreado);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    client.release();
  }
};

export interface CambioCampoDispositivo {
  campo: string;
  valorAnterior: unknown;
  valorNuevo: unknown;
}

const canonicalValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)])
    );
  }
  return value;
};

export const detectarCambiosDispositivo = (
  anterior: DispositivoRow,
  nuevo: DispositivoRow,
  input: ActualizarDispositivoInput
): CambioCampoDispositivo[] => {
  const cambios: CambioCampoDispositivo[] = [];
  const add = (campo: string, valorAnterior: unknown, valorNuevo: unknown) => {
    if (JSON.stringify(canonicalValue(valorAnterior)) !== JSON.stringify(canonicalValue(valorNuevo))) {
      cambios.push({ campo, valorAnterior, valorNuevo });
    }
  };
  if (input.marca !== undefined) add("marca", anterior.marca, nuevo.marca);
  if (input.modelo !== undefined) add("modelo", anterior.modelo, nuevo.modelo);
  if (input.numeroSerie !== undefined) add("numeroSerie", anterior.numero_serie, nuevo.numero_serie);
  if (input.imei !== undefined) add("imei", anterior.imei, nuevo.imei);
  if (input.localidad !== undefined) add("localidad", anterior.localidad, nuevo.localidad);
  if (input.ubicacionDetalle !== undefined) add("ubicacionDetalle", anterior.ubicacion_detalle, nuevo.ubicacion_detalle);
  if (input.observaciones !== undefined) add("observaciones", anterior.observaciones, nuevo.observaciones);
  if (input.atributosEspecificos !== undefined) add(
    "atributosEspecificos", anterior.atributos_especificos, nuevo.atributos_especificos
  );
  if (input.valorComercial !== undefined) add(
    "valorComercial", Number(anterior.valor_comercial), Number(nuevo.valor_comercial)
  );
  return cambios;
};

export const actualizarDispositivoExistente = async (
  codigoInventario: number,
  input: ActualizarDispositivoInput
): Promise<DispositivoResumen> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const anterior = await obtenerDispositivoPorCodigo(codigoInventario, client, true);
    if (!anterior) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    let nuevoTipo = null;
    if (input.tipoDispositivoId !== undefined) {
      nuevoTipo = await resolverTipoActivo(input.tipoDispositivoId, client);
      const familiaAnterior = anterior.tipo_familia_id;
      const familiaNueva = nuevoTipo.familia_codigo_inventario_id;
      if (familiaAnterior !== familiaNueva) {
        throw new ConflictError(
          "No se puede cambiar el tipo porque alteraría la familia histórica del código ITAM."
        );
      }
    }
    if (input.atributosEspecificos !== undefined || nuevoTipo) {
      input.atributosEspecificos = normalizeSpecificAttributes(
        input.atributosEspecificos,
        nuevoTipo?.configuracion_formulario ??
          anterior.tipo_dispositivo_configuracion_formulario
      );
    }
    const dispositivo = await actualizarDispositivo(
      codigoInventario,
      input,
      client
    );

    if (!dispositivo) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    if (nuevoTipo && nuevoTipo.id !== anterior.tipo_dispositivo_id) {
      await insertarHistorialDispositivo(
        anterior.dispositivo_id,
        "CAMBIAR_TIPO_DISPOSITIVO",
        anterior.estado_id,
        anterior.estado_id,
        input.responsable,
        null,
        {
          tipoAnterior: {
            id: anterior.tipo_dispositivo_id,
            nombre: anterior.tipo_dispositivo_nombre,
            familiaCodigoInventarioId: anterior.tipo_familia_id
          },
          tipoNuevo: {
            id: nuevoTipo.id,
            nombre: nuevoTipo.nombre,
            familiaCodigoInventarioId: nuevoTipo.familia_codigo_inventario_id
          }
        },
        client
      );
    }

    const cambios = detectarCambiosDispositivo(anterior, dispositivo, input);
    if (cambios.length > 0) {
      await insertarHistorialDispositivo(
        anterior.dispositivo_id,
        "ACTUALIZAR_DISPOSITIVO",
        anterior.estado_id,
        dispositivo.estado_id,
        input.responsable,
        null,
        { cambios },
        client
      );
    }

    await client.query("COMMIT");

    return mapDispositivo(dispositivo);
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    client.release();
  }
};

export const assertSinOrdenServicioAbierta = async (
  dispositivoId: string,
  client: import("pg").PoolClient
): Promise<void> => {
  const result = await client.query(
    `SELECT id FROM itam.ordenes_servicio_tecnico
     WHERE dispositivo_id=$1
       AND estado NOT IN ('CERRADA','BAJA','REPARACION_RECHAZADA')
     LIMIT 1`,
    [dispositivoId]
  );
  if (result.rows[0]) {
    throw new ConflictError(
      "El equipo ya se encuentra en servicio técnico."
    );
  }
};

const assertCustodiaDisponible = (dispositivo: DispositivoRow): void => {
  if (dispositivo.colaborador_id || dispositivo.departamento_id) {
    throw new ConflictError(
      "El dispositivo ya tiene un custodio vigente. Registre primero su devolución."
    );
  }
};

const assertNoTerminal = async (dispositivo: DispositivoRow): Promise<void> => {
  const estado = await obtenerEstadoDispositivoPorId(Number(dispositivo.estado_id));
  if (estado && ["EXTRAVIADO", "DADO_BAJA"].includes(estado.codigo)) {
    throw new ConflictError(
      `El dispositivo está en estado terminal ${estado.nombre} y no admite esta operación.`
    );
  }
};

export const assertColaboradorActivo = (
  colaborador: { activo: boolean } | null
): void => {
  if (!colaborador) throw new NotFoundError("Colaborador no encontrado.");
  if (!colaborador.activo) {
    throw new ConflictError("No se puede asignar custodia a un colaborador inactivo.");
  }
};

export const assertSimDisponibleParaEntrega = (sim: SimRow): void => {
  if (
    sim.estado_codigo !== "DISPONIBLE"
    || sim.dispositivo_id !== null
    || sim.colaborador_id !== null
  ) {
    throw new ConflictError(
      "La SIM seleccionada ya no está disponible para entregar."
    );
  }
};

export const assertAsignadoConCustodioUnico = (
  colaboradorId: string | null,
  departamentoId: string | null
): void => {
  if (Number(Boolean(colaboradorId)) + Number(Boolean(departamentoId)) !== 1) {
    throw new ConflictError(
      "El estado ASIGNADO requiere exactamente un custodio: colaborador o departamento."
    );
  }
};

export const assertCambioEstadoGenericoPermitido = (
  estadoActual: string,
  estadoNuevo: string,
  colaboradorId: string | null,
  departamentoId: string | null
): void => {
  if (["EXTRAVIADO", "DADO_BAJA"].includes(estadoActual)) {
    throw new ConflictError(
      `${estadoActual} es terminal. Se requiere el flujo controlado de recuperación.`
    );
  }
  if (estadoNuevo === "DADO_BAJA") {
    throw new ConflictError("Utilice la operacion de baja con motivo obligatorio.");
  }
  if (estadoNuevo === "ASIGNADO") {
    assertAsignadoConCustodioUnico(colaboradorId, departamentoId);
  }
};

export const assertRecuperacionPermitida = (
  estadoActual: string,
  estadoNuevo: string,
  motivo: string | undefined
): void => {
  if (!["EXTRAVIADO", "DADO_BAJA"].includes(estadoActual)) {
    throw new ConflictError("La recuperación solo aplica a equipos extraviados o dados de baja.");
  }
  if (!["DISPONIBLE", "SERVICIO_TECNICO"].includes(estadoNuevo)) {
    throw new ConflictError("La recuperación solo permite dejar el equipo disponible o en servicio técnico.");
  }
  if (!motivo?.trim()) {
    throw new ValidationError("El motivo de recuperación es obligatorio.");
  }
};

export const asignarAColaborador = async (
  codigoInventario: number,
  input: AsignarColaboradorInput
): Promise<DispositivoResumen> => {
  const estadoAsignado = await obtenerEstadoObligatorio("ASIGNADO");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const colaborador = await obtenerColaboradorPorId(input.colaboradorId, client);
    assertColaboradorActivo(colaborador);

    const anterior = await obtenerDispositivoPorCodigo(
      codigoInventario,
      client,
      true
    );

    if (!anterior) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    await assertNoTerminal(anterior);
    assertCustodiaDisponible(anterior);
    await assertSinOrdenServicioAbierta(anterior.dispositivo_id, client);

    const esSmartphone = anterior.tipo_dispositivo_nombre.trim().toUpperCase() === "SMARTPHONE";
    const numeroEntregaNormalizado = input.numeroTelefonico?.trim()
      ? normalizarNumeroTelefonicoChileno(input.numeroTelefonico)
      : null;
    if (numeroEntregaNormalizado && !esSmartphone) {
      throw new ValidationError("Solo los smartphones pueden tener línea móvil.");
    }

    let sim: SimRow | null = null;
    let numeroSimNormalizado: string | null = null;
    let estadoSimAsignada: { id: string; codigo: string; nombre: string } | null = null;
    if (input.simCodigoInventario !== undefined) {
      if (!esSmartphone) {
        throw new ValidationError(
          "La entrega conjunta de SIM solo está disponible para Smartphones."
        );
      }
      if (anterior.sim_id || await obtenerSimPorDispositivoId(anterior.dispositivo_id, client)) {
        throw new ConflictError("El Smartphone ya tiene una SIM asociada.");
      }
      sim = await obtenerSimPorCodigo(input.simCodigoInventario, client, true);
      if (!sim) throw new NotFoundError("SIM no encontrada.");
      assertSimDisponibleParaEntrega(sim);
      const numeroIngresado = input.numeroTelefonico?.trim()
        || sim.numero_asociado?.trim()
        || null;
      if (!numeroIngresado) {
        throw new ValidationError(
          "El número telefónico es obligatorio para entregar un Smartphone con SIM."
        );
      }
      numeroSimNormalizado = numeroEntregaNormalizado ?? normalizarNumeroTelefonicoChileno(numeroIngresado);
      if (await existeOtraSimOperableConNumero(numeroSimNormalizado, sim.sim_id, client)) {
        throw new ConflictError(
          "El número telefónico ya está registrado en otra SIM activa."
        );
      }
      estadoSimAsignada = await obtenerEstadoSimPorCodigo("ASIGNADA", client);
      if (!estadoSimAsignada) {
        throw new ConflictError("No existe un estado ASIGNADA activo para SIM.");
      }
    }

    const actualizado = await asignarDispositivoAColaborador(
      codigoInventario,
      input.colaboradorId,
      estadoAsignado.id,
      client
    );

    if (!actualizado) throw new ConflictError(
      "El dispositivo dejo de estar disponible para asignacion."
    );

    await insertarHistorialDispositivo(
      actualizado.dispositivo_id,
      "ASIGNAR_COLABORADOR",
      anterior.estado_id,
      estadoAsignado.id,
      input.responsable,
      input.observaciones,
      {
        custodiaAnterior: custodySnapshot(anterior),
        custodiaNueva: custodySnapshot(actualizado),
        ...(sim ? { simCodigoInventario: sim.sim_codigo_inventario } : {})
      },
      client
    );

    const simExistenteParaLinea = !sim && anterior.sim_id
      ? await obtenerSimPorId(anterior.sim_id, client, true)
      : null;
    let lineaEntregaGuardada = false;
    if (!sim && numeroEntregaNormalizado) {
      await vincularLineaMovilADispositivo(
        numeroEntregaNormalizado,
        actualizado.dispositivo_id,
        codigoInventario,
        String(input.colaboradorId),
        input.responsable,
        input.observaciones,
        client,
        simExistenteParaLinea
      );
      lineaEntregaGuardada = true;
    }

    if (sim && estadoSimAsignada) {
      const asociada = await asociarSimADispositivo(
        sim.sim_codigo_inventario,
        actualizado.dispositivo_id,
        client,
        numeroSimNormalizado
      );
      if (!asociada) throw new NotFoundError("SIM no encontrada.");

      const vinculacionLinea = await vincularLineaMovilADispositivo(
        numeroSimNormalizado!,
        actualizado.dispositivo_id,
        codigoInventario,
        String(input.colaboradorId),
        input.responsable,
        input.observaciones,
        client,
        sim
      );

      const asignada = await asignarSimAColaborador(
        sim.sim_codigo_inventario,
        input.colaboradorId,
        client
      );
      if (!asignada) throw new NotFoundError("SIM no encontrada.");

      const simActualizada = await cambiarEstadoSim(
        sim.sim_codigo_inventario,
        estadoSimAsignada.id,
        client
      );
      if (!simActualizada) throw new NotFoundError("SIM no encontrada.");

      await insertarHistorialSim(
        simActualizada.sim_id,
        "ASOCIAR_DISPOSITIVO",
        sim.estado_id,
        estadoSimAsignada.id,
        input.responsable,
        input.observaciones,
        {
          dispositivoCodigoInventario: codigoInventario,
          lineaMovilId: vinculacionLinea.linea.id,
          numeroTelefonico: vinculacionLinea.linea.numero_telefonico,
          estadoAutomatico: estadoSimAsignada.codigo,
          entregaConjunta: true,
          descripcion: "SIM asociada al smartphone con número telefónico registrado."
        },
        client
      );
      await insertarHistorialSim(
        simActualizada.sim_id,
        "NUMERO_TELEFONICO_REGISTRADO",
        simActualizada.estado_id,
        simActualizada.estado_id,
        input.responsable,
        input.observaciones,
        {
          numeroAnterior: sim.numero_asociado,
          lineaMovilId: vinculacionLinea.linea.id,
          numeroTelefonico: vinculacionLinea.linea.numero_telefonico,
          entregaConjunta: true,
          descripcion: "Número telefónico registrado o actualizado en la SIM."
        },
        client
      );
      await insertarHistorialSim(
        simActualizada.sim_id,
        "ASIGNAR_COLABORADOR",
        estadoSimAsignada.id,
        estadoSimAsignada.id,
        input.responsable,
        input.observaciones,
        {
          colaboradorId: input.colaboradorId,
          dispositivoCodigoInventario: codigoInventario,
          estadoAutomatico: estadoSimAsignada.codigo,
          entregaConjunta: true
        },
        client
      );

      await insertarHistorialDispositivo(
        actualizado.dispositivo_id,
        "ENTREGA_EQUIPO_CON_SIM",
        actualizado.estado_id,
        actualizado.estado_id,
        input.responsable,
        input.observaciones,
        {
          colaboradorId: input.colaboradorId,
          simCodigoInventario: simActualizada.sim_codigo_inventario,
          lineaMovilId: vinculacionLinea.linea.id,
          numeroTelefonico: vinculacionLinea.linea.numero_telefonico,
          descripcion: "Smartphone entregado con SIM y número telefónico asociado."
        },
        client
      );
    }
    const resultado = sim || lineaEntregaGuardada
      ? await obtenerDispositivoPorCodigo(codigoInventario, client)
      : actualizado;

    await client.query("COMMIT");
    return mapDispositivo(resultado!);
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

  const recepcionante = await obtenerColaboradorPorId(input.recibidoPorId);
  if (!recepcionante || !recepcionante.activo) {
    throw new NotFoundError("Persona que recepciona no encontrada o inactiva.");
  }
  if (recepcionante.departamento_id !== departamento.id) {
    throw new ValidationError(
      "La persona que recepciona debe pertenecer al departamento seleccionado."
    );
  }

  const estadoAsignado = await obtenerEstadoObligatorio("ASIGNADO");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const anterior = await obtenerDispositivoPorCodigo(
      codigoInventario,
      client,
      true
    );

    if (!anterior) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    await assertNoTerminal(anterior);
    assertCustodiaDisponible(anterior);
    await assertSinOrdenServicioAbierta(anterior.dispositivo_id, client);

    const actualizado = await asignarDispositivoADepartamento(
      codigoInventario,
      input.departamentoId,
      input.recibidoPorId,
      estadoAsignado.id,
      input.localidad,
      input.ubicacionDetalle,
      client
    );

    if (!actualizado) throw new ConflictError(
      "El dispositivo dejo de estar disponible para asignacion."
    );

    await insertarHistorialDispositivo(
      actualizado.dispositivo_id,
      "ASIGNAR_DEPARTAMENTO",
      anterior.estado_id,
      estadoAsignado.id,
      input.responsable,
      input.observaciones,
      {
        custodiaAnterior: custodySnapshot(anterior),
        custodiaNueva: custodySnapshot(actualizado),
        recepcionadoPor: {
          id: recepcionante.id,
          nombre: recepcionante.nombre,
          rut: recepcionante.rut,
          cargo: recepcionante.cargo
        },
        responsableTi: input.responsable,
        localidad: actualizado.localidad,
        ubicacion: actualizado.ubicacion_detalle
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
): Promise<ResultadoDevolucion> =>
  registrarDevolucionCentral(codigoInventario, input, "INVENTARIO");

const registrarDevolucionCentral = async (
  codigoInventario: number,
  input: DevolverDispositivoInput,
  origen: "INVENTARIO" | "OFFBOARDING"
): Promise<ResultadoDevolucion> => {
  const estadoRetenido = await obtenerEstadoObligatorio(
    "RETENIDO_REVISION"
  );
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const anterior = await obtenerDispositivoPorCodigo(
      codigoInventario,
      client,
      true
    );

    if (!anterior) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }


    await assertNoTerminal(anterior);
    if (!anterior.colaborador_id && !anterior.departamento_id) {
      throw new ConflictError("El dispositivo no tiene una custodia vigente que devolver.");
    }
    await assertSinOrdenServicioAbierta(anterior.dispositivo_id, client);

    const actaDetalleId = await buscarActaDetalleVigente(
      anterior.dispositivo_id,
      anterior.colaborador_id,
      anterior.departamento_id,
      client
    );

    const actualizado = await devolverDispositivo(
      codigoInventario,
      estadoRetenido.id,
      client
    );

    if (!actualizado) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    const comprobante = await crearComprobante(
      {
        dispositivoId: anterior.dispositivo_id,
        actaEntregaDetalleId: actaDetalleId,
        colaboradorId: anterior.colaborador_id,
        departamentoId: anterior.departamento_id,
        devueltoPorId: anterior.colaborador_id ?? anterior.recibido_por_id,
        condicion: input.condicion,
        resultado: input.resultado ?? "DEVUELTO",
        observaciones: input.observaciones,
        responsableTi: input.responsable,
        origen
      },
      client
    );

    await insertarHistorialDispositivo(
      actualizado.dispositivo_id,
      "DEVOLVER_DISPOSITIVO",
      anterior.estado_id,
      estadoRetenido.id,
      input.responsable,
      input.observaciones,
      {
        custodiaAnterior: custodySnapshot(anterior),
        custodiaNueva: custodySnapshot(actualizado),
        condicion: input.condicion ?? null,
        resultado: input.resultado ?? "DEVUELTO",
        comprobanteDevolucionId: comprobante.id,
        numeroComprobante: comprobante.numero_comprobante,
        actaEntregaDetalleId: actaDetalleId,
        origen
      },
      client
    );
    await insertarHistorialDispositivo(
      actualizado.dispositivo_id,
      "GENERAR_COMPROBANTE_DEVOLUCION",
      estadoRetenido.id,
      estadoRetenido.id,
      input.responsable,
      input.observaciones,
      {
        comprobanteDevolucionId: comprobante.id,
        numeroComprobante: comprobante.numero_comprobante,
        actaEntregaDetalleId: actaDetalleId,
        origen
      },
      client
    );
    if (origen === "OFFBOARDING") {
      await insertarHistorialDispositivo(
        actualizado.dispositivo_id,
        "RECUPERAR_ACTIVO_OFFBOARDING",
        estadoRetenido.id,
        estadoRetenido.id,
        input.responsable,
        input.observaciones,
        {
          comprobanteDevolucionId: comprobante.id,
          numeroComprobante: comprobante.numero_comprobante
        },
        client
      );
    }
    await client.query("COMMIT");

    return {
      dispositivo: mapDispositivo(actualizado),
      comprobante: {
        id: comprobante.id,
        numeroComprobante: comprobante.numero_comprobante,
        fecha: toIsoDateTime(comprobante.fecha),
        resultado: comprobante.resultado
      }
    };
  } catch (error) {
    await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    client.release();
  }
};

export const registrarResultadoOffboarding = async (
  codigoInventario: number,
  input: RegistrarResultadoOffboardingInput
): Promise<DispositivoResumen | ResultadoDevolucion> => {
  const esRecepcion = input.resultado === "DEVUELTO" || input.resultado === "DANADO";
  const esPerdida = input.resultado === "EXTRAVIADO" || input.resultado === "ROBADO_HURTADO";
  if (esRecepcion) {
    return registrarDevolucionCentral(
      codigoInventario,
      {
        responsable: input.responsable,
        observaciones: input.observaciones,
        condicion: input.condicion,
        resultado: input.resultado as "DEVUELTO" | "DANADO"
      },
      "OFFBOARDING"
    );
  }
  const estadoDestino = esPerdida ? await obtenerEstadoObligatorio("EXTRAVIADO") : null;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const anterior = await obtenerDispositivoPorCodigo(codigoInventario, client);
    if (!anterior) throw new NotFoundError("Dispositivo no encontrado.");
    if (!anterior.colaborador_id) {
      throw new ConflictError("El dispositivo no estÃ¡ bajo custodia directa de un colaborador.");
    }
    if (esPerdida) {
      await assertSinOrdenServicioAbierta(anterior.dispositivo_id, client);
    }

    let actualizado = anterior;
    if (esPerdida) {
      actualizado = await cambiarEstadoDispositivo(codigoInventario, Number(estadoDestino!.id), client) ?? anterior;
    }

    await insertarHistorialDispositivo(
      anterior.dispositivo_id,
      "RESULTADO_OFFBOARDING",
      anterior.estado_id,
      estadoDestino?.id ?? anterior.estado_id,
      input.responsable,
      input.observaciones,
      {
        resultado: input.resultado,
        condicion: input.condicion ?? null,
        custodiaAnterior: custodySnapshot(anterior),
        custodiaNueva: custodySnapshot(actualizado)
      },
      client
    );
    await client.query("COMMIT");
    const refreshed = await obtenerDispositivoPorCodigo(codigoInventario);
    return mapDispositivo(refreshed ?? actualizado);
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
      client,
      true
    );

    if (!anterior) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }


    if (input.recuperar) {
      assertRecuperacionPermitida(
        anterior.estado_codigo,
        estado.codigo,
        input.motivoRecuperacion
      );
    } else {
      await assertSinOrdenServicioAbierta(anterior.dispositivo_id, client);
    }
    if (anterior.estado_codigo === "DADO_BAJA") {
      if (!input.recuperar) {
        throw new ConflictError(
          "DADO_BAJA es terminal. Se requiere un flujo explicito de anulacion de baja."
        );
      }
    }
    if (estado.codigo === "ASIGNADO") {
      assertAsignadoConCustodioUnico(
        anterior.colaborador_id,
        anterior.departamento_id
      );
    }
    if (estado.codigo === "DADO_BAJA") {
      throw new ConflictError(
        "Utilice la operación de baja con motivo obligatorio."
      );
    }

    if (
      !input.recuperar
      && estado.codigo === "EXTRAVIADO"
      && anterior.tipo_dispositivo_nombre.trim().toUpperCase() === "SMARTPHONE"
    ) {
      const sim = anterior.sim_codigo_inventario === null
        ? null
        : await obtenerSimPorCodigo(anterior.sim_codigo_inventario, client, true);
      await gestionarLineaPorExtravio(
        {
          accion: input.accionLineaExtravio,
          sim,
          responsable: input.responsable,
          observaciones: input.observaciones
        },
        client
      );
    }

    const actualizado = input.recuperar
      ? await darDeBajaYLiberarCustodia(codigoInventario, input.estadoId, client)
      : await cambiarEstadoDispositivo(codigoInventario, input.estadoId, client);

    if (!actualizado) {
      throw new NotFoundError("Dispositivo no encontrado.");
    }

    if (input.recuperar && anterior.estado_codigo === "DADO_BAJA") {
      await anularBajaDispositivo(
        anterior.dispositivo_id,
        input.motivoRecuperacion!.trim(),
        client
      );
    }

    await insertarHistorialDispositivo(
      actualizado.dispositivo_id,
      input.recuperar
        ? anterior.estado_codigo === "DADO_BAJA"
          ? "RECUPERAR_DADO_BAJA"
          : "RECUPERAR_EXTRAVIADO"
        : "CAMBIAR_ESTADO",
      anterior.estado_id,
      estado.id,
      input.responsable,
      input.recuperar
        ? `${anterior.estado_codigo === "DADO_BAJA" ? "Baja anulada por recuperación física del equipo." : "Equipo encontrado y reincorporado a inventario."} Motivo: ${input.motivoRecuperacion!.trim()}${input.observaciones ? ` ${input.observaciones}` : ""}`
        : input.observaciones,
      {
        estadoCodigo: estado.codigo,
        ...(estado.codigo === "EXTRAVIADO" && input.accionLineaExtravio
          ? { accionLineaExtravio: input.accionLineaExtravio }
          : {})
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

export const darDeBajaDispositivo = async (
  codigoInventario: number,
  input: DarBajaDispositivoInput,
  providedClient?: import("pg").PoolClient,
  options: { ordenServicioMotivo?: string } = {}
): Promise<DispositivoResumen> => {
  const estadoBaja = await obtenerEstadoObligatorio("DADO_BAJA");
  const client = providedClient ?? (await pool.connect());
  const ownsTransaction = !providedClient;
  try {
    if (ownsTransaction) await client.query("BEGIN");
    const anterior = await obtenerDispositivoPorCodigo(codigoInventario, client, true);
    if (!anterior) throw new NotFoundError("Dispositivo no encontrado.");
    if (anterior.estado_codigo === "DADO_BAJA") {
      throw new ConflictError("El dispositivo ya se encuentra dado de baja.");
    }
    if (anterior.sim_id) {
      throw new ConflictError(
        "El dispositivo tiene una SIM asociada. Desasocie la SIM antes de darlo de baja."
      );
    }
    const bajaActiva = await client.query<{ id: string }>(
      `SELECT id FROM itam.bajas_dispositivo
       WHERE dispositivo_id=$1 AND anulada=FALSE
       ORDER BY id DESC LIMIT 1`,
      [anterior.dispositivo_id]
    );
    if (bajaActiva.rows[0]) {
      throw new ConflictError("El dispositivo ya tiene una baja patrimonial activa.");
    }
    const orden = await client.query<{id:string}>(
      `SELECT id FROM itam.ordenes_servicio_tecnico
       WHERE dispositivo_id=$1 AND estado NOT IN ('CERRADA','BAJA','REPARACION_RECHAZADA')
       LIMIT 1 FOR UPDATE`,
      [anterior.dispositivo_id]
    );
    if (orden.rows[0]) {
      await client.query(
        `UPDATE itam.ordenes_servicio_tecnico
         SET estado='BAJA',decision='DAR_BAJA',motivo_decision=$2,
             observacion_decision=$4,fecha_decision=NOW(),responsable_decision=$3
         WHERE id=$1`,
        [orden.rows[0].id,options.ordenServicioMotivo ?? input.motivo,
          input.responsable,input.observaciones ?? null]
      );
    }
    const actualizado = await darDeBajaYLiberarCustodia(
      codigoInventario,Number(estadoBaja.id),client
    );
    if (!actualizado) throw new NotFoundError("Dispositivo no encontrado.");
    await registrarBajaDispositivo(
      anterior.dispositivo_id,input.motivo,input.observaciones,
      Number(anterior.valor_comercial),input.responsable,
      orden.rows[0]?.id ?? null,client
    );
    await insertarHistorialDispositivo(
      anterior.dispositivo_id,"DAR_BAJA",anterior.estado_id,estadoBaja.id,
      input.responsable,input.observaciones,
      {
        motivo: input.motivo,
        ordenServicioId: orden.rows[0]?.id ?? null,
        valorComercial: Number(anterior.valor_comercial),
        custodiaAnterior: custodySnapshot(anterior),
        custodiaNueva: custodySnapshot(actualizado)
      },client
    );
    if (ownsTransaction) await client.query("COMMIT");
    return mapDispositivo(actualizado);
  } catch (error) {
    if (ownsTransaction) await client.query("ROLLBACK");
    return normalizarErrorDispositivo(error);
  } finally {
    if (ownsTransaction) client.release();
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

const responsableActualDe = (
  dispositivo: DispositivoResumen
): ResponsableTrazabilidad | null => {
  if (dispositivo.estado.codigo !== "ASIGNADO") return null;

  if (dispositivo.colaborador) {
    return {
      tipo: "COLABORADOR",
      id: dispositivo.colaborador.id,
      nombre: dispositivo.colaborador.nombre,
      rut: dispositivo.colaborador.rut
    };
  }

  if (dispositivo.departamento) {
    return {
      tipo: "DEPARTAMENTO",
      id: dispositivo.departamento.id,
      nombre: dispositivo.departamento.nombre,
      rut: null
    };
  }

  return null;
};

const mapMovimientoResponsable = (
  row: EvidenciaResponsableRow
): MovimientoResponsable => ({
  tipo: row.tipo,
  id: row.responsable_id,
  nombre: row.nombre,
  rut: row.rut,
  fechaUltimoMovimiento: toIsoDateTime(row.fecha),
  origenDato: row.origen,
  tipoEvento: row.tipo_evento,
  estadoResultante:
    row.estado_resultante_codigo && row.estado_resultante_nombre
      ? {
          codigo: row.estado_resultante_codigo,
          nombre: row.estado_resultante_nombre
        }
      : null,
  observacion: row.observacion
});

export const construirTrazabilidadDispositivo = (
  dispositivo: DispositivoResumen,
  eventos: HistorialDispositivo[],
  evidencias: EvidenciaResponsableRow[]
): TrazabilidadDispositivo => {
  const responsableActual = responsableActualDe(dispositivo);
  const historialResponsables = evidencias.map(mapMovimientoResponsable);
  const ultimo = historialResponsables[0] ?? null;
  const ultimoResponsableConocido: UltimoResponsableTrazabilidad | null = ultimo
    ? {
        tipo: ultimo.tipo,
        id: ultimo.id,
        nombre: ultimo.nombre,
        rut: ultimo.rut,
        fechaUltimoMovimiento: ultimo.fechaUltimoMovimiento,
        origenDato: ultimo.origenDato
      }
    : null;
  const alertas: string[] = [];

  if (dispositivo.estado.codigo === "ASIGNADO" && !responsableActual) {
    alertas.push("Asignado sin responsable. Revisar custodia.");
  }
  if (dispositivo.estado.codigo === "EXTRAVIADO" && !ultimoResponsableConocido) {
    alertas.push("Equipo extraviado sin responsable conocido. Revisar historial.");
  }
  if (dispositivo.estado.codigo === "DADO_BAJA" && !ultimoResponsableConocido) {
    alertas.push("Equipo dado de baja sin responsable conocido. Revisar historial.");
  }

  return {
    dispositivo,
    responsableActual,
    ultimoResponsableConocido,
    historialResponsables,
    eventos,
    alertas
  };
};

export const obtenerTrazabilidadDispositivo = async (
  codigoInventario: number
): Promise<TrazabilidadDispositivo> => {
  const dispositivo = await obtenerDispositivo(codigoInventario);
  const [eventos, evidencias] = await Promise.all([
    obtenerHistorialDispositivo(codigoInventario),
    listarEvidenciasResponsablesDispositivo(codigoInventario)
  ]);

  return construirTrazabilidadDispositivo(dispositivo, eventos, evidencias);
};
