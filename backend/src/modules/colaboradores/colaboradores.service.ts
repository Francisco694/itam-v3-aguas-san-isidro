import { obtenerDepartamentoPorId } from "../departamentos/departamentos.repository";
import { toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  isForeignKeyViolation,
  isUniqueViolation
} from "../../shared/errors";
import {
  actualizarColaborador,
  crearColaborador,
  listarColaboradores,
  obtenerColaboradorPorId,
  obtenerColaboradorPorRut
  ,listarActivosActualesColaborador
  ,listarHistorialActivosColaborador
  ,listarInventarioConciliableColaborador
} from "./colaboradores.repository";
import { getOpenOffboardingProcesses } from "../offboarding/offboarding.service";
import type {
  ActualizarColaboradorInput,
  Colaborador,
  ColaboradorFilters,
  ColaboradorRow,
  CrearColaboradorInput,
  ActivoConciliado,
  ClasificacionConciliada,
  InventarioConciliableRow,
  InventarioConciliado,
  PendienteOffboarding
} from "./colaboradores.types";

const mapColaborador = (row: ColaboradorRow): Colaborador => ({
  id: row.id,
  rut: row.rut,
  nombre: row.nombre,
  cargo: row.cargo,
  departamento:
    row.departamento_id && row.departamento_nombre
      ? {
          id: row.departamento_id,
          nombre: row.departamento_nombre
        }
      : null,
  localidad: row.localidad,
  activo: row.activo,
  observaciones: row.observaciones,
  creadoEn: toIsoDateTime(row.creado_en),
  actualizadoEn: toIsoDateTime(row.actualizado_en)
});

const validarRutDisponible = async (
  rut: string,
  currentId?: string
): Promise<void> => {
  const existing = await obtenerColaboradorPorRut(rut);

  if (existing && existing.id !== currentId) {
    throw new ConflictError("Ya existe un colaborador con ese RUT.");
  }
};

const validarDepartamentoExiste = async (
  departamentoId: number | null | undefined
): Promise<void> => {
  if (departamentoId === undefined || departamentoId === null) {
    return;
  }

  const departamento = await obtenerDepartamentoPorId(departamentoId);

  if (!departamento) {
    throw new NotFoundError("Departamento no encontrado.");
  }
};

export const obtenerColaboradores = async (
  filters: ColaboradorFilters
): Promise<Colaborador[]> => {
  const rows = await listarColaboradores(filters);

  return rows.map(mapColaborador);
};

export const obtenerColaborador = async (
  id: number
): Promise<Colaborador> => {
  const row = await obtenerColaboradorPorId(id);

  if (!row) {
    throw new NotFoundError("Colaborador no encontrado.");
  }

  return mapColaborador(row);
};

export const obtenerColaboradorPorRutExistente = async (
  rut: string
): Promise<Colaborador> => {
  const row = await obtenerColaboradorPorRut(rut);

  if (!row) {
    throw new NotFoundError("Colaborador no encontrado.");
  }

  return mapColaborador(row);
};

export const crearNuevoColaborador = async (
  input: CrearColaboradorInput
): Promise<Colaborador> => {
  await validarRutDisponible(input.rut);
  await validarDepartamentoExiste(input.departamentoId);

  try {
    const row = await crearColaborador(input);
    return mapColaborador(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Ya existe un colaborador con ese RUT."
      );
    }

    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Departamento no encontrado.");
    }

    throw error;
  }
};

export const actualizarColaboradorExistente = async (
  id: number,
  input: ActualizarColaboradorInput
): Promise<Colaborador> => {
  const current = await obtenerColaboradorPorId(id);

  if (!current) {
    throw new NotFoundError("Colaborador no encontrado.");
  }

  if (input.rut !== undefined) {
    await validarRutDisponible(input.rut, current.id);
  }

  await validarDepartamentoExiste(input.departamentoId);

  try {
    const row = await actualizarColaborador(id, input);

    if (!row) {
      throw new NotFoundError("Colaborador no encontrado.");
    }

    return mapColaborador(row);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "Ya existe un colaborador con ese RUT."
      );
    }

    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Departamento no encontrado.");
    }

    throw error;
  }
};

