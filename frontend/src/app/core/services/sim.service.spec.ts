import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { DispositivosService } from './dispositivos.service';
import { SimService } from './sim.service';

describe('SimService Fase 2/3B', () => {
  let service: SimService;
  let devices: DispositivosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(SimService);
    devices = TestBed.inject(DispositivosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta ICCID y permite distinguir disponible de registrado', () => {
    service.buscarPorIccid('8956 0322-6276 3686246').subscribe((sim) => expect(sim.codigoInventario).toBe(2055));
    const request = http.expectOne(`${environment.apiUrl}/sim/iccid/8956%200322-6276%203686246`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { codigoInventario: 2055 } });
  });

  it('conserva los contratos de asociacion, desasociacion e historial', () => {
    service.asociarLinea(2055, { lineaMovilId: 8, motivo: 'REEMPLAZO_SIM', responsable: 'TI' }).subscribe();
    let request = http.expectOne(`${environment.apiUrl}/sim/2055/asociar-linea`);
    expect(request.request.body).toEqual({ lineaMovilId: 8, motivo: 'REEMPLAZO_SIM', responsable: 'TI' });
    request.flush({ success: true, data: {} });
    service.desasociarLinea(2055, { responsable: 'TI' }).subscribe();
    request = http.expectOne(`${environment.apiUrl}/sim/2055/desasociar-linea`);
    expect(request.request.method).toBe('POST');
    request.flush({ success: true, data: {} });
    service.historialLineas(2055).subscribe((history) => expect(history).toEqual([]));
    request = http.expectOne(`${environment.apiUrl}/sim/2055/lineas-historial`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: [] });
  });

  it('envia una unica operacion atomica para cambiar SIM y numero', () => {
    devices.gestionarLineaSim(1450, {
      mantenerSim: false,
      mantenerNumero: false,
      simDestinoCodigo: 2055,
      numeroNuevo: '56911112222',
      observaciones: 'Prueba Fase 3B'
    }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/dispositivos/1450/gestionar-linea-sim`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      mantenerSim: false,
      mantenerNumero: false,
      simDestinoCodigo: 2055,
      numeroNuevo: '56911112222',
      observaciones: 'Prueba Fase 3B'
    });
    request.flush({ success: true, data: { operacion: 'CAMBIAR_SIM_CAMBIAR_NUMERO' } });
  });

  it('busca la linea oficial aunque no tenga SIM', () => {
    service.buscarLineaPorNumero('+56 9 1111 2222').subscribe((line) => expect(line.sim).toBeNull());
    const request = http.expectOne(`${environment.apiUrl}/lineas-moviles/numero/%2B56%209%201111%202222`);
    expect(request.request.method).toBe('GET');
    request.flush({ success: true, data: { id: '8', numeroTelefonico: '56911112222', estado: 'ACTIVA', sim: null, dispositivo: null, colaborador: null, departamento: null } });
  });

  it('envia el cambio de numero de una SIM por el endpoint oficial de ficha', () => {
    service.actualizar(2014, { numeroAsociado: '56976708988' }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/sim/2014`);
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ numeroAsociado: '56976708988' });
    request.flush({ success: true, data: { codigoInventario: 2014, lineaMovil: { numeroTelefonico: '56976708988' } } });
  });

  it('envia el registro inline de SIM como una unica operacion compuesta', () => {
    devices.registrarSimNueva(1450, {
      iccidCodigoFabrica: '8956032262763686246',
      compania: 'Claro',
      accionLinea: 'USAR_LINEA_EXISTENTE',
      lineaMovilId: 8,
      observaciones: 'Alta inline'
    }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/dispositivos/1450/registrar-sim`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      iccidCodigoFabrica: '8956032262763686246',
      compania: 'Claro',
      accionLinea: 'USAR_LINEA_EXISTENTE',
      lineaMovilId: 8,
      observaciones: 'Alta inline'
    });
    request.flush({ success: true, data: { operacion: 'REGISTRAR_SIM_NUEVA' } });
  });
});
