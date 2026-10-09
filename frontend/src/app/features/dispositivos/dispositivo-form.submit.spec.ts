import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ApiError } from '../../core/models/api.models';
import type { Dispositivo, TipoDispositivo, ValidacionIdentificadorDispositivo } from '../../core/models/itam.models';
import { AuthService } from '../../core/services/auth.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { FacturasAdquisicionService } from '../../core/services/facturas-adquisicion.service';
import { TiposDispositivoService } from '../../core/services/tipos-dispositivo.service';
import { DispositivoForm } from './dispositivo-form';

const notebook: TipoDispositivo = {
  id: '1', nombre: 'Notebook', descripcion: null, activo: true, requiereImei: false,
  configuracionFormulario: { mostrarMarca: true, mostrarModelo: true, mostrarNumeroSerie: true, camposEspecificos: [] },
  familiaCodigoInventario: { id: '1', nombre: 'Notebook', prefijo: '1', activo: true, estrategiaCodigo: 'REPEAT_PREFIX', agrupaTipos: false, etiquetaOperativa: null },
  creadoEn: '', actualizadoEn: ''
};

const createdDevice = {
  id: 'device-1', codigoInventario: 1119, tipo: { id: '1', nombre: 'Notebook' }, marca: 'Asus', modelo: 'Vivobook Go 15',
  numeroSerie: 'W6N0CV08C97524', imei: null, estado: { id: 1, codigo: 'DISPONIBLE', nombre: 'Disponible' },
  origenRegistro: 'MANUAL', facturaAdquisicion: null
} as unknown as Dispositivo;

describe('alta de dispositivo: submit y operaciones posteriores', () => {
  let fixture: any;
  let component: any;
  let deviceApi: any;
  let invoiceApi: any;

  beforeEach(async () => {
    deviceApi = { crear: vi.fn(), actualizar: vi.fn(), validarIdentificadorDispositivo: vi.fn(() => of({ disponible: true })) };
    invoiceApi = { crear: vi.fn(), actualizar: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [DispositivoForm],
      providers: [
        provideHttpClient(), provideRouter([]),
        { provide: AuthService, useValue: { user: () => ({ nombre: 'Responsable TI' }) } },
        { provide: DispositivosService, useValue: deviceApi },
        { provide: FacturasAdquisicionService, useValue: invoiceApi },
        { provide: TiposDispositivoService, useValue: { listar: vi.fn(() => of([notebook])) } }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(DispositivoForm);
    component = fixture.componentInstance;
    component.types.set([notebook]);
    component.form.patchValue({
      tipoPrincipal: '1', tipoDispositivoId: '1', marca: 'Asus', modelo: 'Vivobook Go 15',
      numeroSerie: 'W6N0CV08C97524', valorComercial: 579991, responsable: 'Responsable TI'
    });
  });

  it('ignora un segundo submit mientras la creación está en curso', () => {
    const response = new Subject<Dispositivo>();
    deviceApi.crear.mockReturnValue(response.asObservable());

    component.submit();
    component.submit();

    expect(deviceApi.crear).toHaveBeenCalledOnce();
    response.next(createdDevice);
    response.complete();
  });

  it('no convierte un conflicto posterior de factura en duplicado de serie', () => {
    deviceApi.crear.mockReturnValue(of(createdDevice));
    invoiceApi.crear.mockReturnValue(throwError(() => new ApiError('CONFLICT', 'La factura ya está registrada para ese proveedor.', 409)));
    component.form.patchValue({ numeroFactura: 'F-2026-001', proveedorFactura: 'Asus' });

    component.submit();

    expect(deviceApi.crear).toHaveBeenCalledOnce();
    expect(invoiceApi.crear).toHaveBeenCalledOnce();
    expect(component.partialCreation().device.codigoInventario).toBe(1119);
    expect(component.apiError()).toBe('');
    expect(component.partialCreation().message).toContain('factura');
  });

  it('considera exitoso validar disponible + dispositivo 201 + factura 201 y limpia errores', async () => {
    vi.useFakeTimers();
    try {
      deviceApi.validarIdentificadorDispositivo.mockReturnValue(of({ disponible: true }));
      deviceApi.crear.mockReturnValue(of(createdDevice));
      invoiceApi.crear.mockReturnValue(of({}));
      component.ngOnInit();
      component.form.patchValue({ numeroSerie: 'W6N0CV08C97524' });
      await vi.advanceTimersByTimeAsync(401);

      component.form.patchValue({ numeroFactura: 'F-2026-001', proveedorFactura: 'Asus' });
      component.submit();

      expect(component.identifierState('serie').status).toBe('available');
      expect(deviceApi.crear).toHaveBeenCalledOnce();
      expect(invoiceApi.crear).toHaveBeenCalledOnce();
      expect(component.created()).toBe(createdDevice);
      expect(component.apiError()).toBe('');
      expect(component.identifierState('serie').status).not.toBe('duplicate');

      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
      component.finish(createdDevice);
      expect(navigate).toHaveBeenCalledWith(['/dispositivos', 1119]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('bloquea el alta cuando validar-identificador informa disponible=false', async () => {
    vi.useFakeTimers();
    try {
      const duplicate: ValidacionIdentificadorDispositivo = { disponible: false, codigoInventario: 1001, tipoDispositivo: 'Notebook', marca: 'Dell', modelo: 'Latitude' };
      deviceApi.validarIdentificadorDispositivo.mockReturnValue(of(duplicate));
      component.ngOnInit();
      component.form.patchValue({ numeroSerie: 'SERIE-DUPLICADA' });
      await vi.advanceTimersByTimeAsync(401);

      expect(component.identifierState('serie').status).toBe('duplicate');
      expect(component.saveDisabled()).toBe(true);
      component.submit();
      expect(deviceApi.crear).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reemplaza un estado duplicado por disponible cuando cambia la serie', async () => {
    vi.useFakeTimers();
    try {
      const duplicateResponse = new Subject<ValidacionIdentificadorDispositivo>();
      const availableResponse = new Subject<ValidacionIdentificadorDispositivo>();
      deviceApi.validarIdentificadorDispositivo
        .mockReturnValueOnce(duplicateResponse.asObservable())
        .mockReturnValueOnce(availableResponse.asObservable());
      component.ngOnInit();

      component.form.patchValue({ numeroSerie: 'SERIE-DUPLICADA' });
      await vi.advanceTimersByTimeAsync(401);
      duplicateResponse.next({ disponible: false, codigoInventario: 1001 });
      expect(component.identifierState('serie').status).toBe('duplicate');

      component.form.patchValue({ numeroSerie: 'SERIE-DISPONIBLE' });
      await vi.advanceTimersByTimeAsync(401);
      availableResponse.next({ disponible: true });

      expect(component.identifierState('serie').status).toBe('available');
      expect(component.identifierState('serie').status).not.toBe('duplicate');
      expect(component.apiError()).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });
});
