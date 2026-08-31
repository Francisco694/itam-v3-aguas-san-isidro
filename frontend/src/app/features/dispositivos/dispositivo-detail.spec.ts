import type { Dispositivo, HistorialEvento } from '../../core/models/itam.models';
import {
  historicalDeliveryDate,
  historicalDeliveryDateLabel,
  isSmartphoneDevice,
  lastKnownPersonalResponsible,
} from './dispositivo-detail';

const historyEvent = (
  overrides: Partial<HistorialEvento> = {},
): HistorialEvento => ({
  id: '1',
  tipoEntidad: 'DISPOSITIVO',
  dispositivoId: '10',
  tipoEvento: 'ASIGNAR_COLABORADOR',
  estadoAnterior: null,
  estadoNuevo: null,
  responsable: 'Responsable TI',
  observaciones: null,
  detalle: {},
  fechaEvento: '2026-08-20T12:00:00.000Z',
  ...overrides,
});

describe('ficha de dispositivo QA-01/03/11', () => {
  it('identifica Smartphone por el tipo real, sin depender de la serie', () => {
    expect(isSmartphoneDevice({ tipo: { nombre: 'Smartphone' } } as Dispositivo)).toBe(true);
    expect(isSmartphoneDevice({ tipo: { nombre: 'Notebook' } } as Dispositivo)).toBe(false);
  });

  it('usa exclusivamente la fecha histórica declarada en el historial', () => {
    expect(historicalDeliveryDate([
      historyEvent({ detalle: { historicalDeliveryDate: '2021-03-12' } }),
    ])).toBe('2021-03-12');
    expect(historicalDeliveryDate([historyEvent()])).toBeNull();
    expect(historicalDeliveryDateLabel([
      historyEvent({ detalle: { historicalDeliveryDate: '2021-03-12' } }),
    ])).toBe('12/03/2021');
    expect(historicalDeliveryDateLabel([historyEvent()])).toBe('Sin fecha hist\u00f3rica registrada');
  });

  it('recupera el último colaborador de una asignación personal válida', () => {
    const result = lastKnownPersonalResponsible([
      historyEvent({
        id: 'older',
        fechaEvento: '2024-01-01T10:00:00.000Z',
        colaboradorHistorico: { id: '3', nombre: 'Anterior', rut: '11.111.111-1' },
      }),
      historyEvent({
        id: 'newer',
        fechaEvento: '2025-02-02T10:00:00.000Z',
        colaboradorHistorico: { id: '8', nombre: 'Responsable reciente', rut: '22.222.222-2' },
      }),
    ]);

    expect(result).toEqual({
      id: '8',
      nombre: 'Responsable reciente',
      rut: '22.222.222-2',
      fechaAsignacion: '2025-02-02T10:00:00.000Z',
    });
  });

  it('no confunde al ejecutor TI ni una custodia departamental con responsable personal', () => {
    expect(lastKnownPersonalResponsible([
      historyEvent({ tipoEvento: 'CAMBIAR_ESTADO', responsable: 'Ejecutor TI' }),
      historyEvent({
        tipoEvento: 'ASIGNAR_DEPARTAMENTO',
        detalle: { custodiaNueva: { tipo: 'DEPARTAMENTO', id: '4', nombre: 'TI' } },
      }),
    ])).toBeNull();
  });
});
