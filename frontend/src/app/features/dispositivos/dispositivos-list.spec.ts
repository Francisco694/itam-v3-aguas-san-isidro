import type { Dispositivo } from '../../core/models/itam.models';
import { findUniversalDevice } from './dispositivos-list';

const device = (
  codigoInventario: number,
  origenRegistro: Dispositivo['origenRegistro'],
  resultado: 'PENDIENTE' | 'VERIFICADO' | 'REVISAR' | undefined,
  identifiers: Partial<Pick<Dispositivo, 'imei' | 'numeroSerie'>> = {},
): Dispositivo => ({
  id: String(codigoInventario),
  codigoInventario,
  tipo: { id: 1, nombre: 'Smartphone', permiteSim: true },
  marca: 'Samsung',
  modelo: 'Galaxy A13',
  numeroSerie: null,
  imei: null,
  estado: { id: 1, codigo: 'ASIGNADO', nombre: 'Asignado', categoria: 'OPERATIVO' },
  origenRegistro,
  verificacionFisica: resultado ? { resultado, fechaVerificacion: null, observacion: null } : null,
  ...identifiers,
} as unknown as Dispositivo);

describe('buscador universal de dispositivos', () => {
  const historico = device(1266, 'IMPORTADO', 'PENDIENTE', { imei: '351084952019726' });
  const inventario = device(1001, 'IMPORTADO', 'VERIFICADO', { numeroSerie: 'SERIE-1001' });

  it('encuentra un activo por IMEI sin depender de la pestaña activa', () => {
    const result = findUniversalDevice([inventario, historico], '351084952019726');

    expect(result?.dispositivo.codigoInventario).toBe(1266);
    expect(result?.clasificacion).toBe('HISTORICO');
  });

  it('prioriza el código ITAM exacto y clasifica Inventario', () => {
    const result = findUniversalDevice([historico, inventario], 'ITAM 1001');

    expect(result?.dispositivo.codigoInventario).toBe(1001);
    expect(result?.clasificacion).toBe('INVENTARIO');
  });

  it('encuentra por número de serie exacto', () => {
    const result = findUniversalDevice([historico, inventario], 'SERIE-1001');

    expect(result?.dispositivo.codigoInventario).toBe(1001);
  });

  it('devuelve null únicamente cuando no hay coincidencia en ambas vistas', () => {
    expect(findUniversalDevice([historico, inventario], 'NO-EXISTE')).toBeNull();
  });
});