export const obtenerInventarioColaborador = async (id:number) => {
  const colaborador=await obtenerColaborador(id);
  const [actuales,historial]=await Promise.all([
    listarActivosActualesColaborador(id),listarHistorialActivosColaborador(id)
  ]);
  const map=(row:import("./colaboradores.types").ActivoColaboradorRow)=>({
    id:row.dispositivo_id,codigoInventario:row.codigo_inventario,tipo:row.tipo_dispositivo,
    marca:row.marca,modelo:row.modelo,numeroSerie:row.numero_serie,imei:row.imei,
    valorComercial:Number(row.valor_comercial),estado:{codigo:row.estado_codigo,nombre:row.estado_nombre}
  });
  return {colaborador,valorTotalCustodia:actuales.reduce((sum,row)=>sum+Number(row.valor_comercial),0),
    equiposActuales:actuales.map(map),historialEquipos:historial.map(row=>({...map(row),
      fechaAsignacion:toIsoDateTime(row.fecha_asignacion),
      fechaDevolucion:row.fecha_devolucion?toIsoDateTime(row.fecha_devolucion):null,
      tipoCierre:row.tipo_cierre,
      resultado:row.resultado}))};
};

const MOTIVO_HISTORICO_RECIENTE =
  "Existe un equipo más reciente asociado al mismo colaborador; no se registra devolución física en sistema.";

const MOTIVO_HISTORICO_SIN_CIERRE =
  "La asociación figura en el historial, pero no existe una devolución física registrada.";

const esSmartphone = (tipo: string): boolean => {
  const normalizado = tipo.trim().toLocaleUpperCase("es-CL");
  return normalizado.includes("SMARTPHONE") || normalizado.includes("TELÉFONO");
};

export const esImeiValido = (imei: string | null): boolean => {
  if (!imei || !/^\d{15}$/.test(imei.trim()) || /^0+$/.test(imei.trim())) {
    return false;
  }

  const digitos = imei.trim().split("").map(Number);
  const suma = digitos.reduce((total, digito, indice) => {
    if (indice % 2 === 0) return total + digito;
    const duplicado = digito * 2;
    return total + (duplicado > 9 ? duplicado - 9 : duplicado);
  }, 0);

  return suma % 10 === 0;
};

const mapActivoConciliado = (
  row: InventarioConciliableRow,
  clasificacion: ClasificacionConciliada,
  motivo: string
): ActivoConciliado => ({
  dispositivoId: row.dispositivo_id,
  codigoItam: row.codigo_inventario,
  tipoDispositivo: row.tipo_dispositivo,
  marca: row.marca,
  modelo: row.modelo,
  imei: row.imei,
  numeroSerie: row.numero_serie,
  fechaAsignacion: toIsoDateTime(row.fecha_asignacion),
  estadoOriginal: { codigo: row.estado_codigo, nombre: row.estado_nombre },
  clasificacionConciliada: clasificacion,
  motivoConciliacion: motivo,
  requiereValidacionManual: ![
    "ACTUAL_CONFIRMADO",
    "HISTORICO_CONFIRMADO"
  ].includes(clasificacion),
  valorComercial: Number(row.valor_comercial)
});

