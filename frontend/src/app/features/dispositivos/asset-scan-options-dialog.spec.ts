import { TestBed } from '@angular/core/testing';

import { Dispositivo } from '../../core/models/itam.models';
import { AssetScanOptionsDialog } from './asset-scan-options-dialog';

const dispositivo = {
  codigoInventario: 1009,
  tipoDispositivo: 'Celular',
  marca: 'Motorola',
  modelo: 'Moto G30',
  numeroSerie: 'ZY22XK7P9M',
  imei: '356789012345678',
  localidad: 'Temuco',
  ubicacionDetalle: 'Operaciones',
  numeroTelefonico: '+56912345678',
  estado: { codigo: 'ASIGNADO', nombre: 'Asignado' },
  colaborador: { nombre: 'María González', rut: '123456789' },
  departamento: null,
} as unknown as Dispositivo;

describe('AssetScanOptionsDialog', () => {
  function crear() {
    const fixture = TestBed.createComponent(AssetScanOptionsDialog);
    fixture.componentRef.setInput('dispositivo', dispositivo);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra nombre, código ITAM y estado', () => {
    const el: HTMLElement = crear().nativeElement;
    expect(el.textContent).toContain('Motorola Moto G30');
    expect(el.textContent).toContain('ITAM-1009');
    expect(el.textContent).toContain('Asignado');
  });

  it('emite el código numérico al elegir cada opción', () => {
    const fixture = crear();
    const ficha = vi.fn();
    const catalogo = vi.fn();
    fixture.componentInstance.verFicha.subscribe(ficha);
    fixture.componentInstance.verCatalogo.subscribe(catalogo);

    const botones = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.cta');
    botones[0].click();
    botones[1].click();

    expect(ficha).toHaveBeenCalledWith(1009);
    expect(catalogo).toHaveBeenCalledWith(1009);
  });

  it('emite cerrar con Escape', () => {
    const fixture = crear();
    const cerrar = vi.fn();
    fixture.componentInstance.cerrar.subscribe(cerrar);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cerrar).toHaveBeenCalled();
  });
});
