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
import type { Dispositivo } from '../../core/models/itam.models';
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
  let devices: Dispositivo[];

  beforeEach(async () => {
    offboardingProcesses = [];
    const device = (id: string, state: string, value: number): Dispositivo => ({
      id,
      codigoInventario: Number(id),
      tipo: { id: '1', nombre: 'Notebook' },
      estado: { id: state, codigo: state, nombre: state },
      valorComercial: value,
      colaborador: null,
      departamento: null,
    } as unknown as Dispositivo);
    devices = [
      device('1', 'ASIGNADO', 100_000),
      device('2', 'DISPONIBLE', 200_000),
      device('3', 'EXTRAVIADO', 300_000),
      device('4', 'DADO_BAJA', 400_000),
      device('5', 'EN_REVISION', 50_000),
    ];
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        {
          provide: DispositivosService,
          useValue: {
            listar: () => of(devices),
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

  it('separa inventario operacional real del total histórico registrado', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.metric-grid .metric');
    expect(cards[0].textContent).toContain('Inventario operacional real');
    expect(cards[0].querySelector('.metric__value').textContent.trim()).toBe('3');
    expect(cards[0].textContent).toContain('Equipos disponibles o en uso actualmente');
    expect(cards[1].textContent).toContain('Inventario registrado histórico');
    expect(cards[1].querySelector('.metric__value').textContent.trim()).toBe('5');
    expect(Number(cards[0].querySelector('.metric__value').textContent.trim())
      + Number(cards[4].querySelector('.metric__value').textContent.trim())
      + Number(cards[5].querySelector('.metric__value').textContent.trim())).toBe(5);
    expect(fixture.nativeElement.querySelector('.financial-card')).toBeNull();
  });

  it('presenta el total por tipo como equipos registrados y no como activos vigentes', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Inventario registrado por tipo');
    expect(text).toContain('5 equipos registrados');
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
