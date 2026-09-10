import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { StockAlertsService } from './stock-alerts.service';

describe('StockAlertsService', () => {
  let service: StockAlertsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(StockAlertsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta las alertas calculadas por la API', () => {
    service.listar().subscribe((items) => expect(items[0]?.disponibles).toBe(3));
    const request = http.expectOne(`${environment.apiUrl}/alertas-stock`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, count: 1, data: [{ disponibles: 3 }] });
  });

  it('actualiza mínimo y activación para un tipo', () => {
    service.actualizar(7, { minimoDisponible: 3, alertaActiva: true }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/alertas-stock/7`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ minimoDisponible: 3, alertaActiva: true });
    request.flush({ success: true, data: {} });
  });
});
