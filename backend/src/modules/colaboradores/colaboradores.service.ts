import { obtenerDepartamentoPorId } from "../departamentos/departamentos.repository";
import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { toIsoDateTime } from "../../shared/dates";
import {
  AppError,
  NotFoundError,
  ValidationError,
  isForeignKeyViolation,
  isUniqueViolation
} from "../../shared/errors";
import { isValidRut, normalizeRut } from "../../shared/rut";
import {
  actualizarColaborador,
  crearColaborador,
  listarColaboradores,
  obtenerColaboradorPorId,
  obtenerColaboradorPorRut
  ,listarActivosActualesColaborador
  ,listarHistorialActivosColaborador
  ,listarEvidenciasPendientesColaborador
} from "./colaboradores.repository";
import { getOpenOffboardingProcesses } from "../offboarding/offboarding.service";
import type {
  ActualizarColaboradorInput,
  Colaborador,
  ColaboradorFilters,
  ColaboradorRow,
  CrearColaboradorInput,
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

const RUT_CONFLICT_MESSAGE =
  "Ya existe un colaborador registrado con este RUT.";

const rutAlreadyExistsError = (): AppError =>
  new AppError(409,"RUT_ALREADY_EXISTS",RUT_CONFLICT_MESSAGE);

export const collaboratorRutConflictFromError = (
  error: unknown
): AppError | null => isUniqueViolation(error)
  ? rutAlreadyExistsError()
  : null;

const canonicalRut = (rut: string): string => {
  if (!isValidRut(rut)) {
    throw new ValidationError("rut no corresponde a un RUT valido.");
  }
  return normalizeRut(rut);
};

const withTransaction = async <T>(
  client: PoolClient | undefined,
  callback: (transaction: PoolClient) => Promise<T>
): Promise<T> => {
  if (client) return callback(client);
  const transaction = await pool.connect();
  try {
    await transaction.query("BEGIN");
    const result = await callback(transaction);
    await transaction.query("COMMIT");
    return result;
  } catch (error) {
    await transaction.query("ROLLBACK");
    throw error;
  } finally {
    transaction.release();
  }
};

const lockRut = async (client: PoolClient, rut: string): Promise<void> => {
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
    [`colaborador-rut:${normalizeRut(rut)}`]
  );
};

const validarRutDisponible = async (
  rut: string,
  currentId?: string,
  client?: PoolClient
): Promise<void> => {
  const existing = await obtenerColaboradorPorRut(rut,currentId,client);

  if (existing) {
    throw rutAlreadyExistsError();
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
  const row = await obtenerColaboradorPorRut(canonicalRut(rut));

  if (!row) {
    throw new NotFoundError("Colaborador no encontrado.");
  }

  return mapColaborador(row);
};

export const crearNuevoColaborador = async (
  input: CrearColaboradorInput,
  client?: PoolClient
): Promise<Colaborador> => withTransaction(client,async (transaction) => {
  const rut = canonicalRut(input.rut);
  await lockRut(transaction,rut);
  await validarRutDisponible(rut,undefined,transaction);
  await validarDepartamentoExiste(input.departamentoId);

  try {
    const row = await crearColaborador({ ...input,rut },transaction);
    return mapColaborador(row);
  } catch (error) {
    const conflict = collaboratorRutConflictFromError(error);
    if (conflict) throw conflict;
    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Departamento no encontrado.");
    }
    throw error;
  }
});

export const actualizarColaboradorExistente = async (
  id: number,
  input: ActualizarColaboradorInput,
  client?: PoolClient
): Promise<Colaborador> => withTransaction(client,async (transaction) => {
  const current = await obtenerColaboradorPorId(id,transaction);

  if (!current) {
    throw new NotFoundError("Colaborador no encontrado.");
  }

  let updateInput = input;
  if (input.rut !== undefined) {
    const rut = canonicalRut(input.rut);
    if (normalizeRut(rut) === normalizeRut(current.rut)) {
      updateInput = { ...input,rut:undefined };
    } else {
      await lockRut(transaction,rut);
      await validarRutDisponible(rut,current.id,transaction);
      updateInput = { ...input,rut };
    }
  }

  await validarDepartamentoExiste(input.departamentoId);

  try {
    const row = await actualizarColaborador(id,updateInput,transaction);

    if (!row) {
      throw new NotFoundError("Colaborador no encontrado.");
    }

    return mapColaborador(row);
  } catch (error) {
    const conflict = collaboratorRutConflictFromError(error);
    if (conflict) throw conflict;
    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Departamento no encontrado.");
    }
    throw error;
  }
});

export const obtenerInventarioColaborador = async (id:number) => {
  const colaborador=await obtenerColaborador(id);
  const [actuales,historial,pendientes]=await Promise.all([
    listarActivosActualesColaborador(id),listarHistorialActivosColaborador(id),
    listarEvidenciasPendientesColaborador(id)
  ]);
  const map=(row:import("./colaboradores.types").ActivoColaboradorRow)=>({
    id:row.dispositivo_id,codigoInventario:row.codigo_inventario,tipo:row.tipo_dispositivo,
    marca:row.marca,modelo:row.modelo,numeroSerie:row.numero_serie,imei:row.imei,
    valorComercial:Number(row.valor_comercial),estado:{codigo:row.estado_codigo,nombre:row.estado_nombre}
  });
  return {
    colaborador,
    valorTotalCustodia:actuales.reduce((sum,row)=>sum+Number(row.valor_comercial),0),
    equiposActuales:actuales.map(map),
    historialEquipos:historial.map(row=>({...map(row),
      fechaAsignacion:row.fecha_asignacion?toIsoDateTime(row.fecha_asignacion):null,
      fechaDevolucion:row.fecha_devolucion?toIsoDateTime(row.fecha_devolucion):null,
      tipoCierre:row.tipo_cierre,
      resultado:row.resultado
    })),
    registrosHistoricosPendientes:pendientes.map(row=>({
      id:row.id,
      tipoActivo:row.tipo_activo,
      descripcion:row.descripcion_original,
      imei:row.imei_original,
      numeroSerie:row.serie_original,
      fechaEntrega:row.fecha_entrega?toIsoDateTime(row.fecha_entrega):null,
      estadoConciliacion:row.estado_conciliacion,
      motivo:row.motivo_conflicto,
      nivelConfianza:row.nivel_confianza,
      fuente:{archivo:row.fuente,hoja:row.hoja,fila:row.fila_origen}
    }))
  };
};
export const obtenerPendientesOffboarding = async ():Promise<PendienteOffboarding[]> =>
  (await getOpenOffboardingProcesses()).map(process=>({
    colaborador:process.colaborador,
    activosPendientes:process.equiposPendientes,
    valorPendiente:process.valorPendiente,
    estado:"PENDIENTE"
  }));
