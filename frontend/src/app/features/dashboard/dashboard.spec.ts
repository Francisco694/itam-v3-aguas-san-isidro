import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ActasEntregaService } from '../../core/services/actas-entrega.service';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { HealthService } from '../../core/services/health.service';
import { OffboardingService } from '../../core/services/offboarding.service';
import { ServicioTecnicoService } from '../../core/services/servicio-tecnico.service';
import { SimService } from '../../core/services/sim.service';
import type { OffboardingProcessSummary } from '../../core/models/offboarding.models';
import { Dashboard } from './dashboard';

const operationalSummary = {
  inventarioOperacional: { cantidad: 10, valor: 1_000_000 },
  disponibles: { cantidad: 2, valor: 200_000 },
  asignados: { cantidad: 7, valor: 700_000 },
  servicioTecnico: { cantidad: 1, valor: 100_000 },
  extraviados: { cantidad: 3, valor: 300_000 },
  bajas: { cantidad: 4, valor: 400_000 },
};

const process = (
  id: string,
  equiposPendientes: number,
  valorPendiente: number,
): OffboardingProcessSummary => ({
  id,
  colaborador: {
    id,
    rut: '11.111.111-1',
    nombre: `Persona ${id}`,
    cargo: null,
    departamento: null,
    localidad: null,
    activo: true,
    observaciones: null,
    creadoEn: '2026-08-29T10:00:00.000Z',
    actualizadoEn: '2026-08-29T10:00:00.000Z',
  },
  fechaInicio: '2026-08-29T10:00:00.000Z',
  estado: 'ABIERTO',
  usuarioInicio: { id: '1', nombre: 'Responsable TI', email: 'ti@example.test' },
  observaciones: null,
  fechaCierre: null,
  usuarioCierre: null,
  creadoEn: '2026-08-29T10:00:00.000Z',
  actualizadoEn: '2026-08-29T10:00:00.000Z',
  equiposPendientes,
  valorPendiente,
  valorRecuperado: 0,
  valorTotal: valorPendiente,
});

describe('Dashboard QA-10 y QA-15', () => {
  let fixture: ComponentFixture<Dashboard>;
  let offboardingProcesses: OffboardingProcessSummary[];

  beforeEach(async () => {
    offboardingProcesses = [];
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        {
          provide: DispositivosService,
          useValue: {
            listar: () => of([]),
            resumenGerencial: () => of(operationalSummary),
          },
        },
        { provide: SimService, useValue: { listar: () => of([]) } },
        { provide: ColaboradoresService, useValue: { listar: () => of([]) } },
        { provide: DepartamentosService, useValue: { listar: () => of([]) } },
        {
          provide: HealthService,
          useValue: {
            health: () => of({ status: 'ok' }),
            database: () => of({ status: 'ok' }),
          },
        },
        { provide: ServicioTecnicoService, useValue: { listar: () => of([]) } },
        { provide: ActasEntregaService, useValue: { listar: () => of([]) } },
        {
          provide: OffboardingService,
          useValue: { listarAbiertos: () => of(offboardingProcesses) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Dashboard);
  });

  it('muestra cantidad y valor del inventario operacional entregado por backend', () => {
    fixture.detectChanges();
    const firstMetric = fixture.nativeElement.querySelector('.metric-grid .metric');
    expect(firstMetric.textContent).toContain('Inventario');
    expect(firstMetric.querySelector('.metric__value').textContent.trim()).toBe('10');
    expect(firstMetric.textContent).toContain('Valor operacional');
    expect(firstMetric.textContent).toContain('$1.000.000');
    expect(fixture.nativeElement.textContent).toContain('Valor del inventario operacional');
  });

  it('muestra cero real cuando no existen procesos de Offboarding abiertos', () => {
    fixture.detectChanges();
    const card = [...fixture.nativeElement.querySelectorAll('.operational-link')].find(
      (element: HTMLElement) => element.textContent?.includes('Offboarding'),
    ) as HTMLElement;
    expect(card.textContent).toContain('Sin procesos pendientes');
    expect(card.textContent).toContain('0 equipos por recuperar \u00b7 $0');
  });

  it('resume exclusivamente procesos de Offboarding abiertos recibidos desde MOD-01', () => {
    offboardingProcesses = [process('1', 2, 300_000), process('2', 1, 480_000)];
    fixture.detectChanges();
    const card = [...fixture.nativeElement.querySelectorAll('.operational-link')].find(
      (element: HTMLElement) => element.textContent?.includes('Offboarding'),
    ) as HTMLElement;
    expect(card.textContent).toContain('2 personas en proceso');
    expect(card.textContent).toContain('3 equipos por recuperar');
    expect(card.textContent).toContain('$780.000');
    expect(card.getAttribute('href')).toBe('/offboarding');
  });
});
