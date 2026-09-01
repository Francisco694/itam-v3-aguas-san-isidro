import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Colaborador, InventarioColaborador } from '../../core/models/itam.models';
import { ColaboradorDetail } from './colaborador-detail';

const person: Colaborador = {
  id: '1', rut: '127926786', nombre: 'Claudia Fuentes Alegría', cargo: null,
  departamento: null, localidad: null, activo: true, observaciones: null,
  creadoEn: '2026-01-01T00:00:00Z', actualizadoEn: '2026-01-01T00:00:00Z',
};
const inventory: InventarioColaborador = {
  colaborador: person,
  valorTotalCustodia: 100000,
  equiposActuales: [{
    id: '10', codigoInventario: 1001, tipo: 'Smartphone', marca: 'Samsung', modelo: 'A14',
    numeroSerie: null, imei: null, valorComercial: 100000,
    estado: { codigo: 'ASIGNADO', nombre: 'Asignado' },
  }],
  historialEquipos: [{
    id: '11', codigoInventario: 1002, tipo: 'Smartphone', marca: 'Motorola', modelo: 'G30',
    numeroSerie: null, imei: '490154203237518', valorComercial: 80000,
    estado: { codigo: 'PENDIENTE_VALIDACION', nombre: 'Pendiente de validación' },
    fechaAsignacion: '2021-01-01T00:00:00Z', fechaDevolucion: null,
    tipoCierre: 'CONCILIACION_HISTORICA', resultado: 'CONCILIADO',
  }],
  registrosHistoricosPendientes: [{
    id: '12', tipoActivo: 'SMARTPHONE', descripcion: 'Samsung A14', imei: '0', numeroSerie: null,
    fechaEntrega: '2025-04-14', estadoConciliacion: 'PENDIENTE_IDENTIFICAR_ACTIVO',
    motivo: 'IMEI vacío, cero o inválido.', nivelConfianza: 'BAJA',
    fuente: { archivo: 'histórico.xlsx', hoja: 'Inventario SQL', fila: 10 },
  }],
};

describe('Ficha de colaborador reconstruida', () => {
  let fixture: ComponentFixture<ColaboradorDetail>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColaboradorDetail],
      providers: [
        provideRouter([]), provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '1' }) } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ColaboradorDetail);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('separa actuales, historial y pendientes y no muestra Sin serie para smartphone', () => {
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/colaboradores/1')).flush({ success: true, data: person });
    http.expectOne((request) => request.url.endsWith('/colaboradores/1/inventario')).flush({ success: true, data: inventory });
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Equipos actuales');
    expect(text).toContain('Historial de equipos');
    expect(text).toContain('Registros históricos pendientes');
    expect(text).toContain('Sin IMEI registrado');
    expect(text).not.toContain('Sin serie');
  });
});