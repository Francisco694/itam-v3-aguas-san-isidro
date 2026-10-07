import { Sim } from '../../core/models/itam.models';
import { buildAtomicLineSimIntent, canSelectExistingSim, canStartLineSimOperation, findPhoneMatch, formatPhoneSearch, iccidLabel, isValidIccidSearch, normalizeChileanPhone, normalizeIccidSearch, requiresAtomicBackendOperation, simSearchMatches } from './sim-line-management';

describe('gestion frontend de SIM y linea', () => {
  const current = { codigoInventario: 2002, estado: { codigo: 'ASIGNADA' } } as Sim;

  it('mantiene numero y SIM sin requerir operacion de modificacion', () => {
    expect(requiresAtomicBackendOperation(false, false)).toBe(false);
    expect(buildAtomicLineSimIntent('KEEP', 'KEEP', null, '')).toEqual({
      mantenerNumero: true, mantenerSim: true, numeroNuevo: null, simDestinoCodigo: null
    });
  });

  it('valida cambio de numero conservando la SIM', () => {
    expect(normalizeChileanPhone('+56 9 9746 4529')).toBe('56997464529');
    expect(normalizeChileanPhone('123')).toBeNull();
    expect(buildAtomicLineSimIntent('CHANGE', 'KEEP', '56911112222', '')).toEqual({
      mantenerNumero: false, mantenerSim: true, numeroNuevo: '56911112222', simDestinoCodigo: null
    });
  });

  it('permite seleccionar solo una SIM disponible y no instalada', () => {
    expect(canSelectExistingSim({ codigoInventario: 2055, estado: { codigo: 'DISPONIBLE' }, dispositivo: null } as any, current.codigoInventario)).toBe(true);
    expect(canSelectExistingSim({ codigoInventario: 2056, estado: { codigo: 'DADA_BAJA' }, dispositivo: null } as any, current.codigoInventario)).toBe(false);
    expect(canSelectExistingSim({ codigoInventario: 2057, estado: { codigo: 'DISPONIBLE' }, dispositivo: { id: '1' } } as any, current.codigoInventario)).toBe(false);
    expect(canSelectExistingSim({ codigoInventario: 2058, estado: { codigo: 'DISPONIBLE' }, dispositivo: null, colaborador: { id: '1' } } as any, current.codigoInventario)).toBe(false);
  });

  it('construye cambiar solo SIM conservando el numero', () => {
    expect(buildAtomicLineSimIntent('KEEP', 'EXISTING', null, '2055')).toEqual({
      mantenerNumero: true, mantenerSim: false, numeroNuevo: null, simDestinoCodigo: 2055
    });
  });

  it('construye SIM y numero como una unica intencion atomica', () => {
    expect(requiresAtomicBackendOperation(true, true)).toBe(true);
    expect(buildAtomicLineSimIntent('CHANGE', 'EXISTING', '56911112222', '2055')).toEqual({
      mantenerNumero: false, mantenerSim: false, numeroNuevo: '56911112222', simDestinoCodigo: 2055
    });
  });

  it('presenta SIM legacy sin ICCID como pendiente de validacion', () => {
    expect(iccidLabel({ iccidCodigoFabrica: null })).toBe('Pendiente de validación');
  });

  it('bloquea un segundo submit mientras la operacion esta procesando', () => {
    expect(canStartLineSimOperation(false)).toBe(true);
    expect(canStartLineSimOperation(true)).toBe(false);
  });

  it('normaliza y formatea el numero mientras se escribe', () => {
    expect(formatPhoneSearch('56997464529')).toBe('+56 9 9746 4529');
    expect(normalizeChileanPhone('+56 9 9746 4529')).toBe('56997464529');
  });

  it('valida ICCID y elimina separadores solo para la busqueda', () => {
    expect(normalizeIccidSearch('8956 0322-6276 3686246')).toBe('8956032262763686246');
    expect(isValidIccidSearch('8956 0322-6276 3686246')).toBe(true);
    expect(isValidIccidSearch('895603')).toBe(false);
  });

  it('busca SIM por codigo o ICCID y limita los resultados visibles', () => {
    const sims = Array.from({ length: 10 }, (_, index) => ({
      codigoInventario: 2200 + index,
      iccidCodigoFabrica: `8956032262763686${String(index).padStart(3, '0')}`
    })) as Sim[];
    expect(simSearchMatches(sims, 'ITAM 2203').map(sim => sim.codigoInventario)).toEqual([2203]);
    expect(simSearchMatches(sims, '8956032262763686').length).toBe(8);
  });

  it('detecta el numero oficial sin consultar el campo legacy', () => {
    const sims = [{
      ...current,
      id: 'linea-1',
      lineaMovil: { id: 'linea-1', numeroTelefonico: '56997464529', estado: 'ACTIVA' }
    }, {
      ...current,
      id: 'legacy-only',
      numeroAsociado: '56997464529',
      lineaMovil: null
    }] as Sim[];
    expect(findPhoneMatch(sims, '+56 9 9746 4529')?.id).toBe('linea-1');
  });
});
