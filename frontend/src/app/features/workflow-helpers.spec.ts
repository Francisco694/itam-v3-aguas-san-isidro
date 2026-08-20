import { Colaborador, Dispositivo } from '../core/models/itam.models';
import { actaCommercialTotal } from '../shared/components/acta-preview/acta-preview';
import { formatClp } from '../shared/utils/currency';
import { custodyValue } from './colaboradores/colaborador-detail';
import { COMMERCIAL_VALUE_PATTERN } from './dispositivos/dispositivo-form';
import { receiversForDepartment } from './dispositivos/dispositivo-detail';
import { inventoryStateCount, quickSearchMode } from './dispositivos/dispositivos-list';
import { repairImpactPercentage, technicalStage } from './servicio-tecnico/servicio-tecnico';

describe('flujos operacionales del inventario', () => {
  it('interpreta Enter sobre un cÃ³digo numÃ©rico como apertura de ficha', () => {
    expect(quickSearchMode(' 3001 ')).toBe('DEVICE_CODE');
    expect(quickSearchMode('Dell Latitude')).toBe('FILTER');
    expect(quickSearchMode('   ')).toBe('EMPTY');
  });

  it('calcula contadores reales para los filtros rÃ¡pidos', () => {
    const devices = [
      { estado: { codigo: 'DISPONIBLE' } },
      { estado: { codigo: 'ASIGNADO' } },
      { estado: { codigo: 'ASIGNADO' } },
    ] as Pick<Dispositivo, 'estado'>[];
    expect(inventoryStateCount(devices, '')).toBe(3);
    expect(inventoryStateCount(devices, 'ASIGNADO')).toBe(2);
  });

  it('acepta valor comercial CLP entero y rechaza formato monetario', () => {
    expect(COMMERCIAL_VALUE_PATTERN.test('149990')).toBe(true);
    expect(COMMERCIAL_VALUE_PATTERN.test('$149.990')).toBe(false);
    expect(formatClp(149990)).toContain('149.990');
  });

  it('calcula el valor de custodia desde los equipos actuales', () => {
    expect(custodyValue([{ valorComercial: 149990 }, { valorComercial: 850000 }])).toBe(999990);
  });

  it('separa la custodia actual de un historial ya devuelto', () => {
    const current = [{ valorComercial: 500000 }];
    const returnedHistory = [{ fechaDevolucion: '2026-06-10', resultado: 'DEVUELTO' }];
    expect(custodyValue(current)).toBe(500000);
    expect(returnedHistory[0]?.resultado).toBe('DEVUELTO');
  });

  it('ofrece como recepcionante solo colaboradores del departamento', () => {
    const people = [
      { id: '1', departamento: { id: '10' } },
      { id: '2', departamento: { id: '20' } },
    ] as Colaborador[];
    expect(receiversForDepartment(people, '10').map((person) => person.id)).toEqual(['1']);
    expect(receiversForDepartment(people, '')).toEqual([]);
  });

  it('habilita la acciÃ³n tÃ©cnica correspondiente a cada etapa', () => {
    expect(technicalStage('PENDIENTE_DIAGNOSTICO')).toBe('QUOTE');
    expect(technicalStage('COTIZACION_RECIBIDA')).toBe('DECISION');
    expect(technicalStage('REPARACION_APROBADA')).toBe('CLOSE');
    expect(technicalStage('CERRADA')).toBe('READ_ONLY');
  });

  it('calcula el impacto económico proyectado sin decidir automáticamente', () => {
    expect(repairImpactPercentage(1_000_000, 200_000, 300_000)).toBe(50);
    expect(repairImpactPercentage(0, 200_000, 300_000)).toBe(0);
  });

  it('suma el valor comercial de todos los equipos de un acta', () => {
    expect(actaCommercialTotal([{ valorComercial: 200000 }, { valorComercial: 350000 }])).toBe(
      550000,
    );
  });
});
