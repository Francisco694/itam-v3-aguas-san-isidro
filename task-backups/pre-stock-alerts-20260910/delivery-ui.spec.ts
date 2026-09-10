import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { DispositivoDetail } from './dispositivo-detail';
import { AuthService } from '../../core/services/auth.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { SimService } from '../../core/services/sim.service';
import { AssetLabel } from '../../shared/components/asset-label/asset-label';

describe('Registrar entrega: formulario', () => {
  let fixture: any;
  let component: any;
  let api: any;
  const person = { id: '7', nombre: 'Marta Pérez', rut: '12.345.678-5', activo: true, cargo: 'Analista', departamento: null };
  const sim = { id: '8', codigoInventario: 555, numeroAsociado: '912345678', compania: 'Operador', estado: { codigo: 'DISPONIBLE' }, dispositivo: null, colaborador: null };
  beforeEach(async () => {
    vi.spyOn(AssetLabel.prototype as any, 'renderQr').mockResolvedValue(undefined);
    api = { asignarColaborador: vi.fn(() => NEVER) };
    await TestBed.configureTestingModule({ imports: [DispositivoDetail], providers: [provideHttpClient(), provideRouter([]),
      { provide: AuthService, useValue: { user: () => ({ nombre: 'Responsable TI' }) } },
      { provide: DispositivosService, useValue: api },
      { provide: SimService, useValue: { listar: () => of([sim, { ...sim, id: '9', codigoInventario: 556, colaborador: person }]) } }
    ] }).compileComponents();
    fixture = TestBed.createComponent(DispositivoDetail);
    component = fixture.componentInstance;
    component.load = () => {};
    component.item.set({ id: '1', codigoInventario: 1445, tipo: { nombre: 'Smartphone', configuracionFormulario: { camposEspecificos: [] } }, estado: { codigo: 'DISPONIBLE', nombre: 'Disponible' }, tipoCustodia: 'NONE', simAsociada: null, atributosEspecificos: {}, creadoEn: '2026-01-01', valorComercial: 0 });
    component.collaborators.set([person]);
    component.loading.set(false);
    component.open('assign-person');
    fixture.detectChanges();
  });
  function type(selector: string, value: string) {
    const input = fixture.nativeElement.querySelector(selector);
    input.value = value; input.dispatchEvent(new Event('input')); fixture.detectChanges();
  }
  it('filtra letra por letra, por apellido y RUT; editar invalida la selección', () => {
    expect(fixture.nativeElement.querySelector('select#colaborador')).toBeNull();
    for (const query of ['M', 'Mar', 'Marta', 'Perez', '12.345']) {
      type('#colaborador', query);
      expect(fixture.nativeElement.querySelector('.delivery-suggestions').textContent).toContain('Marta Pérez');
    }
    fixture.nativeElement.querySelector('.delivery-suggestions button').click(); fixture.detectChanges();
    expect(component.actionForm.controls.colaboradorId.value).toBe('7');
    type('#colaborador', 'XYZ');
    expect(component.actionForm.controls.colaboradorId.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('No se encontraron');
  });
  it('muestra SIM solo en Smartphone sin SIM y envía equipo y SIM en una petición', async () => {
    expect(fixture.nativeElement.textContent).toContain('Entregar SIM junto al equipo');
    component.selectCollaborator(person); component.toggleJointDelivery(true); fixture.detectChanges();
    await component.execute(); expect(api.asignarColaborador).not.toHaveBeenCalled();
    type('#delivery-sim', '55');
    expect(component.matchingSims().map((s: any) => s.codigoInventario)).toEqual([555]);
    fixture.nativeElement.querySelector('.delivery-suggestions button').click(); fixture.detectChanges();
    await component.execute();
    expect(api.asignarColaborador).toHaveBeenCalledOnce();
    expect(api.asignarColaborador.mock.calls[0][1]).toMatchObject({ colaboradorId: 7, simCodigoInventario: 555 });
    component.item.update((d: any) => ({ ...d, simAsociada: sim })); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Entregar SIM junto al equipo');
    component.item.update((d: any) => ({ ...d, simAsociada: null, tipo: { ...d.tipo, nombre: 'Notebook' } })); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Entregar SIM junto al equipo');
  });
  it('desmarcar SIM y reabrir la operación limpia selecciones previas', async () => {
    component.selectCollaborator(person); component.toggleJointDelivery(true); component.selectSim(sim);
    component.toggleJointDelivery(false); await component.execute();
    expect(api.asignarColaborador.mock.calls[0][1].simCodigoInventario).toBeUndefined();
    component.open('assign-person');
    expect(component.selectedCollaborator()).toBeNull(); expect(component.selectedSim()).toBeNull();
  });
});
