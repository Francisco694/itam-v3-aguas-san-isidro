import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { StockAlertsService } from '../../core/services/stock-alerts.service';
import { ToastService } from '../../core/services/toast.service';
import { StockAlerts } from './stock-alerts';

const configuration = {
  tipoDispositivo: { id: '1', nombre: 'Smartphone' }, disponibles: 0,
  minimoDisponible: 0, alertaActiva: true, enAlerta: true,
  mensaje: 'No quedan equipos disponibles', creadoPor: null, actualizadoPor: null,
  creadoEn: null, actualizadoEn: null
};

describe('Alertas de stock', () => {
  it('permite consultar pero no modificar a un usuario normal', async () => {
    await TestBed.configureTestingModule({
      imports: [StockAlerts],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: { user: () => ({ rol: 'USUARIO' }) } },
        { provide: StockAlertsService, useValue: { listar: () => of([configuration]), actualizar: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(StockAlerts);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[type=number]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.stock-row button').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Activa');
    expect(fixture.nativeElement.textContent).toContain('AGOTADO');
    expect(fixture.nativeElement.textContent).toContain('Solo el perfil SUPER_USUARIO');
  });

  it('permite al superusuario seleccionar, desmarcar y modificar mínimos', async () => {
    const actualizar = vi.fn((_id, input) => of({ ...configuration, ...input }));
    await TestBed.configureTestingModule({
      imports: [StockAlerts],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: { user: () => ({ rol: 'SUPER_USUARIO' }) } },
        { provide: StockAlertsService, useValue: { listar: () => of([{ ...configuration }]), actualizar } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(StockAlerts);
    fixture.detectChanges();
    const checkbox = fixture.nativeElement.querySelector('input[type=checkbox]') as HTMLInputElement;
    checkbox.checked = false; checkbox.dispatchEvent(new Event('change')); fixture.detectChanges();
    expect(fixture.componentInstance['items']()[0].alertaActiva).toBe(false);
    expect(fixture.nativeElement.querySelector('input[type=number]').disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('.stock-row button').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Inactiva');
    checkbox.checked = true; checkbox.dispatchEvent(new Event('change')); fixture.detectChanges();
    const minimum = fixture.nativeElement.querySelector('input[type=number]') as HTMLInputElement;
    minimum.value = '3'; minimum.dispatchEvent(new Event('input')); fixture.detectChanges();
    fixture.nativeElement.querySelector('.stock-row button').click();
    expect(actualizar).toHaveBeenCalledWith(1, { minimoDisponible: 3, alertaActiva: true });
    expect(fixture.nativeElement.textContent).toContain('se guardó correctamente');
  });

  it('ordena los tipos prioritarios y permite guardar todos los cambios', async () => {
    const notebook = {
      ...configuration,
      tipoDispositivo: { id: '2', nombre: 'Notebook' },
      disponibles: 6,
      enAlerta: false,
    };
    const monitor = {
      ...configuration,
      tipoDispositivo: { id: '3', nombre: 'Monitor' },
      disponibles: 8,
      alertaActiva: false,
      enAlerta: false,
    };
    const actualizar = vi.fn((id, input) => {
      const source = id === 1 ? configuration : id === 2 ? notebook : monitor;
      return of({ ...source, ...input });
    });
    await TestBed.configureTestingModule({
      imports: [StockAlerts],
      providers: [provideRouter([]),
        { provide: AuthService, useValue: { user: () => ({ rol: 'SUPER_USUARIO' }) } },
        { provide: StockAlertsService, useValue: { listar: () => of([monitor, notebook, configuration]), actualizar } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    }).compileComponents();
    const fixture = TestBed.createComponent(StockAlerts);
    fixture.detectChanges();

    const names = [...fixture.nativeElement.querySelectorAll('.stock-device strong')]
      .map((element: Element) => element.textContent?.trim());
    expect(names).toEqual(['Smartphone', 'Notebook', 'Monitor']);

    fixture.nativeElement.querySelector('.save-all').click();
    fixture.detectChanges();
    expect(actualizar).toHaveBeenCalledTimes(3);
    expect(fixture.nativeElement.textContent).toContain('Todos los cambios se guardaron correctamente.');
  });
});
