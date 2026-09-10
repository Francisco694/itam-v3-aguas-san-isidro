import { toIsoDateTime } from "../../shared/dates";
import { NotFoundError } from "../../shared/errors";
import { obtenerTipoDispositivoPorId } from "../tipos-dispositivo/tipos-dispositivo.repository";
import { listStockAlertRows, updateStockAlertRow } from "./stock-alerts.repository";
import type { StockAlertConfiguration, StockAlertRow, UpdateStockAlertInput } from "./stock-alerts.types";

export const stockAlertIsTriggered = (
  disponibles: number,
  minimoDisponible: number,
  alertaActiva: boolean
): boolean => alertaActiva && disponibles <= minimoDisponible;

export const stockAlertMessage = (
  tipoNombre: string,
  disponibles: number,
  minimoDisponible: number
): string => {
  const plural = /[aeiouáéíóú]$/i.test(tipoNombre)
    ? `${tipoNombre}s`
    : /r$/i.test(tipoNombre) ? `${tipoNombre}es` : `${tipoNombre}s`;
  return disponibles === 0
    ? `No quedan ${plural} disponibles`
    : `${disponibles === 1 ? `Queda 1 ${tipoNombre} disponible` : `Quedan ${disponibles} ${plural} disponibles`} · mínimo configurado: ${minimoDisponible}`;
};

const mapStockAlert = (row: StockAlertRow): StockAlertConfiguration => {
  const disponibles = Number(row.disponibles);
  const enAlerta = stockAlertIsTriggered(
    disponibles,
    row.minimo_disponible,
    row.alerta_activa
  );
  return {
    tipoDispositivo: { id: row.tipo_dispositivo_id, nombre: row.tipo_dispositivo_nombre },
    disponibles,
    minimoDisponible: row.minimo_disponible,
    alertaActiva: row.alerta_activa,
    enAlerta,
    mensaje: enAlerta ? stockAlertMessage(row.tipo_dispositivo_nombre, disponibles, row.minimo_disponible) : null,
    creadoPor: row.creado_por_usuario_id && row.creado_por_usuario_nombre
      ? { id: row.creado_por_usuario_id, nombre: row.creado_por_usuario_nombre }
      : null,
    actualizadoPor: row.actualizado_por_usuario_id && row.actualizado_por_usuario_nombre
      ? { id: row.actualizado_por_usuario_id, nombre: row.actualizado_por_usuario_nombre }
      : null,
    creadoEn: row.creado_en ? toIsoDateTime(row.creado_en) : null,
    actualizadoEn: row.actualizado_en ? toIsoDateTime(row.actualizado_en) : null
  };
};

export const listStockAlerts = async (): Promise<StockAlertConfiguration[]> =>
  (await listStockAlertRows()).map(mapStockAlert);

export const updateStockAlert = async (
  tipoDispositivoId: number,
  input: UpdateStockAlertInput
): Promise<StockAlertConfiguration> => {
  const type = await obtenerTipoDispositivoPorId(tipoDispositivoId);
  if (!type || !type.activo) {
    throw new NotFoundError("Tipo de dispositivo activo no encontrado.");
  }
  await updateStockAlertRow(tipoDispositivoId, input);
  const updated = (await listStockAlerts()).find(
    (item) => item.tipoDispositivo.id === String(tipoDispositivoId)
  );
  if (!updated) throw new NotFoundError("Configuración de alerta no encontrada.");
  return updated;
};
