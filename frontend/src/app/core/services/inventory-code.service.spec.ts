import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { InventoryCodeService } from './inventory-code.service';

describe('InventoryCodeService', () => {
  let service: InventoryCodeService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(InventoryCodeService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('filtra familias activas de dispositivos', () => {
    service.listarFamilias({ activo: true, tipoEntidad: 'DISPOSITIVO' }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/familias-codigo?activo=true&tipoEntidad=DISPOSITIVO`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: [] });
  });

  it('solicita una sugerencia explícita de prefijo', () => {
    service.sugerirPrefijo().subscribe((result) => expect(result.prefijo).toBe('7'));
    const request = http.expectOne(`${environment.apiUrl}/familias-codigo/prefijo-sugerido`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { prefijo: '7', disponible: true, mensaje: 'Disponible' } });
  });

  it('crea una familia confirmando nombre, prefijo y estrategia', () => {
    const input = { nombreFamilia: 'Audio', prefijo: '7', estrategiaCodigo: 'REPEAT_PREFIX' as const, activo: true };
    service.crear(input).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/familias-codigo`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(input);
    request.flush({ success: true, data: { id: '7', ...input } });
  });
});
