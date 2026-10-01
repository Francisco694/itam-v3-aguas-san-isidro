import '@angular/compiler';
import type { Dispositivo, HistorialEvento, Sim } from '../../core/models/itam.models';
import { ApiError } from '../../core/models/api.models';
import { assetLabelPhone } from '../../shared/components/asset-label/asset-label';
import {
  deviceActionErrorMessage,
  deviceTechnicalIdentifier,
  canDeviceCarrySim,
  isChileanPhoneInputValid,
  isSimAvailableForJointDelivery,
  isSmartphoneDevice,
  lastKnownPersonalResponsible,
  normalizeChileanPhoneInput,
  smartphoneLineActionCopy,
  smartphonePhonePending,
  smartphonePhoneText,
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
  it('prioriza IMEI válido sobre el número de serie', () => {
    expect(deviceTechnicalIdentifier({ imei: '123456789012345', numeroSerie: 'ABC123' }))
      .toEqual({ label: 'IMEI', value: '123456789012345' });
  });

  it('usa el número de serie cuando el IMEI no está informado o es guion', () => {
    expect(deviceTechnicalIdentifier({ imei: null, numeroSerie: 'R52ABC123' }))
      .toEqual({ label: 'NÚMERO DE SERIE', value: 'R52ABC123' });
    expect(deviceTechnicalIdentifier({ imei: '-', numeroSerie: 'R52ABC123' }))
      .toEqual({ label: 'NÚMERO DE SERIE', value: 'R52ABC123' });
    expect(deviceTechnicalIdentifier({ imei: '   ', numeroSerie: 'R52ABC123' }))
      .toEqual({ label: 'NÚMERO DE SERIE', value: 'R52ABC123' });
    expect(deviceTechnicalIdentifier({ imei: undefined, numeroSerie: 'R52ABC123' }))
      .toEqual({ label: 'NÚMERO DE SERIE', value: 'R52ABC123' });
  });

  it('muestra un identificador neutro cuando IMEI y serie no son válidos', () => {
    expect(deviceTechnicalIdentifier({ imei: '', numeroSerie: '' }))
      .toEqual({ label: 'IDENTIFICADOR', value: 'Sin identificador registrado' });
  });

  it('identifica Smartphone por el tipo real, sin depender de la serie', () => {
    expect(isSmartphoneDevice({ tipo: { nombre: 'Smartphone' } } as Dispositivo)).toBe(true);
    expect(isSmartphoneDevice({ tipo: { nombre: 'Notebook' } } as Dispositivo)).toBe(false);
  });

  it('permite SIM en tipos configurados aunque no sean Smartphones', () => {
    expect(canDeviceCarrySim({ tipo: { nombre: 'Tablet', permiteSim: true } } as Dispositivo)).toBe(true);
    expect(canDeviceCarrySim({ tipo: { nombre: 'Notebook' } } as Dispositivo)).toBe(false);
  });

  it('distingue un Smartphone sin SIM de una SIM pendiente de número', () => {
    const withoutSim = {
      tipo: { nombre: 'Smartphone' },
      simAsociada: null,
    } as Dispositivo;
    const simWithoutPhone = {
      tipo: { nombre: 'Smartphone' },
      simAsociada: { numeroAsociado: null },
    } as Dispositivo;

    expect(smartphonePhoneText(withoutSim)).toBe('Sin número telefónico asociado');
    expect(smartphonePhonePending(withoutSim)).toBe(false);
    expect(smartphonePhoneText(simWithoutPhone)).toBe('Número telefónico pendiente de registrar');
    expect(smartphonePhonePending(simWithoutPhone)).toBe(true);
  });

  it('usa el texto de gestión según exista línea móvil o SIM', () => {
    const empty = { numeroTelefonico: null, simAsociada: null } as Dispositivo;
    const onlyLine = { numeroTelefonico: '56961220448', simAsociada: null } as Dispositivo;
    const withSim = { numeroTelefonico: '56961220448', simAsociada: { numeroAsociado: '56961220448' } } as Dispositivo;

    expect(smartphoneLineActionCopy(empty)).toEqual({
      title: 'Agregar línea / SIM',
      description: 'Registrar número o asociar SIM',
    });
    expect(smartphoneLineActionCopy(onlyLine)).toEqual({
      title: 'Gestionar línea / SIM',
      description: 'Editar número o asociar SIM',
    });
    expect(smartphoneLineActionCopy(withSim)).toEqual({
      title: 'Gestionar línea / SIM',
      description: 'Editar línea o reemplazar SIM',
    });
  });

  it('no trata el número activo como advertencia cuando falta asociar la SIM', () => {
    const device = {
      numeroTelefonico: '56961220448',
      simAsociada: null,
    } as Dispositivo;

    expect(smartphonePhoneText(device)).toBe('56961220448');
    expect(smartphonePhonePending(device)).toBe(false);
    expect(assetLabelPhone(device)).toBe('56961220448');
  });

  it('muestra y etiqueta una línea directa aunque el Smartphone no tenga SIM', () => {
    const device = {
      numeroTelefonico: '56911111111',
      lineaMovil: { id: '15', numeroTelefonico: '56987654321', estado: 'ACTIVA' },
      simAsociada: null,
    } as Dispositivo;

    expect(smartphonePhoneText(device)).toBe('56987654321');
    expect(assetLabelPhone(device)).toBe('56987654321');
    expect(smartphoneLineActionCopy(device).description).toBe('Editar número o asociar SIM');
  });

  it('usa la misma prioridad de número en ficha y etiqueta', () => {
    const device = {
      numeroTelefonico: '56911111111',
      lineaMovil: { id: '15', numeroTelefonico: '56922222222', estado: 'ACTIVA' },
      simAsociada: {
        numeroAsociado: '56933333333',
        lineaMovil: { id: '16', numeroTelefonico: '56944444444', estado: 'ACTIVA' },
      },
    } as Dispositivo;

    expect(smartphonePhoneText(device)).toBe('56922222222');
    expect(assetLabelPhone(device)).toBe('56922222222');
  });

  it('muestra el número que pertenece a la SIM asociada', () => {
    const device = {
      tipo: { nombre: 'Smartphone' },
      simAsociada: { numeroAsociado: '56961220448' },
    } as Dispositivo;

    expect(smartphonePhoneText(device)).toBe('56961220448');
    expect(smartphonePhonePending(device)).toBe(false);
    expect(assetLabelPhone(device)).toBe('56961220448');
  });

  it('valida el formato telefónico aceptado por el formulario de asociación', () => {
    expect(isChileanPhoneInputValid('961220448')).toBe(true);
    expect(isChileanPhoneInputValid('+56 9 6122 0448')).toBe(true);
    expect(isChileanPhoneInputValid('61220448')).toBe(false);
    expect(normalizeChileanPhoneInput('961220448')).toBe('56961220448');
  });

  it('permite elegir en la entrega una SIM disponible aunque el número se ingrese en el formulario', () => {
    const sim = {
      estado: { codigo: 'DISPONIBLE' },
      dispositivo: null,
      colaborador: null,
      numeroAsociado: null,
    } as Sim;

    expect(isSimAvailableForJointDelivery(sim)).toBe(true);
  });

  it('muestra el conflicto del cambio de estado en pantalla', () => {
    expect(deviceActionErrorMessage(new ApiError(
      'CONFLICT',
      'El dispositivo tiene una orden de servicio técnico abierta.',
      409,
    ))).toBe('El dispositivo tiene una orden de servicio técnico abierta.');
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
