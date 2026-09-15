import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { NEVER, of } from 'rxjs';
import { DispositivoDetail } from './dispositivo-detail';
import { AuthService } from '../../core/services/auth.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { SimService } from '../../core/services/sim.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { AssetLabel } from '../../shared/components/asset-label/asset-label';

describe('Registrar entrega: formulario', () => {
  let fixture: any;
  let component: any;
  let api: any;
  let simApi: any;
  let confirmation: any;
  const person = { id: '7', nombre: 'Marta Pérez', rut: '12.345.678-5', activo: true, cargo: 'Analista', departamento: null };
  const sim = { id: '8', codigoInventario: 555, numeroAsociado: '912345678', compania: 'Operador', estado: { codigo: 'DISPONIBLE' }, dispositivo: null, colaborador: null };
  beforeEach(async () => {
    vi.spyOn(AssetLabel.prototype as any, 'renderQr').mockResolvedValue(undefined);
    api = { asignarColaborador: vi.fn(() => NEVER), cambiarEstado: vi.fn(() => of({})), verificarManual: vi.fn(() => of({ resultado: 'VERIFICADO' })), asociarLinea: vi.fn(() => of({ id: '15', numeroTelefonico: '56912345678', estado: 'ACTIVA', dispositivoId: '1', simId: '8' })) };
    simApi = { listar: vi.fn(() => of([sim, { ...sim, id: '9', codigoInventario: 556, colaborador: person }])), asociarDispositivo: vi.fn(() => of(sim)) };
    confirmation = { confirm: vi.fn(async () => true) };
    await TestBed.configureTestingModule({ imports: [DispositivoDetail], providers: [provideHttpClient(), provideRouter([]),
      { provide: AuthService, useValue: { user: () => ({ nombre: 'Responsable TI' }) } },
      { provide: DispositivosService, useValue: api },
      { provide: SimService, useValue: simApi },
      { provide: ConfirmationService, useValue: confirmation }
    ] }).compileComponents();
    fixture = TestBed.createComponent(DispositivoDetail);
    component = fixture.componentInstance;
    component.codigo = 1445;
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
    expect(fixture.nativeElement.querySelector('#colaborador')).toBeNull();
    fixture.nativeElement.querySelector('.delivery-selection button').click(); fixture.detectChanges();
    type('#colaborador', 'XYZ');
    expect(component.actionForm.controls.colaboradorId.value).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Sin colaboradores encontrados');
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
  it('confirma una verificación manual pendiente y evita mostrarla después', async () => {
    component.item.update((device: any) => ({ ...device, verificacionFisica: { resultado: 'PENDIENTE' } }));
    await component.verifyManually();
    expect(confirmation.confirm).toHaveBeenCalledOnce();
    expect(api.verificarManual).toHaveBeenCalledWith(1445);
  });
  it('asocia una SIM disponible desde el diálogo independiente', async () => {
    component.openSimAssociation(); fixture.detectChanges();
    component.selectAssociationSimByCode('555');
    await component.associateSim();
    expect(api.asociarLinea).toHaveBeenCalledWith(1445, expect.objectContaining({ numeroTelefonico: '56912345678', simId: '8' }));
    expect(simApi.asociarDispositivo).not.toHaveBeenCalled();
  });
  it('exige decidir qué ocurre con la línea al reportar un Smartphone con SIM perdido', async () => {
    component.item.update((device: any) => ({ ...device, simAsociada: sim }));
    component.states.set([{ id: '80', codigo: 'EXTRAVIADO', nombre: 'Extraviado', esTerminal: true, activo: true }]);
    component.openState('EXTRAVIADO'); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#lost-line-action')).not.toBeNull();
    await component.execute();
    expect(api.cambiarEstado).not.toHaveBeenCalled();
    component.actionForm.controls.accionLineaExtravio.setValue('CONSERVAR_BLOQUEAR');
    await component.execute();
    expect(api.cambiarEstado).toHaveBeenCalledWith(1445, expect.objectContaining({
      accionLineaExtravio: 'CONSERVAR_BLOQUEAR'
    }));
  });
});
