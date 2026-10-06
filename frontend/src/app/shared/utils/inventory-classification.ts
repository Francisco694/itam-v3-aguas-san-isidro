import type { Dispositivo } from '../../core/models/itam.models';

export type InventoryView = 'REAL' | 'HISTORICO';
export type InventoryClassification = 'INVENTARIO' | 'HISTORICO';
export type InventoryClassificationInput = {
  origenRegistro: Dispositivo['origenRegistro'];
  verificacionFisica: Pick<NonNullable<Dispositivo['verificacionFisica']>, 'resultado'> | null;
};

export const classificationForView = (view: InventoryView): InventoryClassification =>
  view === 'REAL' ? 'INVENTARIO' : 'HISTORICO';

export const isInventoryValidated = (device: InventoryClassificationInput): boolean =>
  device.origenRegistro === 'MANUAL' ||
  (device.origenRegistro === 'IMPORTADO' && device.verificacionFisica?.resultado === 'VERIFICADO');

export const isHistoricalPending = (device: InventoryClassificationInput): boolean =>
  device.origenRegistro === 'IMPORTADO' && device.verificacionFisica?.resultado !== 'VERIFICADO';

export const belongsToInventoryView = (
  device: InventoryClassificationInput,
  view: InventoryView,
): boolean => view === 'REAL' ? isInventoryValidated(device) : isHistoricalPending(device);
