import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { environment } from '../../../environments/environment';
import { SimLineManagement } from './sim-line-management';

describe('SIM disponible: clic real de guardar', () => {
  let fixture: any;
  let http: HttpTestingController;
  let changed: ReturnType<typeof vi.fn>;
  const base = `${environment.apiUrl}/sim/2014`;
  const sim = { id: '14', codigoInventario: 2014, iccidCodigoFabrica: '8956032262763686634', compania: 'Claro', estado: { codigo: 'DISPONIBLE', nombre: 'Disponible' }, lineaMovil: null, dispositivo: null, colaborador: null };
  const saved = { ...sim, lineaMovil: { id: '77', numeroTelefonico: '56976708988', estado: 'ACTIVA' } };
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SimLineManagement], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { user: () => ({ nombre: 'TI', rol: 'USUARIO' }) } },
      { provide: ConfirmationService, useValue: {} }
    ] }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(SimLineManagement);
    fixture.componentRef.setInput('sim', sim);
    changed = vi.fn();
    fixture.componentInstance.changed.subscribe(changed);
    fixture.detectChanges();
    http.expectOne(`${base}/lineas-historial`).flush({ data: [] });
    fixture.nativeElement.querySelector('.panel-actions button').click();
    http.expectOne(`${environment.apiUrl}/sim`).flush({ data: [sim] });
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); http.verify(); });
  async function enterNumber() {
    const input = fixture.nativeElement.querySelector('#line-number-search');
    input.value = '9 7670 8988';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await new Promise(resolve => setTimeout(resolve, 400));
    http.expectOne(`${environment.apiUrl}/lineas-moviles/numero/56976708988`)
      .flush({ error: { message: 'Línea no encontrada' } }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Número disponible');
    expect(fixture.nativeElement.querySelector('.result-summary').textContent).toContain('56976708988');
    const button = fixture.nativeElement.querySelector('button[type=submit]');
    expect(button.disabled).toBe(false);
    return button;
  }
  it('el clic envía PATCH con número; espera lectura persistida antes de cerrar y emitir changed', async () => {
    (await enterNumber()).click();
    const patch = http.expectOne(base);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ numeroAsociado: '56976708988' });
    expect(changed).not.toHaveBeenCalled();
    patch.flush({ data: saved });
    const reload = http.expectOne(base);
    expect(reload.request.method).toBe('GET');
    expect(changed).not.toHaveBeenCalled();
    reload.flush({ data: saved });
    http.expectOne(`${base}/lineas-historial`).flush({ data: [] });
    fixture.detectChanges();
    expect(changed).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledWith('Número asociado correctamente.');
    expect(fixture.nativeElement.querySelector('.line-dialog')).toBeNull();
  });
  it('doble clic durante el guardado envía una sola escritura', async () => {
    const button = await enterNumber();
    button.click();
    button.click();
    const requests = http.match(request => request.method === 'PATCH');
    expect(requests).toHaveLength(1);
    requests[0].flush({ data: saved });
    http.expectOne(base).flush({ data: saved });
    http.expectOne(`${base}/lineas-historial`).flush({ data: [] });
    expect(changed).toHaveBeenCalledOnce();
  });
  it('fallo de recarga posterior al PATCH no muestra éxito ni cierra el modal', async () => {
    (await enterNumber()).click();
    http.expectOne(base).flush({ data: saved });
    const reload = http.expectOne(base);
    http.expectOne(`${base}/lineas-historial`).flush({ data: [] });
    reload.flush({}, { status: 500, statusText: 'Internal Server Error' });
    fixture.detectChanges();
    expect(changed).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.line-dialog')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.notice--success')).toBeNull();
    expect(fixture.nativeElement.querySelector('.notice--error').textContent).toContain('confirmar');
  });
  it('PATCH fallido conserva modal y número para reintentar, sin éxito ni changed', async () => {
    (await enterNumber()).click();
    http.expectOne(base).flush({ error: { message: 'SIM no encontrada' } }, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();
    expect(changed).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.line-dialog')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#line-number-search').value).toContain('7670');
    expect(fixture.nativeElement.querySelector('.notice--success')).toBeNull();
    expect(fixture.nativeElement.querySelector('.notice--error')).not.toBeNull();
  });
  it('200 seguido de detalle sin línea no produce éxito falso', async () => {
    (await enterNumber()).click();
    http.expectOne(base).flush({ data: saved });
    http.expectOne(base).flush({ data: sim });
    http.expectOne(`${base}/lineas-historial`).flush({ data: [] });
    fixture.detectChanges();
    expect(changed).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.line-dialog')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.notice--error').textContent).toContain('confirmar');
  });
  it('cancelar no ejecuta escrituras', async () => {
    await enterNumber();
    fixture.nativeElement.querySelector('.form-actions button[type=button]').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.line-dialog')).toBeNull();
    http.expectNone(base);
    expect(changed).not.toHaveBeenCalled();
  });
});
