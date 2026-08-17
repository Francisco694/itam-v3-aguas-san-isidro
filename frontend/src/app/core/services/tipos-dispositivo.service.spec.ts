import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { TiposDispositivoService } from './tipos-dispositivo.service';

describe('TiposDispositivoService', () => {
  let service: TiposDispositivoService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TiposDispositivoService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista únicamente activos cuando se solicita', () => {
    service.listar(true).subscribe((items) => expect(items[0]?.nombre).toBe('Smartphone'));
    const request = http.expectOne(`${environment.apiUrl}/tipos-dispositivo?activo=true`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: [{ id: '1', nombre: 'Smartphone' }] });
  });

  it('envía la familia relacionada al crear un tipo', () => {
    service.crear({ nombre: 'TEST', familiaCodigoInventarioId: 1 }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/tipos-dispositivo`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ nombre: 'TEST', familiaCodigoInventarioId: 1 });
    request.flush({ success: true, data: { id: '9', nombre: 'TEST' } });
  });
});
