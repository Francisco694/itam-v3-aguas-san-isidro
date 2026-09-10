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
import { StockAlertsService } from '../../core/services/stock-alerts.service';
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
  let stockAlerts: any[];

  beforeEach(async () => {
    offboardingProcesses = [];
    stockAlerts = [];
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
      device('6', 'SERVICIO_TECNICO', 80_000),
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
        {
          provide: StockAlertsService,
          useValue: { listar: () => of(stockAlerts) },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(Dashboard);
  });

  it('muestra como inventario actual solo los estados operativos permitidos', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    const firstMetric = fixture.nativeElement.querySelector('.metric-grid .metric');
    expect(firstMetric.textContent).toContain('Inventario actual');
    expect(firstMetric.querySelector('.metric__value').textContent.trim()).toBe('3');
    expect(firstMetric.textContent).toContain('Equipos disponibles o en uso actualmente');
    expect(text).toContain('Histórico registrado');
    expect(text).toContain('Total de registros en ITAM, incluyendo bajas y extravíos');
    expect(text).not.toContain('Valor de equipos activos');
  });

  it('distribuye por tipo exactamente la misma cantidad del inventario actual', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Histórico registrado por tipo');
    expect(text).toContain('6 registros históricos');
    expect(text).toContain('Incluye equipos actuales, extraviados, dados de baja y registros antiguos.');
    expect(text).not.toContain('Registros disponibles');
  });

  it('separa la distribución activa real de la distribución histórica', () => {
    fixture.detectChanges();
    const cards = fixture.nativeElement.querySelectorAll('.type-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].textContent).toContain('Inventario activo real por tipo');
    expect(cards[0].textContent).toContain('3 equipos activos reales');
    expect(cards[0].textContent).toContain('3 activos reales');
    expect(cards[0].textContent).not.toContain('EXTRAVIADO');
    expect(cards[0].textContent).not.toContain('DADO_BAJA');
    expect(cards[1].textContent).toContain('Histórico registrado por tipo');
    expect(cards[1].textContent).toContain('6 registros históricos');
  });

  it('separa servicio técnico y custodias por revisar cuando aplican', () => {
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Servicio técnico');
    expect(text).toContain('Revisar custodia');
    expect(text).toContain('Asignados sin responsable identificado');
    expect(fixture.nativeElement.querySelector('.financial-card')).toBeNull();
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

  it('no ocupa espacio cuando ningún tipo tiene una alerta real', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stock-replenishment')).toBeNull();
  });

  it('no muestra la sección si hay controles activos sobre el mínimo', () => {
    stockAlerts = [{
      tipoDispositivo: { id: '7', nombre: 'Notebook' }, disponibles: 4,
      minimoDisponible: 3, alertaActiva: true, enAlerta: false, mensaje: null
    }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.stock-replenishment')).toBeNull();
  });

  it('muestra alertas y enlaza al inventario disponible filtrado por tipo', () => {
    stockAlerts = [{
      tipoDispositivo: { id: '7', nombre: 'Notebook' }, disponibles: 3,
      minimoDisponible: 3, alertaActiva: true, enAlerta: true,
      mensaje: 'Quedan 3 Notebooks disponibles · mínimo configurado: 3'
    }];
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.stock-alert') as HTMLAnchorElement;
    expect(link.textContent).toContain('Notebook');
    expect(link.textContent).toContain('Quedan 3 Notebooks disponibles');
    expect(link.getAttribute('href')).toContain('/dispositivos?tipoDispositivoId=7&estado=DISPONIBLE');
  });
});
