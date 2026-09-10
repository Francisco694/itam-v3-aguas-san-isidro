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
    expect(fixture.nativeElement.querySelector('.stock-card button').disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Solo el perfil SUPER_USUARIO');
  });
});
