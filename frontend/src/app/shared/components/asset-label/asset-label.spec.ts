import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { Dispositivo } from '../../../core/models/itam.models';
import { AssetLabel, assetLabelPhone, assetLabelResponsible, compactResponsibleName } from './asset-label';

describe('AssetLabel', () => {
  beforeEach(() => {
    vi.spyOn(AssetLabel.prototype as any, 'renderQr').mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const device = (overrides: Partial<Dispositivo>): Dispositivo => ({
    colaborador: null,
    departamento: null,
    estado: { id: '1', codigo: 'DISPONIBLE', nombre: 'Disponible' },
    simAsociada: null,
    ...overrides,
  } as Dispositivo);

  it('prepara un QR conservando el mismo código ITAM visible', async () => {
    const fixture = TestBed.createComponent(AssetLabel);
    fixture.componentRef.setInput('code', 1001);
    fixture.componentRef.setInput('assetType', 'SMARTPHONE');
    fixture.componentRef.setInput('detail', true);
    fixture.componentRef.setInput('responsible', 'Segundo Samuel T.');
    fixture.componentRef.setInput('phone', '56961220448');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const canvas = element.querySelector('canvas');
    expect(element.textContent).toContain('1001');
    expect(element.textContent).toContain('SMARTPHONE');
    expect(element.textContent).toContain('Resp: Segundo Samuel T.');
    expect(element.textContent).toContain('Fono: 56961220448');
    expect(canvas).not.toBeNull();
  });

  it('muestra responsable abreviado y teléfono desde la SIM asociada', () => {
    const smartphone = device({
      colaborador: { id: '1', rut: '1-9', nombre: 'Segundo Samuel Tapia', cargo: null, localidad: null, departamento: null },
      simAsociada: { id: '2', codigoInventario: 7001, iccidCodigoFabrica: null, numeroAsociado: '56961220448', compania: null, estado: null },
    });
    expect(compactResponsibleName(smartphone.colaborador!.nombre)).toBe('Segundo Samuel T.');
    expect(assetLabelResponsible(smartphone)).toBe('Segundo Samuel T.');
    expect(assetLabelPhone(smartphone)).toBe('56961220448');
  });

  it('formatea responsables usando primer nombre, primer apellido e inicial del segundo apellido', () => {
    expect(compactResponsibleName('Francisco Javier Ponce Barril')).toBe('Francisco Ponce B.');
    expect(compactResponsibleName('Elena Gabriela Yanez Gutierrez')).toBe('Elena Yanez G.');
    expect(compactResponsibleName('Jose Llempe Blanco')).toBe('Jose Llempe B.');
    expect(compactResponsibleName('Maria Soto')).toBe('Maria Soto');
  });

  it('resuelve departamento, bodega y ausencia de teléfono sin duplicarlo en el equipo', () => {
    expect(assetLabelResponsible(device({ departamento: { id: '4', nombre: 'Operaciones' } }))).toBe('Operaciones');
    expect(assetLabelResponsible(device({}))).toBe('Bodega TI');
    expect(assetLabelPhone(device({ simAsociada: { id: '2', codigoInventario: 7001, iccidCodigoFabrica: null, numeroAsociado: null, compania: null, estado: null } }))).toBeNull();
    expect(assetLabelPhone(device({ simAsociada: null }))).toBeNull();
  });

  it('mantiene el nombre compacto y distingue equipos sin custodia fuera de bodega', () => {
    expect(assetLabelResponsible(device({
      estado: { id: '2', codigo: 'ASIGNADO', nombre: 'Asignado' },
      colaborador: { id: '5', rut: '2-7', nombre: 'Ana Tapia', cargo: null, localidad: null, departamento: null },
    }))).toBe('Ana Tapia');
    expect(assetLabelResponsible(device({ estado: { id: '3', codigo: 'SERVICIO_TECNICO', nombre: 'Servicio técnico' } }))).toBe('Sin responsable actual');
  });
});
