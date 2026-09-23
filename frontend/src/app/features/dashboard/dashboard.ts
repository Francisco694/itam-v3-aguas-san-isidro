import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  LucideBuilding,
  LucideCardSim,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideChartNoAxesCombined,
  LucideChevronDown,
  LucideChevronUp,
  LucideComputer,
  LucideDynamicIcon,
  LucideFileText,
  LucideKeyboard,
  LucideLaptop,
  LucideMonitor,
  LucideMouse,
  LucidePackage,
  LucidePackageOpen,
  LucidePrinter,
  LucideSmartphone,
  LucideUserMinus,
  LucideUsers,
  LucideWalletCards,
  LucideWrench,
  type LucideIconInput,
} from '@lucide/angular';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { ActasEntregaService } from '../../core/services/actas-entrega.service';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { HealthService } from '../../core/services/health.service';
import { OffboardingService } from '../../core/services/offboarding.service';
import { ServicioTecnicoService } from '../../core/services/servicio-tecnico.service';
import { SimService } from '../../core/services/sim.service';
import { StockAlertsService } from '../../core/services/stock-alerts.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { formatClp } from '../../shared/utils/currency';
import { errorMessage } from '../../shared/utils/error-message';
import type { Dispositivo } from '../../core/models/itam.models';
import type { StockAlertConfiguration } from '../../core/models/itam.models';

const CURRENT_OPERATIONAL_STATE_CODES = new Set([
  'ASIGNADO',
  'DISPONIBLE',
  'EN_BODEGA',
  'PRESTAMO_TEMPORAL',
  'RETENIDO_REVISION',
  'SERVICIO_TECNICO',
  'EN_SERVICIO_TECNICO',
]);

const firstNonEmptyArray = <T>(...candidates: Array<readonly T[] | null | undefined>): readonly T[] =>
  candidates.find((candidate) => Array.isArray(candidate) && candidate.length > 0) ?? [];

const iconForDeviceType = (label: string): LucideIconInput => {
  const normalized = label.toLocaleLowerCase('es');
  if (normalized.includes('smartphone')) return LucideSmartphone;
  if (normalized.includes('notebook') || normalized.includes('laptop')) return LucideLaptop;
  if (normalized.includes('monitor')) return LucideMonitor;
  if (normalized.includes('teclado')) return LucideKeyboard;
  if (normalized.includes('mouse')) return LucideMouse;
  if (normalized.includes('impresora')) return LucidePrinter;
  if (normalized === 'pc' || normalized.includes('computador')) return LucideComputer;
  return LucidePackage;
};

export const dashboardInventoryScope = (devices: readonly Dispositivo[]) => {
  const stateCode = (device: Dispositivo): string => device.estado?.codigo ?? '';
  const operational = devices.filter((device) => CURRENT_OPERATIONAL_STATE_CODES.has(stateCode(device)));
  const lost = devices.filter((device) => stateCode(device) === 'EXTRAVIADO');
  const retired = devices.filter((device) => stateCode(device) === 'DADO_BAJA');
  const available = operational.filter((device) => stateCode(device) === 'DISPONIBLE');
  const assigned = operational.filter((device) => stateCode(device) === 'ASIGNADO');
  const technicalService = operational.filter((device) =>
    ['SERVICIO_TECNICO', 'EN_SERVICIO_TECNICO'].includes(stateCode(device))
  );
  const assignedWithoutResponsible = assigned.filter((device) =>
    !device.colaborador && !device.departamento
  );
  return {
    operational,
    lost,
    retired,
    available,
    assigned,
    technicalService,
    assignedWithoutResponsible,
    historicalTotal: devices.length,
    operationalValue: operational.reduce((total, device) => total + device.valorComercial, 0),
    historicalValue: devices.reduce((total, device) => total + device.valorComercial, 0),
  };
};