export const clasificarInventarioConciliado = (
  rows: readonly InventarioConciliableRow[]
): Pick<InventarioConciliado, "actuales" | "historicos" | "pendientes" | "valorTotalActual"> => {
  const clasificados = new Map<string, ActivoConciliado>();
  const smartphonesVigentes: InventarioConciliableRow[] = [];

  for (const row of rows) {
    const smartphone = esSmartphone(row.tipo_dispositivo);
    const identificacionInsuficiente = smartphone
      ? !esImeiValido(row.imei)
      : !row.numero_serie?.trim() && !row.imei?.trim();

    if (identificacionInsuficiente) {
      clasificados.set(
        row.dispositivo_id,
        mapActivoConciliado(
          row,
          "PENDIENTE_VALIDACION",
          smartphone
            ? "El smartphone no tiene un IMEI válido que permita confirmar el activo físico."
            : "El activo no tiene número de serie ni otro identificador físico suficiente."
        )
      );
      continue;
    }

    if (row.identidad_duplicada) {
      clasificados.set(
        row.dispositivo_id,
        mapActivoConciliado(
          row,
          "CONFLICTO_DATOS",
          "El IMEI o número de serie aparece asociado a más de un colaborador."
        )
      );
      continue;
    }

    if (row.tiene_devolucion || row.tiene_baja) {
      clasificados.set(
        row.dispositivo_id,
        mapActivoConciliado(
          row,
          "HISTORICO_CONFIRMADO",
          row.tiene_baja
            ? "Existe una baja real registrada para el dispositivo."
            : "Existe una devolución real registrada para el dispositivo."
        )
      );
      continue;
    }

    if (row.tipo_cierre !== null) {
      clasificados.set(
        row.dispositivo_id,
        mapActivoConciliado(
          row,
          "HISTORICO_PROBABLE",
          MOTIVO_HISTORICO_SIN_CIERRE
        )
      );
      continue;
    }

    if (!row.vinculo_actual) {
      const contradiceVinculo = row.colaborador_actual_id !== null;
      clasificados.set(
        row.dispositivo_id,
        mapActivoConciliado(
          row,
          contradiceVinculo ? "CONFLICTO_DATOS" : "HISTORICO_PROBABLE",
          contradiceVinculo
            ? "El historial y el custodio actual corresponden a colaboradores distintos sin cierre confirmado."
            : MOTIVO_HISTORICO_SIN_CIERRE
        )
      );
      continue;
    }

    if (smartphone) {
      smartphonesVigentes.push(row);
      continue;
    }

    clasificados.set(
      row.dispositivo_id,
      mapActivoConciliado(
        row,
        "ACTUAL_PROBABLE",
        "Es el vínculo vigente disponible y no presenta contradicciones registradas."
      )
    );
  }

  const smartphonesOrdenados = [...smartphonesVigentes].sort((a, b) => {
    const fecha = new Date(b.fecha_asignacion).getTime() - new Date(a.fecha_asignacion).getTime();
    if (fecha !== 0) return fecha;
    return Number(b.evento_asignacion_id ?? 0) - Number(a.evento_asignacion_id ?? 0);
  });
  const fechaMasReciente = smartphonesOrdenados[0]
    ? new Date(smartphonesOrdenados[0].fecha_asignacion).getTime()
    : null;
  const ultimosSimultaneos = smartphonesOrdenados.filter(
    row => new Date(row.fecha_asignacion).getTime() === fechaMasReciente
  );

  for (const row of smartphonesOrdenados) {
    const esUltimo = new Date(row.fecha_asignacion).getTime() === fechaMasReciente;
    if (esUltimo && ultimosSimultaneos.length > 1) {
      clasificados.set(
        row.dispositivo_id,
        mapActivoConciliado(
          row,
          "CONFLICTO_DATOS",
          "Dos o más smartphones comparten la fecha de asignación más reciente; no existe evidencia suficiente para elegir uno."
        )
      );
    } else if (esUltimo) {
      clasificados.set(
        row.dispositivo_id,
        mapActivoConciliado(
          row,
          "ACTUAL_PROBABLE",
          "Es el smartphone con la asignación más reciente y no presenta contradicciones registradas."
        )
      );
    } else {
      clasificados.set(
        row.dispositivo_id,
        mapActivoConciliado(row, "HISTORICO_PROBABLE", MOTIVO_HISTORICO_RECIENTE)
      );
    }
  }

  const todos = rows.map(row => clasificados.get(row.dispositivo_id)!);
  const actuales = todos.filter(item =>
    ["ACTUAL_CONFIRMADO", "ACTUAL_PROBABLE"].includes(item.clasificacionConciliada)
  );
  const historicos = todos.filter(item =>
    ["HISTORICO_CONFIRMADO", "HISTORICO_PROBABLE"].includes(item.clasificacionConciliada)
  );
  const pendientes = todos.filter(item =>
    ["PENDIENTE_VALIDACION", "CONFLICTO_DATOS"].includes(item.clasificacionConciliada)
  );

  return {
    actuales,
    historicos,
    pendientes,
    valorTotalActual: actuales.reduce((total, item) => total + item.valorComercial, 0)
  };
};

export const obtenerInventarioConciliadoColaborador = async (
  id: number
): Promise<InventarioConciliado> => {
  const colaborador = await obtenerColaborador(id);
  const grupos = clasificarInventarioConciliado(
    await listarInventarioConciliableColaborador(id)
  );
  return { colaborador, ...grupos };
};

export const obtenerPendientesOffboarding = async ():Promise<PendienteOffboarding[]> =>
  (await getOpenOffboardingProcesses()).map(process=>({
    colaborador:process.colaborador,
    activosPendientes:process.equiposPendientes,
    valorPendiente:process.valorPendiente,
    estado:"PENDIENTE"
  }));
