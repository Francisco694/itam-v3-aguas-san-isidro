import type { Dispositivo, TipoDispositivo } from '../models/itam.models';

export const isRouterType = (type: Pick<TipoDispositivo, 'nombre'> | null | undefined): boolean =>
  type?.nombre.trim().toLocaleLowerCase('es') === 'router';

export const routerUsesMobileNetwork = (
  attributes: Record<string, string | number | boolean | null> | null | undefined,
): boolean => attributes?.['utilizaRedMovil'] === true;

export const isCellularRouterDevice = (
  device: Pick<Dispositivo, 'tipo' | 'atributosEspecificos' | 'imei'> &
    Partial<Pick<Dispositivo, 'simAsociada' | 'lineaMovil'>>,
): boolean => isRouterType(device.tipo) && (
  routerUsesMobileNetwork(device.atributosEspecificos)
  || !!device.imei?.trim()
  || !!device.simAsociada
  || !!device.lineaMovil
);