interface Metric {
  label: string;
  value: number | string;
  meta: string;
  details?: string[];
  tone: string;
  icon: LucideIconInput;
  state?: string;
}
interface TypeSummary {
  label: string;
  count: number;
  percentage: number;
  value?: number;
  icon?: LucideIconInput;
}
interface VerifiedTypeSummary extends TypeSummary {
  valuePercentage: number;
}
interface OperationalMetric {
  title: string;
  value: string;
  meta: string;
  route: string;
  tone: string;
  icon: LucideIconInput;
}

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    PageHeader,
    ViewState,
    LucideDynamicIcon,
    LucideCircleCheck,
    LucideCircleAlert,
  ],
  template: `
    <app-page-header
      class="dashboard-page-header"
      title="Dashboard Gerencial"
      subtitle="Resumen del inventario tecnológico de Aguas San Isidro."
      eyebrow="Control patrimonial y operativo"
    />
    @if (loading()) {
      <section class="card">
        <app-view-state
          kind="loading"
          title="Consultando inventario"
          message="Consolidando indicadores desde la API…"
        />
      </section>
    } @else if (error()) {
      <section class="card">
        <app-view-state
          kind="error"
          title="No pudimos cargar el dashboard"
          [message]="error()"
          (retry)="load()"
        />
      </section>
    } @else {
      <section class="metric-section metric-section--primary" aria-labelledby="primary-metrics-title">
        <div class="metric-section__heading">
          <div>
            <span>INDICADORES GERENCIALES</span>
            <h2 id="primary-metrics-title">Visión general del inventario</h2>
          </div>
          <p>Los tres indicadores principales para la toma de decisiones.</p>
        </div>
        <div class="metric-grid metric-grid--primary" aria-label="Indicadores gerenciales principales">
          @for (metric of metrics().slice(0, 3); track metric.label) {
            <a
              class="card metric"
              [class]="'card metric metric--' + metric.tone + ' metric--primary'"
              routerLink="/dispositivos"
              [queryParams]="metric.state ? { estado: metric.state } : {}"
            >
              <div class="metric__head">
                <span class="metric__label">{{ metric.label }}</span>
                <span class="metric__icon"><svg [lucideIcon]="metric.icon"></svg></span>
              </div>
              <strong class="metric__value">{{ metric.value }}</strong>
              <p class="metric__meta">{{ metric.meta }}</p>
              @for (detail of metric.details ?? []; track detail) {
                <p class="metric__detail">{{ detail }}</p>
              }
            </a>
          }
        </div>
      </section>
      <section class="metric-section metric-section--operational" aria-labelledby="operational-metrics-title">
        <div class="metric-section__heading">
          <div>
            <span>ESTADO OPERACIONAL</span>
            <h2 id="operational-metrics-title">Seguimiento del inventario</h2>
          </div>
          <p>Situaciones que requieren control o seguimiento diario.</p>
        </div>
        <div class="metric-grid metric-grid--operational" aria-label="Indicadores operativos">
          @for (metric of metrics().slice(3); track metric.label) {
            <a
              class="card metric"
              [class]="'card metric metric--' + metric.tone + ' metric--secondary'"
              routerLink="/dispositivos"
              [queryParams]="metric.state ? { estado: metric.state } : {}"
            >
              <div class="metric__head">
                <span class="metric__label">{{ metric.label }}</span>
                <span class="metric__icon"><svg [lucideIcon]="metric.icon"></svg></span>
              </div>
              <strong class="metric__value">{{ metric.value }}</strong>
              <p class="metric__meta">{{ metric.meta }}</p>
              @for (detail of metric.details ?? []; track detail) {
                <p class="metric__detail">{{ detail }}</p>
              }
            </a>
          }
        </div>
      </section>
      <aside class="historical-summary" aria-label="Histórico registrado">
        <div><span>Histórico registrado</span><strong>{{ historicalDevices() }}</strong></div>
        <p>Total de registros en ITAM, incluyendo bajas y extravíos.</p>
      </aside>
      @if (activeStockAlerts().length) {<section class="stock-replenishment" aria-labelledby="stock-alerts-title">
        <div class="section-heading">
          <div><span>CONTROL DE EXISTENCIAS</span><h2 id="stock-alerts-title">Alertas de reposición</h2></div>
          <a routerLink="/alertas-stock">Configurar alertas</a>
        </div>
          <div class="stock-alert-grid">
            @for (alert of activeStockAlerts(); track alert.tipoDispositivo.id) {
              <a class="card stock-alert" routerLink="/dispositivos" [queryParams]="{tipoDispositivoId: alert.tipoDispositivo.id, estado: 'DISPONIBLE'}">
                <svg lucideCircleAlert></svg><div><strong>{{alert.tipoDispositivo.nombre}}</strong><span>{{alert.mensaje}}</span></div><b aria-hidden="true">→</b>
              </a>
            }
          </div>
      </section>}
      <section class="operational-section" aria-labelledby="operational-title">
        <div class="section-heading">
          <div>
            <span>ACCESOS DIRECTOS</span>
            <h2 id="operational-title">Gestión Operacional</h2>
          </div>
          <p>Procesos que requieren seguimiento y trazabilidad diaria.</p>
        </div>
        <div class="operational-grid">
          @for (item of operationalMetrics(); track item.title) {
            <a
              class="card operational-link"
              [class]="'card operational-link operational-link--' + item.tone"
              [routerLink]="item.route"
            >
              <span class="operational-link__icon"><svg [lucideIcon]="item.icon"></svg></span>
              <div>
                <span>{{ item.title }}</span>
                <strong>{{ item.value }}</strong>
                <p>{{ item.meta }}</p>
              </div>
              <b aria-hidden="true">→</b>
            </a>
          }
        </div>
      </section>
      <section class="dashboard-grid">
        <article class="card type-card active-type-card">
          <div class="card-heading">
            <div>
              <span>INVENTARIO VIGENTE</span>
              <h2>Inventario activo real</h2>
            </div>
            <strong>{{ totalDevices() }} equipos activos reales</strong>
          </div>
          <p class="historical-subtitle">
            Incluye solo equipos actualmente vigentes en la empresa.
          </p>
          @if (!activeTypeSummary().length) {
            <app-view-state
              kind="empty"
              title="Sin dispositivos activos"
              message="No hay equipos vigentes para mostrar por tipo."
            />
          } @else {
            <div class="type-bars">
              @for (type of activeTypeSummary(); track type.label) {
                <div class="type-row">
                  <div>
                    <strong>{{ type.label }}</strong
                    ><span>{{ type.count }} {{ type.count === 1 ? 'activo real' : 'activos reales' }}@if (type.value !== undefined) { · {{ formatClp(type.value) }}}</span>
                  </div>
                  <div
                    class="bar"
                    role="progressbar"
                    [attr.aria-valuenow]="type.percentage"
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    <span [style.width.%]="type.percentage"></span>
                  </div>
                  <b>{{ type.percentage }}%</b>
                </div>
              }
            </div>
          }
        </article>
        <article class="card type-card verified-card">
          <div class="card-heading">
            <div>
              <span>CONTROL FÍSICO</span>
          <h2>Desglose por tipo de activo verificado</h2>
            </div>
            <strong>{{ verifiedDevices() }} equipos verificados</strong>
          </div>
          <p class="historical-subtitle">
            Distribución de equipos verificados según cantidad y valor económico.
          </p>
          <div class="verification-summary">
            <div><span>Equipos verificados</span><strong>{{ verifiedDevices() }}</strong></div>
            <div><span>Porcentaje verificado</span><strong>{{ verifiedPercentage() }}%</strong></div>
            <div><span>Valor de equipos verificados</span><strong>{{ formatClp(verifiedValue()) }}</strong></div>
            <div><span>Equipos pendientes de verificar</span><strong>{{ pendingVerification() }}</strong></div>
          </div>
          @if (verificadosPorTipoRender().length > 0) {
            <div class="verified-table">
              <div class="verified-table__header">
                <span>Tipo de activo</span>
                <span>Participación en equipos</span>
                <span>Participación en valor</span>
              </div>
              @for (type of verificadosPorTipoRender(); track type.label) {
                <div class="verified-table__row">
                  <div class="verified-type__identity">
                    <div>
                      <strong>{{ type.label }}</strong>
                      <span>{{ type.count }} equipos verificados · {{ formatClp(type.value ?? 0) }}</span>
                    </div>
                  </div>
                  <div class="verified-share">
                    <div
                      class="bar"
                      role="progressbar"
                      [attr.aria-valuenow]="type.percentage"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      [attr.aria-label]="type.percentage + '% del total de equipos'"
                    >
                      <span [style.width.%]="type.percentage"></span>
                    </div>
                    <b>{{ type.percentage }}%</b>
                  </div>
                  <div class="verified-share">
                    <div
                      class="bar bar--value"
                      role="progressbar"
                      [attr.aria-valuenow]="type.valuePercentage"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      [attr.aria-label]="type.valuePercentage + '% del valor total'"
                    >
                      <span [style.width.%]="type.valuePercentage"></span>
                    </div>
                    <b>{{ type.valuePercentage }}%</b>
                  </div>
                </div>
              }
            </div>
          } @else {
            <app-view-state
              kind="empty"
              title="Sin equipos verificados"
              message="Aún no hay equipos activos con verificación física positiva."
            />
          }
        </article>
        <article class="card type-card historical-card">
          <div class="card-heading historical-card__heading">
            <div>
              <span>HISTÓRICO REGISTRADO</span>
              <h2>Equipos registrados por tipo</h2>
            </div>
            <div class="historical-card__actions">
              <strong>{{ historicalDevices() }} registros históricos</strong>
              <button
                class="btn btn--secondary btn--small"
                type="button"
                [attr.aria-expanded]="historicalInvestmentOpen()"
                (click)="toggleHistoricalInvestment()"
              >
                <svg [lucideIcon]="historicalInvestmentOpen() ? chevronUpIcon : chevronDownIcon"></svg>
                {{ historicalInvestmentOpen() ? 'Ocultar inversión' : 'Ver inversión histórica' }}
              </button>
            </div>
          </div>
          <p class="historical-subtitle">
            Incluye todos los equipos registrados en ITAM: actuales, extraviados, dados de baja y antiguos.
          </p>
          <div class="historical-overview">
            <div><span>Registros históricos</span><strong>{{ historicalDevices() }}</strong></div>
            <div><span>Tipos registrados</span><strong>{{ historicoPorTipoRender().length }}</strong></div>
          </div>
          @if (historicalInvestmentOpen()) {
            <section class="historical-investment" aria-label="Inversión histórica registrada">
              <div class="historical-investment__header">
                <div>
                  <span class="historical-investment__eyebrow">INFORMACIÓN ECONÓMICA</span>
                  <h3>Inversión histórica registrada</h3>
                </div>
                <strong>{{ formatClp(historicalValueTotal()) }}</strong>
              </div>
              <p class="historical-investment__note">
                Valor acumulado registrado en ITAM. No representa necesariamente gasto contable oficial.
              </p>
            </section>
          }
          @if (historicoPorTipoRender().length > 0) {
            <div
              class="historical-table"
              [class.historical-table--with-value]="historicalInvestmentOpen()"
            >
              <div class="historical-table__header">
                <span>Tipo de equipo</span>
                <span>Cantidad de equipos</span>
                <span>Participación en el histórico</span>
                @if (historicalInvestmentOpen()) {
                  <span>Inversión acumulada</span>
                }
              </div>
              @for (type of historicoPorTipoRender(); track type.label) {
                <div class="historical-type-row">
                  <div class="historical-type__name">
                    <strong>{{ type.label }}</strong>
                  </div>
                  <div class="historical-type__count">
                    {{ type.count }} {{ type.count === 1 ? 'equipo registrado' : 'equipos registrados' }}
                  </div>
                  <div class="historical-type__share">
                    <div
                      class="bar"
                      role="progressbar"
                      [attr.aria-valuenow]="type.percentage"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      [attr.aria-label]="formatHistoricalPercentage(type.percentage) + ' del histórico total'"
                    >
                      <span [style.width.%]="type.percentage"></span>
                    </div>
                    <b>{{ formatHistoricalPercentage(type.percentage) }}</b>
                  </div>
                  @if (historicalInvestmentOpen()) {
                    <div class="historical-type__value">
                      @if (type.value !== undefined) {
                        {{ formatClp(type.value) }}
                      } @else {
                        —
                      }
                    </div>
                  }
                </div>
              }
            </div>
          } @else {
            <app-view-state
              kind="empty"
              title="Sin dispositivos"
              message="Registra equipos para ver la distribución histórica por tipo."
            />
          }
        </article>
        <article class="card operational-card">
          <div class="card-heading">
            <div>
              <span>Panorama operativo</span>
              <h2>Recursos relacionados</h2>
            </div>
          </div>
          <div class="mini-stat">
            <span class="mini-icon"><svg [lucideIcon]="simIcon"></svg></span>
            <div>
              <strong>{{ totalSims() }}</strong
              ><span>Tarjetas SIM</span>
            </div>
          </div>
          <div class="mini-stat">
            <span class="mini-icon"><svg [lucideIcon]="usersIcon"></svg></span>
            <div>
              <strong>{{ activePeople() }}</strong
              ><span>Colaboradores activos</span>
            </div>
          </div>
          <div class="mini-stat">
            <span class="mini-icon"><svg [lucideIcon]="buildingIcon"></svg></span>
            <div>
              <strong>{{ activeDepartments() }}</strong
              ><span>Departamentos activos</span>
            </div>
          </div>
        </article>
      </section>
      <section class="card integration">
        <div>
          <span class="integration__icon"><svg lucideCircleCheck></svg></span>
          <div>
            <strong>Plataforma conectada</strong>
            <p>API ITAM y PostgreSQL responden correctamente.</p>
          </div>
        </div>
        <div class="service-pills">
          <span>API {{ apiStatus() }}</span
          ><span>PostgreSQL {{ databaseStatus() }}</span>
        </div>
      </section>
      <p class="scope-note">
        <svg lucideCircleAlert></svg
        ><span
          >Los últimos movimientos globales requieren un endpoint agregado para evitar consultar el
          historial de cada activo individualmente.</span
        >
      </p>
    }
  `,
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly dispositivos = inject(DispositivosService);
  private readonly sims = inject(SimService);
  private readonly colaboradores = inject(ColaboradoresService);
  private readonly departamentos = inject(DepartamentosService);
  private readonly health = inject(HealthService);
  private readonly technical = inject(ServicioTecnicoService);
  private readonly actas = inject(ActasEntregaService);
  private readonly offboarding = inject(OffboardingService);
  private readonly stockAlertsService = inject(StockAlertsService);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly metrics = signal<Metric[]>([]);
  private readonly historicoPorTipoRenderState = signal<TypeSummary[]>([]);
  private readonly verificadosPorTipoRenderState = signal<VerifiedTypeSummary[]>([]);
  protected readonly historicoPorTipoRender = computed(() => this.historicoPorTipoRenderState());
  protected readonly verificadosPorTipoRender = computed(() => this.verificadosPorTipoRenderState());
  protected readonly historicalInvestmentOpen = signal(false);
  protected readonly historicalValueTotal = signal(0);
  protected readonly formatHistoricalPercentage = (value: number) =>
    new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 }).format(value) + '%';
  protected readonly activeTypeSummary = signal<TypeSummary[]>([]);
  protected readonly totalDevices = signal(0);
  protected readonly historicalDevices = signal(0);
  protected readonly verifiedDevices = signal(0);
  protected readonly verifiedPercentage = signal(0);
  protected readonly verifiedValue = signal(0);
  protected readonly pendingVerification = signal(0);
  protected readonly totalSims = signal(0);
  protected readonly activePeople = signal(0);
  protected readonly activeDepartments = signal(0);
  protected readonly apiStatus = signal('—');
  protected readonly databaseStatus = signal('—');
  protected readonly serviceDevices = signal(0);
  protected readonly pendingDiagnostics = signal(0);
  protected readonly pendingQuotes = signal(0);
  protected readonly repairCosts = signal('$0');
  protected readonly operationalMetrics = signal<OperationalMetric[]>([]);
  protected readonly activeStockAlerts = signal<StockAlertConfiguration[]>([]);
  protected readonly simIcon = LucideCardSim;
  protected readonly usersIcon = LucideUsers;
  protected readonly buildingIcon = LucideBuilding;
  protected readonly formatClp = formatClp;
  protected readonly packageIcon = LucidePackage;
  protected readonly walletIcon = LucideWalletCards;
  protected readonly chevronDownIcon = LucideChevronDown;
  protected readonly chevronUpIcon = LucideChevronUp;
  ngOnInit() {
    this.load();
  }
  protected load() {
    this.loading.set(true);
    this.error.set('');
    forkJoin({
      devices: this.dispositivos.listar(),
      sims: this.sims.listar(),
      people: this.colaboradores.listar(),
      departments: this.departamentos.listar(),
      health: this.health.health(),
      database: this.health.database(),
      orders: this.technical.listar(),
      acts: this.actas.listar(),
      summary: this.dispositivos.resumenGerencial(),
      offboarding: this.offboarding.listarAbiertos(),
      stockAlerts: this.stockAlertsService.listar(),
    }).subscribe({
      next: (r) => {
        const inventoryScope = dashboardInventoryScope(r.devices);
        const inventoryActual = r.summary.inventarioActual ?? {
          cantidad: inventoryScope.operational.length,
          valorTotal: inventoryScope.operationalValue,
        };
        const verifiedSummary = firstNonEmptyArray(
          r.summary.verificadosPorTipo,
          r.summary.inventarioActivoRealVerificadoPorTipo,
        );
        const historicalSummary = firstNonEmptyArray(r.summary.historicoRegistradoPorTipo);
        const fallbackVerified = inventoryScope.operational.filter(
          (device) => device.origenRegistro === 'MANUAL' || device.verificacionFisica?.resultado === 'VERIFICADO',
        );
        const verified = r.summary.dispositivosVerificados ?? {
          cantidad: fallbackVerified.length,
          porcentajeSobreInventarioActual: inventoryActual.cantidad
            ? Math.round((fallbackVerified.length * 1000) / inventoryActual.cantidad) / 10
            : 0,
          valorTotal: fallbackVerified.reduce((total, device) => total + (device.valorComercial ?? 0), 0),
          pendientes: Math.max(0, inventoryActual.cantidad - fallbackVerified.length),
        };
        const historicalTotal = historicalSummary.reduce(
          (total, item) => total + item.cantidad,
          0,
        ) || inventoryScope.historicalTotal;
        const pendingOffboardingAssets = r.offboarding.reduce(
          (total, process) => total + process.equiposPendientes,
          0,
        );
        const pendingOffboardingValue = r.offboarding.reduce(
          (total, process) => total + process.valorPendiente,
          0,
        );
        const metrics: Metric[] = [
          {
            label: 'Inventario actual',
            value: inventoryActual.cantidad,
            meta: 'Equipos disponibles o en uso actualmente',
            details: [`Valor económico actual: ${formatClp(inventoryActual.valorTotal)}`],
            tone: 'blue',
            icon: LucidePackage,
          },
          {
            label: 'Dispositivos verificados',
            value: verified.cantidad,
            meta: `${verified.porcentajeSobreInventarioActual}% del inventario actual`,
            tone: 'blue',
            icon: LucideChartNoAxesCombined,
            details: [`Valor verificado: ${formatClp(verified.valorTotal)}`],
          },
          {
            label: 'Inventario registrado histórico',
            value: historicalTotal,
            meta: 'Total de registros, incluidas bajas y extravíos',
            tone: 'slate',
            icon: LucidePackage,
          },
          {
            label: 'Disponibles',
            value: inventoryScope.available.length,
            meta: `Valor disponible: ${formatClp(r.summary.disponibles.valor)}`,
            tone: 'cyan',
            icon: LucidePackageOpen,
            state: 'DISPONIBLE',
          },
          {
            label: 'Asignados',
            value: inventoryScope.assigned.length,
            meta: `Valor bajo custodia: ${formatClp(r.summary.asignados.valor)}`,
            tone: 'green',
            icon: LucideUsers,
            state: 'ASIGNADO',
          },
          {
            label: 'Extraviados',
            value: inventoryScope.lost.length,
            meta: `Valor de equipos por recuperar: ${formatClp(r.summary.extraviados.valor)}`,
            tone: 'dark',
            icon: LucideCircleAlert,
            state: 'EXTRAVIADO',
          },
          {
            label: 'Bajas',
            value: inventoryScope.retired.length,
            meta: `Valor retirado: ${formatClp(r.summary.bajas.valor)}`,
            tone: 'red',
            icon: LucideCircleAlert,
            state: 'DADO_BAJA',
          },
        ];
        if (inventoryScope.technicalService.length) {
          metrics.push({
            label: 'Servicio técnico',
            value: inventoryScope.technicalService.length,
            meta: 'Equipos actualmente en revisión o reparación',
            tone: 'amber',
            icon: LucideWrench,
            state: 'SERVICIO_TECNICO',
          });
        }
        if (inventoryScope.assignedWithoutResponsible.length) {
          metrics.push({
            label: 'Revisar custodia',
            value: inventoryScope.assignedWithoutResponsible.length,
            meta: 'Asignados sin responsable identificado',
            tone: 'amber',
            icon: LucideCircleAlert,
            state: 'ASIGNADO',
          });
        }
        this.metrics.set(metrics);
        this.activeStockAlerts.set(r.stockAlerts.filter((alert) => alert.enAlerta));
        this.serviceDevices.set(r.summary.servicioTecnico.cantidad);
        this.pendingDiagnostics.set(
          r.orders.filter((o) => o.estado === 'PENDIENTE_DIAGNOSTICO').length,
        );
        this.pendingQuotes.set(r.orders.filter((o) => o.estado === 'COTIZACION_RECIBIDA').length);
        this.repairCosts.set(formatClp(r.orders.reduce((s, o) => s + (o.costoFinal ?? 0), 0)));
        this.operationalMetrics.set([
          {
            title: 'Servicio Técnico',
            value: `${this.serviceDevices()} equipos`,
            meta: `${this.pendingDiagnostics()} diagnósticos · ${this.pendingQuotes()} cotizaciones por decidir · Reparaciones ${this.repairCosts()}`,
            route: '/servicio-tecnico',
            tone: 'technical',
            icon: LucideWrench,
          },
          {
            title: 'Actas de Entrega',
            value: `${r.acts.length} actas`,
            meta: 'Documentos persistidos y disponibles para descarga',
            route: '/actas',
            tone: 'documents',
            icon: LucideFileText,
          },
          {
            title: 'Offboarding',
            value: r.offboarding.length
              ? `${r.offboarding.length} ${r.offboarding.length === 1 ? 'persona' : 'personas'} en proceso`
              : 'Sin procesos pendientes',
            meta: `${pendingOffboardingAssets} ${pendingOffboardingAssets === 1 ? 'equipo' : 'equipos'} por recuperar \u00b7 ${formatClp(pendingOffboardingValue)}`,
            route: '/offboarding',
            tone: 'offboarding',
            icon: LucideUserMinus,
          },
          {
            title: 'Reportes',
            value: 'Por período',
            meta: 'Movimientos, valorización y distribución organizacional',
            route: '/reportes',
            tone: 'documents',
            icon: LucideChartNoAxesCombined,
          },
        ]);
        const historicalValuesByType = new Map<string, number>();
        for (const device of r.devices) {
          const type = device.tipo.nombre;
          historicalValuesByType.set(
            type,
            (historicalValuesByType.get(type) ?? 0) + (device.valorComercial ?? 0),
          );
        }
        const historicalRender = historicalSummary.map((item) => ({
          label: item.tipo,
          count: item.cantidad,
          percentage: item.porcentajeCantidad,
          value: item.valorHistorico ?? historicalValuesByType.get(item.tipo),
        }));
        this.historicoPorTipoRenderState.set(historicalRender);
        const summaryHistoricalValue = historicalSummary.reduce(
          (total, item) => total + (item.valorHistorico ?? 0),
          0,
        );
        const hasSummaryHistoricalValue = historicalSummary.some(
          (item) => item.valorHistorico !== undefined && item.valorHistorico !== null,
        );
        this.historicalValueTotal.set(
          hasSummaryHistoricalValue ? summaryHistoricalValue : inventoryScope.historicalValue,
        );
        const activeSummary = r.summary.inventarioActivoRealPorTipo ?? r.summary.valorInventarioActivoPorTipo ?? [];
        this.activeTypeSummary.set(activeSummary.map((item) => ({
          label: item.tipo,
          count: item.cantidad,
          percentage: item.porcentajeCantidad,
          value: item.valorTotal,
        })));
        const verifiedRender = verifiedSummary.map((item) => ({
          label: item.tipo,
          count: item.cantidad,
          percentage: item.porcentajeCantidad,
          value: item.valorTotal,
          valuePercentage: item.porcentajeValor,
          icon: iconForDeviceType(item.tipo),
        }));
        this.verificadosPorTipoRenderState.set(verifiedRender);
        console.log(
          '[RENDER VERIFICADOS]',
          this.verificadosPorTipoRender(),
        );
        console.log('[RENDER HISTORICO]', this.historicoPorTipoRender());
        this.totalDevices.set(inventoryActual.cantidad);
        this.historicalDevices.set(historicalTotal);
        this.verifiedDevices.set(verified.cantidad);
        this.verifiedPercentage.set(verified.porcentajeSobreInventarioActual);
        this.verifiedValue.set(verified.valorTotal);
        this.pendingVerification.set(verified.pendientes);
        this.totalSims.set(r.sims.length);
        this.activePeople.set(r.people.filter((i) => i.activo).length);
        this.activeDepartments.set(r.departments.filter((i) => i.activo).length);
        this.apiStatus.set(r.health.status);
        this.databaseStatus.set(r.database.status);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }

  protected toggleHistoricalInvestment() {
    this.historicalInvestmentOpen.update((open) => !open);
  }
}
