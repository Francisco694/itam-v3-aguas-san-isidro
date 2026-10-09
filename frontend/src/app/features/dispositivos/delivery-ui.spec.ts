import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';
import { DispositivoDetail, deviceSimSearchMatches } from './dispositivo-detail';
import { AuthService } from '../../core/services/auth.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { SimService } from '../../core/services/sim.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ReemplazosDispositivoService } from '../../core/services/reemplazos-dispositivo.service';
import { ActasEntregaService } from '../../core/services/actas-entrega.service';
import { AssetLabel } from '../../shared/components/asset-label/asset-label';
import { ApiError } from '../../core/models/api.models';

describe('Registrar entrega: formulario', () => {
  let fixture: any;
  let component: any;
  let api: any;
  let simApi: any;
  let confirmation: any;
  let replacementApi: any;
  let actaApi: any;
  const person = { id: '7', nombre: 'Marta Pérez', rut: '12.345.678-5', activo: true, cargo: 'Analista', departamento: null };
  const sim = { id: '8', codigoInventario: 555, numeroAsociado: '912345678', compania: 'Operador', estado: { codigo: 'DISPONIBLE' }, dispositivo: null, colaborador: null };
  beforeEach(async () => {
    vi.spyOn(AssetLabel.prototype as any, 'renderQr').mockResolvedValue(undefined);
    api = { listar: vi.fn(() => of([])), asignarColaborador: vi.fn(() => NEVER), devolver: vi.fn(() => of({ dispositivo: {}, comprobante: {} })), darBaja: vi.fn(() => of({})), cambiarEstado: vi.fn(() => of({})), verificarManual: vi.fn(() => of({ resultado: 'VERIFICADO' })), asociarLinea: vi.fn(() => of({ id: '15', numeroTelefonico: '56912345678', estado: 'ACTIVA', dispositivoId: '1', simId: '8' })), gestionarLineaSim: vi.fn(() => of({ operacion: 'CAMBIAR_SIM_MANTENER_NUMERO' })), registrarSimNueva: vi.fn(() => of({ operacion: 'REGISTRAR_SIM_NUEVA' })), obtener: vi.fn(() => of({ id: '1', codigoInventario: 1445, tipo: { id: '1', nombre: 'Smartphone', configuracionFormulario: { camposEspecificos: [] } }, estado: { codigo: 'DISPONIBLE', nombre: 'Disponible' }, tipoCustodia: 'NONE', simAsociada: null, lineaMovil: null, atributosEspecificos: {}, creadoEn: '2026-01-01', valorComercial: 0 })) };
    simApi = { listar: vi.fn(() => of([sim, { ...sim, id: '9', codigoInventario: 556, colaborador: person }])), buscarPorIccid: vi.fn(() => throwError(() => new ApiError('NOT_FOUND', 'No encontrada', 404))), asociarDispositivo: vi.fn(() => of(sim)) };
    confirmation = { confirm: vi.fn(async () => true) };
    replacementApi = {
      crear: vi.fn(() => of({ id: 'replacement-1', estadoOperacion: 'COMPLETADO' })),
      pendientes: vi.fn(() => of([])),
      recibir: vi.fn(() => of({})),
      porColaborador: vi.fn(() => of([]))
    };
    actaApi = { crear: vi.fn(() => of({ id: 'acta-1' })), pdfUrl: vi.fn(() => '') };
    await TestBed.configureTestingModule({ imports: [DispositivoDetail], providers: [provideHttpClient(), provideRouter([]),
      { provide: AuthService, useValue: { user: () => ({ nombre: 'Responsable TI' }) } },
      { provide: DispositivosService, useValue: api },
      { provide: SimService, useValue: simApi },
      { provide: ReemplazosDispositivoService, useValue: replacementApi },
      { provide: ActasEntregaService, useValue: actaApi },
      { provide: ConfirmationService, useValue: confirmation }
    ] }).compileComponents();
    fixture = TestBed.createComponent(DispositivoDetail);
    component = fixture.componentInstance;
    component.codigo = 1445;
    component.load = () => {};
    component.item.set({ id: '1', codigoInventario: 1445, tipo: { id: '1', nombre: 'Smartphone', configuracionFormulario: { camposEspecificos: [] } }, estado: { codigo: 'DISPONIBLE', nombre: 'Disponible' }, tipoCustodia: 'NONE', simAsociada: null, atributosEspecificos: {}, creadoEn: '2026-01-01', valorComercial: 0 });
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
  it('advierte cuando el colaborador ya tiene el mismo tipo y ofrece agregar o reemplazar', async () => {
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }]));
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('actualmente bajo custodia');
    expect(fixture.nativeElement.textContent).toContain('Agregar');
    expect(fixture.nativeElement.textContent).toContain('Reemplazar');
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[0].click(); fixture.detectChanges();
    expect(component.assignmentResolution()).toBe('ADD');
  });
  it('al elegir reemplazar solicita el estado final del equipo anterior', async () => {
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }]));
    component.states.set([
      { id: '1', codigo: 'DISPONIBLE', nombre: 'Disponible', esTerminal: false, activo: true },
      { id: '5', codigo: 'RETENIDO_REVISION', nombre: 'Retenido / En Revisión', esTerminal: false, activo: true },
      { id: '4', codigo: 'SERVICIO_TECNICO', nombre: 'Servicio Técnico', esTerminal: false, activo: true },
      { id: '7', codigo: 'DADO_BAJA', nombre: 'Dado de Baja', esTerminal: true, activo: true }
    ]);
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[1].click(); fixture.detectChanges();
    expect(component.assignmentResolution()).toBe('REPLACE');
    component.chooseReplacementDelivery(true); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('será recibido en bodega');
    expect(fixture.nativeElement.querySelector('#replacement-state')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Reemplazar equipo');
  });

  it('entrega normal no muestra conflicto y presenta el botón Agregar equipo', async () => {
    api.asignarColaborador.mockReturnValue(of({ ...component.item(), codigoInventario: 1445 }));
    component.selectCollaborator(person);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Confirmar operación');
    expect(fixture.nativeElement.textContent).not.toContain('TIPO DE ENTREGA');
    await component.execute();
    expect(api.asignarColaborador).toHaveBeenCalledOnce();
  });

  it('si hay varios equipos del tipo exige seleccionar explícitamente el anterior', async () => {
    const devices = [
      { id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } },
      { id: '23', codigoInventario: 2003, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Motorola', modelo: 'G8', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }
    ];
    api.listar.mockReturnValue(of(devices));
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[1].click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('#replacement-device option').length).toBe(2);
    component.selectReplacementDevice('2003', devices as any);
    expect(component.replacementDevice().codigoInventario).toBe(2003);
  });

  it('lista todos los equipos actuales aunque sean de tipos distintos', async () => {
    const devices = [
      { id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } },
      { id: '23', codigoInventario: 2003, tipo: { id: '2', nombre: 'Notebook' }, marca: 'Lenovo', modelo: 'ThinkPad', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }
    ];
    api.listar.mockReturnValue(of(devices));
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[1].click(); fixture.detectChanges();
    const options = [...fixture.nativeElement.querySelectorAll('#replacement-device option')].map((option: HTMLOptionElement) => option.textContent);
    expect(options.join(' ')).toContain('2002');
    expect(options.join(' ')).toContain('2003');
  });

  it('permite conservar el número actual aunque la SIM nueva tenga otra compañía', async () => {
    const oldSim = { id: 'old-sim', codigoInventario: 2004, iccidCodigoFabrica: '8956000000000000004', compania: 'CLARO', estado: { codigo: 'ASIGNADA', nombre: 'Asignada' }, lineaMovil: { id: 'line-4', numeroTelefonico: '56912345678', estado: 'ACTIVA', dispositivoId: '22', simId: 'old-sim' } };
    const oldDevice = { id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' }, simAsociada: oldSim };
    api.listar.mockReturnValue(of([oldDevice]));
    component.states.set([{ id: '1', codigo: 'DISPONIBLE', nombre: 'Disponible', esTerminal: false, activo: true }]);
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[1].click(); fixture.detectChanges();
    component.chooseReplacementDelivery(true);
    component.replacementStateId.set('1');
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.replacement-new-sim-toggle input').click(); fixture.detectChanges();
    const keepNumber = fixture.nativeElement.querySelectorAll('input[name="replacement-new-line"]')[0] as HTMLInputElement;
    expect(keepNumber.disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('+56 9 1234 5678');
    component.replacementNewCompany.set('WOM'); fixture.detectChanges();
    keepNumber.click(); fixture.detectChanges();
    expect(component.replacementNewLine()).toBe('CONSERVAR_NUMERO');
    expect(fixture.nativeElement.textContent).toContain('se mantendrá y será asociado a la nueva SIM WOM');
  });

  it('muestra validación inline cuando falta decidir la entrega física del equipo anterior', async () => {
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }]));
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[1].click(); fixture.detectChanges();
    await component.confirmReplacement(); fixture.detectChanges();
    expect(component.actionError()).toBe('');
    expect(fixture.nativeElement.querySelector('.replacement-delivery-question .field-error').textContent.trim()).toBe('Debes indicar si el equipo anterior fue entregado físicamente.');
    expect(replacementApi.crear).not.toHaveBeenCalled();
  });

  it('reemplazo inmediato usa el endpoint transaccional y no el flujo genérico', async () => {
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }]));
    component.states.set([{ id: '1', codigo: 'DISPONIBLE', nombre: 'Disponible', esTerminal: false, activo: true }]);
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[1].click();
    component.chooseReplacementDelivery(true);
    component.replacementStateId.set('1');
    await component.confirmReplacement();
    expect(replacementApi.crear).toHaveBeenCalledWith(expect.objectContaining({
      dispositivoAnteriorCodigo: 2002,
      dispositivoNuevoCodigo: 1445,
      entregaAnterior: true,
      destinoDispositivoAnterior: 'DISPONIBLE'
    }));
    expect(replacementApi.crear.mock.calls[0][0]).not.toHaveProperty('simNueva');
    expect(api.devolver).not.toHaveBeenCalled();
    expect(api.asignarColaborador).not.toHaveBeenCalled();
  });

  it('agregar conserva el equipo anterior y no crea una operación de reemplazo', async () => {
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }]));
    api.asignarColaborador.mockReturnValue(of({ ...component.item(), codigoInventario: 1445 }));
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[0].click();
    await component.execute();
    expect(api.asignarColaborador).toHaveBeenCalledOnce();
    expect(replacementApi.crear).not.toHaveBeenCalled();
  });

  it('cancelar la decisión de agregar o reemplazar no persiste cambios', async () => {
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }]));
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    component.cancelAssignmentDecision(); fixture.detectChanges();
    expect(replacementApi.crear).not.toHaveBeenCalled();
    expect(api.asignarColaborador).not.toHaveBeenCalled();
    expect(component.assignmentResolution()).toBeNull();
  });

  it('reemplazar sin entregar persiste el anterior pendiente y no lo devuelve desde frontend', async () => {
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }]));
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[1].click(); fixture.detectChanges();
    component.chooseReplacementDelivery(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('El dispositivo anterior no ha sido entregado');
    expect(fixture.nativeElement.textContent).toContain('Continuará bajo responsabilidad del colaborador');
    expect(fixture.nativeElement.textContent).toContain('Continuar');
    expect(fixture.nativeElement.textContent).toContain('Cancelar');
    await component.confirmReplacement();
    expect(replacementApi.crear).toHaveBeenCalledWith(expect.objectContaining({
      colaboradorId: 7,
      dispositivoAnteriorCodigo: 2002,
      dispositivoNuevoCodigo: 1445,
      entregaAnterior: false
    }));
    expect(api.devolver).not.toHaveBeenCalled();
  });
  it('recepción posterior exige decidir si la SIM fue entregada y envía SIM entregada', async () => {
    const oldSim = { id: 'old-sim', codigoInventario: 777, iccidCodigoFabrica: '8956000000000000000', compania: 'Operador', estado: { codigo: 'ASIGNADA', nombre: 'Asignada' }, lineaMovil: { id: 'line-1', numeroTelefonico: '5697000000', estado: 'ACTIVA', dispositivoId: '22', simId: 'old-sim' } };
    component.item.update((device: any) => ({ ...device, colaborador: person, simAsociada: oldSim, lineaMovil: oldSim.lineaMovil }));
    component.pendingReplacement.set({ id: 'replacement-pending', fechaInicio: '2026-10-01T12:00:00Z', dispositivoAnterior: { codigoInventario: 2002 }, dispositivoNuevo: { codigoInventario: 1445 }, estadoOperacion: 'PENDIENTE_DEVOLUCION' });
    component.states.set([{ id: '1', codigo: 'RETENIDO_REVISION', nombre: 'Retenido / En Revisión', esTerminal: false, activo: true }]);
    component.open('return'); fixture.detectChanges();
    component.replacementStateId.set('1');
    await component.execute();
    expect(replacementApi.recibir).not.toHaveBeenCalled();
    expect(component.actionError()).toContain('Indica si la SIM');
    component.choosePendingSimDelivery(true); fixture.detectChanges();
    await component.execute();
    expect(replacementApi.recibir).toHaveBeenCalledWith('replacement-pending', expect.objectContaining({ destinoDispositivoAnterior: 'RETENIDO_REVISION', simEntregada: true }));
  });
  it('recepción posterior puede registrar solo el dispositivo y conservar la custodia de la SIM', async () => {
    const oldSim = { id: 'old-sim', codigoInventario: 778, iccidCodigoFabrica: '8956000000000000001', compania: 'Operador', estado: { codigo: 'ASIGNADA', nombre: 'Asignada' }, lineaMovil: { id: 'line-2', numeroTelefonico: '5697000001', estado: 'ACTIVA', dispositivoId: '22', simId: 'old-sim' } };
    component.item.update((device: any) => ({ ...device, colaborador: person, simAsociada: oldSim, lineaMovil: oldSim.lineaMovil }));
    component.pendingReplacement.set({ id: 'replacement-pending-2', fechaInicio: '2026-10-01T12:00:00Z', dispositivoAnterior: { codigoInventario: 2002 }, dispositivoNuevo: { codigoInventario: 1445 }, estadoOperacion: 'PENDIENTE_DEVOLUCION' });
    component.states.set([{ id: '1', codigo: 'RETENIDO_REVISION', nombre: 'Retenido / En Revisión', esTerminal: false, activo: true }]);
    component.open('return'); fixture.detectChanges();
    component.replacementStateId.set('1');
    component.choosePendingSimDelivery(false);
    await component.execute();
    expect(replacementApi.recibir).toHaveBeenCalledWith('replacement-pending-2', expect.objectContaining({ destinoDispositivoAnterior: 'RETENIDO_REVISION', simEntregada: false }));
  });
  it('si el equipo anterior tiene SIM muestra la resolución explícita antes de confirmar', async () => {
    const oldSim = { id: 'old-sim', codigoInventario: 777, iccidCodigoFabrica: '8956000000000000000', numeroAsociado: '5697000000', compania: 'Operador', estado: { codigo: 'ASIGNADA', nombre: 'Asignada' }, lineaMovil: { id: 'line-1', numeroTelefonico: '5697000000', estado: 'ACTIVA', dispositivoId: '22', simId: 'old-sim' } };
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' }, simAsociada: oldSim, lineaMovil: oldSim.lineaMovil }]));
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[1].click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('SIM: ITAM 777');
    expect(fixture.nativeElement.textContent).toContain('Mover SIM actual al dispositivo nuevo');
    expect(fixture.nativeElement.textContent).toContain('Utilizar otra SIM registrada');
    expect(fixture.nativeElement.textContent).toContain('Entregar dispositivo nuevo sin SIM');
    expect(replacementApi.crear).not.toHaveBeenCalled();
  });
  it('bloquea mover la SIM si el reemplazo queda pendiente de devolución', async () => {
    const oldSim = { id: 'old-sim', codigoInventario: 777, iccidCodigoFabrica: '8956000000000000000', numeroAsociado: '5697000000', compania: 'Operador', estado: { codigo: 'ASIGNADA', nombre: 'Asignada' }, lineaMovil: { id: 'line-1', numeroTelefonico: '5697000000', estado: 'ACTIVA', dispositivoId: '22', simId: 'old-sim' } };
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' }, simAsociada: oldSim, lineaMovil: oldSim.lineaMovil }]));
    component.selectCollaborator(person);
    await component.execute();
    component.chooseReplaceAssignment();
    component.chooseReplacementDelivery(false);
    component.chooseReplacementSimAction('MOVER_SIM_ACTUAL');
    await component.confirmReplacement();
    expect(component.actionError()).toContain('No se puede mover la SIM');
    expect(replacementApi.crear).not.toHaveBeenCalled();
  });
  it('envía la SIM existente y la decisión de número al endpoint de reemplazo', async () => {
    const oldSim = { id: 'old-sim', codigoInventario: 777, iccidCodigoFabrica: '8956000000000000000', numeroAsociado: '5697000000', compania: 'Operador', estado: { codigo: 'ASIGNADA', nombre: 'Asignada' }, lineaMovil: { id: 'line-1', numeroTelefonico: '5697000000', estado: 'ACTIVA', dispositivoId: '22', simId: 'old-sim' } };
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' }, simAsociada: oldSim, lineaMovil: oldSim.lineaMovil }]));
    component.states.set([{ id: '1', codigo: 'DISPONIBLE', nombre: 'Disponible', esTerminal: false, activo: true }]);
    component.selectCollaborator(person);
    await component.execute();
    component.chooseReplaceAssignment();
    component.chooseReplacementDelivery(true);
    component.replacementStateId.set('1');
    component.chooseReplacementSimAction('USAR_SIM_EXISTENTE');
    component.replacementSimCode.set('555');
    component.replacementKeepNumber.set(false);
    await component.confirmReplacement();
    expect(replacementApi.crear).toHaveBeenCalledWith(expect.objectContaining({
      accionSim: 'USAR_SIM_EXISTENTE',
      simDestinoCodigo: 555,
      conservarNumero: false,
      entregaAnterior: true
    }));
  });
  it('confirma una verificación manual pendiente y evita mostrarla después', async () => {
    component.item.update((device: any) => ({ ...device, verificacionFisica: { resultado: 'PENDIENTE' } }));
    await component.verifyManually();
    expect(confirmation.confirm).toHaveBeenCalledOnce();
    expect(api.verificarManual).toHaveBeenCalledWith(1445);
  });
  it('asocia una SIM disponible desde el modal contextual usando la operación atómica', async () => {
    component.item.update((device: any) => ({ ...device, lineaMovil: { id: 'line-1', numeroTelefonico: '56912345678', estado: 'ACTIVA', dispositivoId: '1', simId: null } }));
    component.openSimAssociation(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#association-sim')).toBeNull();
    component.selectAssociationSim(sim); fixture.detectChanges();
    await component.associateSim();
    expect(api.gestionarLineaSim).toHaveBeenCalledWith(1445, expect.objectContaining({ mantenerNumero: true, mantenerSim: false, simDestinoCodigo: 555 }));
    expect(api.asociarLinea).not.toHaveBeenCalled();
    expect(simApi.asociarDispositivo).not.toHaveBeenCalled();
  });

  it('habilita Asociar SIM sin línea en un Router celular y conserva el número vacío', async () => {
    const targetSim = { ...sim, iccidCodigoFabrica: '8956032262763687244', numeroAsociado: null, lineaMovil: null };
    simApi.listar.mockReturnValue(of([targetSim]));
    component.item.update((device: any) => ({
      ...device,
      tipo: { id: 'router', nombre: 'Router', permiteSim: false, configuracionFormulario: { camposEspecificos: [] } },
      atributosEspecificos: { utilizaRedMovil: true },
      imei: '359158762297938',
      lineaMovil: null,
      simAsociada: null
    }));
    api.obtener.mockReturnValueOnce(of({
      ...component.item(),
      simAsociada: { id: targetSim.id, codigoInventario: targetSim.codigoInventario, iccidCodigoFabrica: targetSim.iccidCodigoFabrica, compania: targetSim.compania, numeroAsociado: null, lineaMovil: null },
      lineaMovil: null
    }));
    component.openSimAssociation();
    fixture.detectChanges();
    component.chooseAssociationChange('SIM');
    component.selectAssociationSim(targetSim);
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector('.sim-association-dialog button[type="submit"]');
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toContain('Asociar SIM');
    submit.click();
    fixture.detectChanges();

    expect(api.gestionarLineaSim).toHaveBeenCalledWith(1445, expect.objectContaining({
      mantenerNumero: true,
      mantenerSim: false,
      simDestinoCodigo: 555,
      numeroNuevo: null
    }));
    expect(api.obtener).toHaveBeenCalledWith(1445);
    expect(component.item().simAsociada.codigoInventario).toBe(555);
    expect(component.item().lineaMovil).toBeNull();
  });

  it('oculta mantener configuración cuando el equipo no tiene línea', () => {
    component.item.update((device: any) => ({ ...device, lineaMovil: null, simAsociada: null }));
    component.openSimAssociation(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Mantener configuración actual');
    expect(fixture.nativeElement.textContent).toContain('Registrar número y SIM');
  });

  it('limita el autocomplete de SIM del modal a ocho resultados', () => {
    const sims = Array.from({ length: 12 }, (_, index) => ({ ...sim, id: String(index), codigoInventario: 700 + index }));
    expect(deviceSimSearchMatches(sims as any, '7').length).toBe(8);
  });

  it('registra una SIM nueva inline y envía una sola operación compuesta', async () => {
    component.item.update((device: any) => ({ ...device, lineaMovil: null, simAsociada: null }));
    component.openSimAssociation();
    component.associationNumberChanged('56912345678');
    component.associationLineState.set('available');
    component.associationSimSearchChanged('8956032262763689999');
    component.startAssociationInlineRegistration();
    component.associationNewCompany.set('Otro');
    component.associationOtherCompany.set('Operador terreno');
    await component.associateSim();
    expect(api.registrarSimNueva).toHaveBeenCalledOnce();
    expect(api.registrarSimNueva.mock.calls[0][0]).toBe(1445);
    expect(api.registrarSimNueva.mock.calls[0][1]).toMatchObject({ accionLinea: 'CREAR_LINEA_NUEVA', numeroNuevo: '56912345678', iccidCodigoFabrica: '8956032262763689999', compania: 'Operador terreno' });
    expect(api.asociarLinea).not.toHaveBeenCalled();
    expect(api.gestionarLineaSim).not.toHaveBeenCalled();
  });

  it('cancelar el modal no realiza solicitudes de escritura', () => {
    component.openSimAssociation();
    component.closeSimAssociation();
    expect(api.asociarLinea).not.toHaveBeenCalled();
    expect(api.gestionarLineaSim).not.toHaveBeenCalled();
    expect(api.registrarSimNueva).not.toHaveBeenCalled();
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
  it('registra una SIM nueva desde el reemplazo y valida el ICCID antes de enviar', async () => {
    api.listar.mockReturnValue(of([{ id: '22', codigoInventario: 2002, tipo: { id: '1', nombre: 'Smartphone' }, marca: 'Samsung', modelo: 'A13', estado: { codigo: 'ASIGNADO', nombre: 'Asignado' } }]));
    component.states.set([{ id: '1', codigo: 'DISPONIBLE', nombre: 'Disponible', esTerminal: false, activo: true }]);
    component.selectCollaborator(person);
    await component.execute(); fixture.detectChanges();
    fixture.nativeElement.querySelectorAll('input[name="assignment-resolution"]')[1].click(); fixture.detectChanges();
    component.chooseReplacementDelivery(true);
    component.replacementStateId.set('1');
    fixture.detectChanges();
    expect(component.replacementSimAction()).toBeNull();
    expect(fixture.nativeElement.querySelector('#replacement-new-iccid')).toBeNull();
    fixture.nativeElement.querySelector('.replacement-new-sim-toggle input').click(); fixture.detectChanges();
    expect(component.replacementSimAction()).toBe('REGISTRAR_SIM_NUEVA');
    expect(fixture.nativeElement.querySelector('#replacement-new-iccid')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#replacement-new-company')).not.toBeNull();
    fixture.nativeElement.querySelector('.replacement-new-sim-toggle input').click(); fixture.detectChanges();
    expect(component.replacementSimAction()).toBeNull();
    expect(fixture.nativeElement.querySelector('#replacement-new-iccid')).toBeNull();
    fixture.nativeElement.querySelector('.replacement-new-sim-toggle input').click(); fixture.detectChanges();
    type('#replacement-new-iccid', '8956000000000000099');
    fixture.nativeElement.querySelector('#replacement-new-iccid + button').click(); fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('ICCID disponible');
    const noLineRadio = fixture.nativeElement.querySelectorAll('input[name="replacement-new-line"]')[2];
    noLineRadio.click(); fixture.detectChanges();
    expect(component.replacementNewLine()).toBe('SIN_LINEA');
    noLineRadio.click(); fixture.detectChanges();
    expect(component.replacementNewLine()).toBeNull();
    noLineRadio.click(); fixture.detectChanges();
    expect(component.replacementNewLine()).toBe('SIN_LINEA');
    const newLineRadio = fixture.nativeElement.querySelectorAll('input[name="replacement-new-line"]')[1];
    newLineRadio.click(); fixture.detectChanges();
    expect(component.replacementNewLine()).toBe('NUMERO_NUEVO');
    newLineRadio.click(); fixture.detectChanges();
    expect(component.replacementNewLine()).toBeNull();
    component.chooseReplacementNewLine('NUMERO_NUEVO');
    component.replacementNewPhone.set('+56 9 1234 5678');
    component.replacementNewCompany.set('Operador');
    await component.confirmReplacement();
    expect(replacementApi.crear).toHaveBeenCalledWith(expect.objectContaining({
      accionSim: 'REGISTRAR_SIM_NUEVA',
      simNueva: expect.objectContaining({ iccidCodigoFabrica: '8956000000000000099', linea: 'NUMERO_NUEVO', numeroTelefonico: '+56 9 1234 5678' })
    }));
  });
  it('muestra una SIM existente por ICCID para reutilizarla', () => {
    simApi.buscarPorIccid.mockReturnValue(of(sim));
    component.chooseReplacementSimAction('REGISTRAR_SIM_NUEVA');
    component.replacementNewIccidChanged('8956000000000000001');
    component.checkReplacementNewIccid();
    expect(component.replacementExistingSim()).toEqual(sim);
    expect(component.replacementNewIccidStatus()).toBe('existing');
  });
  it('calcula opciones de línea de una SIM existente sin duplicar números y permite deseleccionarlas', () => {
    const oldDevice = { codigoInventario: 2002, numeroTelefonico: '5697000000', simAsociada: null };
    component.replacementSimAction.set('USAR_SIM_EXISTENTE');
    component.replacementSimCode.set('555');
    component.replacementSims.set([{ ...sim, numeroAsociado: '5698000000', lineaMovil: { id: 'line-2', numeroTelefonico: '5698000000' } }]);
    expect(component.replacementExistingLineOptions(oldDevice).map((option: any) => option.value)).toEqual(['CONSERVAR_NUMERO', 'USAR_NUMERO_SIM', 'NUMERO_NUEVO', 'SIN_LINEA']);
    component.chooseReplacementExistingLine('USAR_NUMERO_SIM');
    expect(component.replacementEffectiveExistingLineChoice()).toBe('USAR_NUMERO_SIM');
    component.chooseReplacementExistingLine(null);
    expect(component.replacementEffectiveExistingLineChoice()).toBeNull();
    component.replacementSims.set([{ ...sim, numeroAsociado: null, lineaMovil: null }]);
    expect(component.replacementExistingLineOptions(oldDevice).map((option: any) => option.value)).toEqual(['CONSERVAR_NUMERO', 'NUMERO_NUEVO', 'SIN_LINEA']);
  });
});
