import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  OffboardingProcessDetail,
  OffboardingProcessSummary,
  OffboardingSearchResult,
} from '../../core/models/offboarding.models';
import { OffboardingPage } from './offboarding-page';

const collaborator = (id: string, nombre: string) => ({
  id,
  rut: `${id}.111.111-1`,
  nombre,
  cargo: 'Administrativo',
  departamento: { id: '1', nombre: 'TI' },
  localidad: 'Santiago',
  activo: true,
  observaciones: null,
  creadoEn: '2026-08-28T10:00:00.000Z',
  actualizadoEn: '2026-08-28T10:00:00.000Z',
});

const summary = (id: string, nombre: string): OffboardingProcessSummary => ({
  id,
  colaborador: collaborator(id, nombre),
  fechaInicio: '2026-08-28T10:00:00.000Z',
  estado: 'ABIERTO',
  usuarioInicio: { id: '1', nombre: 'Responsable TI', email: 'ti@example.test' },
  observaciones: null,
  fechaCierre: null,
  usuarioCierre: null,
  creadoEn: '2026-08-28T10:00:00.000Z',
  actualizadoEn: '2026-08-28T10:00:00.000Z',
  equiposPendientes: 1,
  valorPendiente: 500000,
  valorRecuperado: 0,
  valorTotal: 500000,
});

const detail = (process: OffboardingProcessSummary): OffboardingProcessDetail => ({
  ...process,
  activosPendientes: [
    {
      id: '10',
      codigoInventario: 1001,
      tipo: { id: '1', nombre: 'Notebook' },
      marca: 'Dell',
      modelo: 'Latitude',
      numeroSerie: 'SERIE-1',
      imei: null,
      valorComercial: 500000,
      estado: { id: '1', codigo: 'ASIGNADO', nombre: 'Asignado' },
    },
  ],
});

describe('Offboarding MOD-01', () => {
  let fixture: ComponentFixture<OffboardingPage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OffboardingPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixture = TestBed.createComponent(OffboardingPage);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const start = (processes: OffboardingProcessSummary[] = []) => {
    fixture.detectChanges();
    http.expectOne((request) => request.url.endsWith('/offboarding')).flush({
      success: true,
      count: processes.length,
      data: processes,
    });
    fixture.detectChanges();
  };

  const search = (query: string, results: OffboardingSearchResult[]) => {
    const input = fixture.nativeElement.querySelector('#offboarding-search') as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('.employee-search button').click();
    fixture.detectChanges();
    const request = http.expectOne((item) => item.url.endsWith('/offboarding/buscar'));
    expect(request.request.params.get('q')).toBe(query);
    request.flush({ success: true, count: results.length, data: results });
    fixture.detectChanges();
  };

  it('muestra cero y el mensaje correcto cuando no hay procesos abiertos', () => {
    start();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Personas en proceso de salida');
    expect(text).toContain('No hay procesos de salida pendientes.');
    expect(fixture.nativeElement.querySelectorAll('.summary-values strong')[0].textContent.trim()).toBe('0');
  });

  it('ubica el resultado inmediatamente bajo el buscador y permite iniciar', () => {
    start();
    search('Alexis Higuera', [
      {
        colaborador: collaborator('3', 'Alexis Higuera'),
        equiposAsignados: 1,
        valorAsignado: 200000,
        procesoAbiertoId: null,
      },
    ]);
    const hero = fixture.nativeElement.querySelector('.offboarding-hero');
    const results = fixture.nativeElement.querySelector('.search-results');
    const panorama = fixture.nativeElement.querySelector('.global-summary');
    expect(hero.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(results.compareDocumentPosition(panorama) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(results.textContent).toContain('Iniciar proceso');
    expect(results.textContent).not.toContain('Pendiente');
  });

  it('inicia explícitamente sin ejecutar operaciones sobre dispositivos', () => {
    start();
    const result: OffboardingSearchResult = {
      colaborador: collaborator('3', 'Alexis Higuera'),
      equiposAsignados: 1,
      valorAsignado: 200000,
      procesoAbiertoId: null,
    };
    search('Alexis Higuera', [result]);
    fixture.nativeElement.querySelector('.employee-card .btn--primary').click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.confirmation-dialog button[type="submit"]').click();
    const post = http.expectOne((request) => request.url.endsWith('/offboarding') && request.method === 'POST');
    expect(post.request.body).toMatchObject({ colaboradorId: 3 });
    const process = summary('20', 'Alexis Higuera');
    post.flush({ success: true, data: detail(process) });
    http.expectOne((request) => request.url.endsWith('/offboarding') && request.method === 'GET').flush({ success: true, count: 1, data: [process] });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.employee-result .process-detail')).toBeTruthy();
    expect(http.match((request) => request.url.includes('/dispositivos')).length).toBe(0);
  });

  it('continuar abre el detalle dentro de la misma tarjeta de búsqueda', () => {
    start();
    const process = summary('20', 'Persona Uno');
    search('Persona Uno', [
      {
        colaborador: process.colaborador,
        equiposAsignados: 1,
        valorAsignado: 500000,
        procesoAbiertoId: process.id,
      },
    ]);
    fixture.nativeElement.querySelector('.employee-card button').click();
    http.expectOne((request) => request.url.endsWith('/offboarding/20')).flush({ success: true, data: detail(process) });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.employee-result .process-detail')).toBeTruthy();
  });

  it('gestionar usa acordeón inline, cierra el anterior y permite contraer', () => {
    const first = summary('20', 'Persona Uno');
    const second = summary('21', 'Persona Dos');
    start([first, second]);
    const buttons = fixture.nativeElement.querySelectorAll('.desktop-table tbody > tr:not(.detail-row) button');
    buttons[0].click();
    http.expectOne((request) => request.url.endsWith('/offboarding/20')).flush({ success: true, data: detail(first) });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.detail-row')).toHaveLength(1);

    fixture.nativeElement.querySelectorAll('.desktop-table tbody > tr:not(.detail-row) button')[1].click();
    http.expectOne((request) => request.url.endsWith('/offboarding/21')).flush({ success: true, data: detail(second) });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.detail-row')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.detail-row').textContent).toContain('Persona Dos');

    fixture.nativeElement.querySelectorAll('.desktop-table tbody > tr:not(.detail-row) button')[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.detail-row')).toHaveLength(0);
  });

  it('móvil inserta el detalle dentro de la tarjeta seleccionada', () => {
    const process = summary('20', 'Persona Móvil');
    start([process]);
    fixture.nativeElement.querySelector('.mobile-process-card button').click();
    http.expectOne((request) => request.url.endsWith('/offboarding/20')).flush({ success: true, data: detail(process) });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mobile-process-card .process-detail')).toBeTruthy();
  });
});
