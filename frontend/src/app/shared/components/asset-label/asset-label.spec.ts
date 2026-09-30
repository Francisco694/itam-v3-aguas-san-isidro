import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { Dispositivo } from '../../../core/models/itam.models';
import { AssetLabel, PHYSICAL_LABEL_CALL_PHONE, PHYSICAL_LABEL_WHATSAPP, assetLabelPhone, assetLabelResponsible, compactResponsibleName } from './asset-label';

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

  it('muestra la etiqueta operativa sin identificadores técnicos ni teléfono del equipo', async () => {
    const fixture = TestBed.createComponent(AssetLabel);
    fixture.componentRef.setInput('code', 1001);
    fixture.componentRef.setInput('assetType', 'SMARTPHONE');
    fixture.componentRef.setInput('brandModel', 'Samsung Galaxy Tab S6 Lite');
    fixture.componentRef.setInput('detail', true);
    fixture.componentRef.setInput('responsible', 'Segundo Samuel T.');
    fixture.componentRef.setInput('phone', '56961220448');
    fixture.detectChanges();
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const canvas = element.querySelector('canvas');
    expect(element.textContent).toContain('1001');
    expect(element.textContent).toContain('SMARTPHONE');
    expect(element.textContent).toContain('Samsung Galaxy Tab S6 Lite');
    expect(element.textContent).toContain('Responsable: Segundo Samuel T.');
    expect(element.textContent).toContain('Llamar: ' + PHYSICAL_LABEL_CALL_PHONE);
    expect(element.textContent).toContain('WhatsApp: ' + PHYSICAL_LABEL_WHATSAPP);
    expect(element.textContent).not.toContain('IMEI');
    expect(element.textContent).not.toContain('SERIE');
    expect(element.textContent).not.toContain('56961220448');
    expect(canvas).not.toBeNull();
  });

  it('muestra la compañía en lugar del modelo para una SIM', () => {
    const fixture = TestBed.createComponent(AssetLabel);
    fixture.componentRef.setInput('code', 2005);
    fixture.componentRef.setInput('assetType', 'SIM');
    fixture.componentRef.setInput('brandModel', 'Modelo ignorado');
    fixture.componentRef.setInput('company', 'Entel');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Entel');
    expect(element.textContent).not.toContain('Modelo ignorado');
  });

  it('mantiene el nombre corto del responsable', () => {
    const smartphone = device({
      colaborador: { id: '1', rut: '1-9', nombre: 'Segundo Samuel Tapia', cargo: null, localidad: null, departamento: null },
      simAsociada: { id: '2', codigoInventario: 7001, iccidCodigoFabrica: null, numeroAsociado: '56961220448', compania: null, estado: null },
    });
    expect(compactResponsibleName(smartphone.colaborador!.nombre)).toBe('Segundo Samuel T.');
    expect(assetLabelResponsible(smartphone)).toBe('Segundo Samuel T.');
  });

  it('resuelve departamento, bodega y servicio técnico', () => {
    expect(assetLabelResponsible(device({ departamento: { id: '4', nombre: 'Operaciones' } }))).toBe('Operaciones');
    expect(assetLabelResponsible(device({}))).toBe('Bodega TI');
    expect(assetLabelResponsible(device({ estado: { id: '3', codigo: 'SERVICIO_TECNICO', nombre: 'Servicio técnico' } }))).toBe('Servicio Técnico');
  });

  it('conserva la utilidad de teléfono de la SIM sin usarla en la etiqueta', () => {
    expect(assetLabelPhone(device({ simAsociada: { id: '2', codigoInventario: 7001, iccidCodigoFabrica: null, numeroAsociado: '56961220448', compania: null, estado: null } }))).toBe('56961220448');
    expect(assetLabelPhone(device({ simAsociada: null }))).toBeNull();
  });
});
