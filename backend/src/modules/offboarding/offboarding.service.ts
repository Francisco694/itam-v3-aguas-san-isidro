import type { PoolClient } from "pg";
import { pool } from "../../config/database";
import { toIsoDateTime } from "../../shared/dates";
import {
  ConflictError,
  NotFoundError,
  isForeignKeyViolation,
  isUniqueViolation
} from "../../shared/errors";
import {
  completeProcess,
  getOpenProcessByCollaborator,
  getProcessById,
  insertProcess,
  listOpenProcesses,
  listPendingAssets,
  lockCollaborator,
  searchCollaborators
} from "./offboarding.repository";
import type {
  CloseOffboardingInput,
  OffboardingAsset,
  OffboardingAssetRow,
  OffboardingCollaborator,
  OffboardingProcessDetail,
  OffboardingProcessRow,
  OffboardingProcessSummary,
  OffboardingSearchResult,
  StartOffboardingInput
} from "./offboarding.types";

const mapCollaborator = (
  row: Pick<
    OffboardingProcessRow,
    | "colaborador_id"
    | "rut"
    | "nombre"
    | "cargo"
    | "departamento_id"
    | "departamento_nombre"
    | "localidad"
    | "colaborador_activo"
    | "colaborador_observaciones"
    | "colaborador_creado_en"
    | "colaborador_actualizado_en"
  >
): OffboardingCollaborator => ({
  id: row.colaborador_id,
  rut: row.rut,
  nombre: row.nombre,
  cargo: row.cargo,
  departamento:
    row.departamento_id && row.departamento_nombre
      ? { id: row.departamento_id, nombre: row.departamento_nombre }
      : null,
  localidad: row.localidad,
  activo: row.colaborador_activo,
  observaciones: row.colaborador_observaciones,
  creadoEn: toIsoDateTime(row.colaborador_creado_en),
  actualizadoEn: toIsoDateTime(row.colaborador_actualizado_en)
});

const mapProcess = (row: OffboardingProcessRow): OffboardingProcessSummary => {
  const valorPendiente = Number(row.valor_pendiente) || 0;
  const valorRecuperado = Number(row.valor_recuperado) || 0;
  return {
    id: row.id,
    colaborador: mapCollaborator(row),
    fechaInicio: toIsoDateTime(row.fecha_inicio),
    estado: row.estado,
    usuarioInicio: {
      id: row.usuario_inicio_id,
      nombre: row.usuario_inicio_nombre,
      email: row.usuario_inicio_email
    },
    observaciones: row.observaciones,
    fechaCierre: row.fecha_cierre ? toIsoDateTime(row.fecha_cierre) : null,
    usuarioCierre:
      row.usuario_cierre_id &&
      row.usuario_cierre_nombre &&
      row.usuario_cierre_email
        ? {
            id: row.usuario_cierre_id,
            nombre: row.usuario_cierre_nombre,
            email: row.usuario_cierre_email
          }
        : null,
    creadoEn: toIsoDateTime(row.creado_en),
    actualizadoEn: toIsoDateTime(row.actualizado_en),
    equiposPendientes: Number(row.equipos_pendientes) || 0,
    valorPendiente,
    valorRecuperado,
    valorTotal: valorPendiente + valorRecuperado
  };
};

const mapAsset = (row: OffboardingAssetRow): OffboardingAsset => ({
  id: row.id,
  codigoInventario: row.codigo_inventario,
  tipo: { id: row.tipo_id, nombre: row.tipo_nombre },
  marca: row.marca,
  modelo: row.modelo,
  numeroSerie: row.numero_serie,
  imei: row.imei,
  valorComercial: Number(row.valor_comercial) || 0,
  estado: {
    id: row.estado_id,
    codigo: row.estado_codigo,
    nombre: row.estado_nombre
  }
});

const getDetail = async (
  id: number,
  client?: PoolClient
): Promise<OffboardingProcessDetail> => {
  const process = await getProcessById(id, client);
  if (!process) throw new NotFoundError("Proceso de salida no encontrado.");
  const assets = await listPendingAssets(id, client);
  return { ...mapProcess(process), activosPendientes: assets.map(mapAsset) };
};

export const getOpenOffboardingProcesses = async (): Promise<
  OffboardingProcessSummary[]
> => (await listOpenProcesses()).map(mapProcess);

export const getOffboardingProcess = async (
  id: number
): Promise<OffboardingProcessDetail> => getDetail(id);

export const findCollaboratorsForOffboarding = async (
  query: string
): Promise<OffboardingSearchResult[]> =>
  (await searchCollaborators(query)).map((row) => ({
    colaborador: mapCollaborator(row),
    equiposAsignados: Number(row.equipos_asignados) || 0,
    valorAsignado: Number(row.valor_asignado) || 0,
    procesoAbiertoId: row.proceso_abierto_id
  }));

export const startOffboardingProcess = async (
  input: StartOffboardingInput,
  providedClient?: PoolClient
): Promise<OffboardingProcessDetail> => {
  const client = providedClient ?? (await pool.connect());
  const ownsTransaction = !providedClient;
  try {
    if (ownsTransaction) await client.query("BEGIN");
    if (!(await lockCollaborator(input.colaboradorId, client))) {
      throw new NotFoundError("Colaborador no encontrado.");
    }
    if (await getOpenProcessByCollaborator(input.colaboradorId, client)) {
      throw new ConflictError(
        "La persona ya tiene un proceso de salida en curso."
      );
    }
    const id = await insertProcess(
      input.colaboradorId,
      input.usuarioId,
      input.observaciones,
      client
    );
    const detail = await getDetail(id, client);
    if (ownsTransaction) await client.query("COMMIT");
    return detail;
  } catch (error) {
    if (ownsTransaction) await client.query("ROLLBACK");
    if (isUniqueViolation(error)) {
      throw new ConflictError(
        "La persona ya tiene un proceso de salida en curso."
      );
    }
    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Colaborador o usuario no encontrado.");
    }
    throw error;
  } finally {
    if (ownsTransaction) client.release();
  }
};

export const closeOffboardingProcess = async (
  input: CloseOffboardingInput,
  providedClient?: PoolClient
): Promise<OffboardingProcessDetail> => {
  const client = providedClient ?? (await pool.connect());
  const ownsTransaction = !providedClient;
  try {
    if (ownsTransaction) await client.query("BEGIN");
    const current = await getProcessById(input.procesoId, client, true);
    if (!current) throw new NotFoundError("Proceso de salida no encontrado.");
    if (current.estado !== "ABIERTO") {
      throw new ConflictError("El proceso de salida ya está completado.");
    }
    if (Number(current.equipos_pendientes) > 0) {
      throw new ConflictError(
        "No puede completar el proceso mientras existan equipos por recuperar."
      );
    }
    await completeProcess(input.procesoId, input.usuarioId, client);
    const detail = await getDetail(input.procesoId, client);
    if (ownsTransaction) await client.query("COMMIT");
    return detail;
  } catch (error) {
    if (ownsTransaction) await client.query("ROLLBACK");
    if (isForeignKeyViolation(error)) {
      throw new NotFoundError("Usuario no encontrado.");
    }
    throw error;
  } finally {
    if (ownsTransaction) client.release();
  }
};
