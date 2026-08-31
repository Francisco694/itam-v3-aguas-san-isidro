import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  LucideBuilding,
  LucideCardSim,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideChartNoAxesCombined,
  LucideDynamicIcon,
  LucideFileText,
  LucidePackage,
  LucidePackageOpen,
  LucideUserMinus,
  LucideUsers,
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
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { formatClp } from '../../shared/utils/currency';
import { errorMessage } from '../../shared/utils/error-message';

interface Metric {
  label: string;
  value: number;
  meta: string;
  tone: string;
  icon: LucideIconInput;
  state?: string;
}
interface TypeSummary {
  label: string;
  count: number;
  percentage: number;
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
      <section class="metric-grid" aria-label="Indicadores principales">
        @for (metric of metrics(); track metric.label) {
          <a
            class="card metric"
            [class]="'card metric metric--' + metric.tone"
            routerLink="/dispositivos"
            [queryParams]="metric.state ? { estado: metric.state } : {}"
            ><div class="metric__head">
              <span class="metric__label">{{ metric.label }}</span
              ><span class="metric__icon"><svg [lucideIcon]="metric.icon"></svg></span>
            </div>
            <strong class="metric__value">{{ metric.value }}</strong>
            <p class="metric__meta">{{ metric.meta }}</p></a
          >
        }
      </section>
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
      <section class="card financial-card">
        <div class="card-heading">
          <div>
            <span>Control económico</span>
            <h2>Indicadores financieros</h2>
          </div>
        </div>
        <div class="financial-grid">
          <div>
            <span>Extraviados · {{ lostDevices() }} equipos</span><strong>{{ lostValue() }}</strong>
          </div>
          <div>
            <span>Bajas · {{ retiredDevices() }} equipos</span><strong>{{ retiredValue() }}</strong>
          </div>
          <div>
            <span>En servicio técnico</span><strong>{{ serviceDevices() }} equipos</strong>
          </div>
          <div>
            <span>Diagnósticos pendientes</span><strong>{{ pendingDiagnostics() }}</strong>
          </div>
          <div>
            <span>Cotizaciones por decidir</span><strong>{{ pendingQuotes() }}</strong>
          </div>
          <div>
            <span>Reparaciones acumuladas</span><strong>{{ repairCosts() }}</strong>
          </div>
          <div>
            <span>Valor de equipos activos</span><strong>{{ inventoryValue() }}</strong>
          </div>
        </div>
      </section>
      <section class="dashboard-grid">
        <article class="card type-card">
          <div class="card-heading">
            <div>
              <span>Distribución real</span>
              <h2>Inventario por Tipo</h2>
            </div>
            <strong>{{ totalDevices() }} activos</strong>
          </div>
          @if (!typeSummary().length) {
            <app-view-state
              kind="empty"
              title="Sin dispositivos"
              message="Registra activos para ver la distribución por tipo."
            />
          } @else {
            <div class="type-bars">
              @for (type of typeSummary(); track type.label) {
                <div class="type-row">
                  <div>
                    <strong>{{ type.label }}</strong
                    ><span>{{ type.count }} {{ type.count === 1 ? 'activo' : 'activos' }}</span>
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
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly metrics = signal<Metric[]>([]);
  protected readonly typeSummary = signal<TypeSummary[]>([]);
  protected readonly totalDevices = signal(0);
  protected readonly totalSims = signal(0);
  protected readonly activePeople = signal(0);
  protected readonly activeDepartments = signal(0);
  protected readonly apiStatus = signal('—');
  protected readonly databaseStatus = signal('—');
  protected readonly lostValue = signal('$0');
  protected readonly retiredValue = signal('$0');
  protected readonly serviceDevices = signal(0);
  protected readonly pendingDiagnostics = signal(0);
  protected readonly pendingQuotes = signal(0);
  protected readonly repairCosts = signal('$0');
  protected readonly inventoryValue = signal('$0');
  protected readonly lostDevices = signal(0);
  protected readonly retiredDevices = signal(0);
  protected readonly operationalMetrics = signal<OperationalMetric[]>([]);
  protected readonly simIcon = LucideCardSim;
  protected readonly usersIcon = LucideUsers;
  protected readonly buildingIcon = LucideBuilding;
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
    }).subscribe({
      next: (r) => {
        const lostItems = r.devices.filter((i) => i.estado.codigo.includes('EXTRAVIAD'));
        const retiredItems = r.devices.filter((i) => i.estado.codigo.includes('BAJA'));
        const pendingOffboardingAssets = r.offboarding.reduce(
          (total, process) => total + process.equiposPendientes,
          0,
        );
        const pendingOffboardingValue = r.offboarding.reduce(
          (total, process) => total + process.valorPendiente,
          0,
        );
        this.metrics.set([
          {
            label: 'Inventario',
            value: r.summary.inventarioOperacional.cantidad,
            meta: `Valor de equipos activos: ${formatClp(r.summary.inventarioOperacional.valor)}`,
            tone: 'blue',
            icon: LucidePackage,
          },
          {
            label: 'Disponibles',
            value: r.summary.disponibles.cantidad,
            meta: `Valor disponible: ${formatClp(r.summary.disponibles.valor)}`,
            tone: 'cyan',
            icon: LucidePackageOpen,
            state: 'DISPONIBLE',
          },
          {
            label: 'Asignados',
            value: r.summary.asignados.cantidad,
            meta: `Valor bajo custodia: ${formatClp(r.summary.asignados.valor)}`,
            tone: 'green',
            icon: LucideUsers,
            state: 'ASIGNADO',
          },
          {
            label: 'Extraviados',
            value: r.summary.extraviados.cantidad,
            meta: `Valor comprometido: ${formatClp(r.summary.extraviados.valor)}`,
            tone: 'dark',
            icon: LucideCircleAlert,
            state: 'EXTRAVIADO',
          },
          {
            label: 'Bajas',
            value: r.summary.bajas.cantidad,
            meta: `Valor retirado: ${formatClp(r.summary.bajas.valor)}`,
            tone: 'red',
            icon: LucideCircleAlert,
            state: 'DADO_BAJA',
          },
        ]);
        this.lostValue.set(formatClp(lostItems.reduce((s, i) => s + i.valorComercial, 0)));
        this.retiredValue.set(formatClp(retiredItems.reduce((s, i) => s + i.valorComercial, 0)));
        this.inventoryValue.set(formatClp(r.summary.inventarioOperacional.valor));
        this.lostDevices.set(lostItems.length);
        this.retiredDevices.set(retiredItems.length);
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
            meta: `${this.pendingDiagnostics()} diagnósticos · ${this.pendingQuotes()} cotizaciones por decidir`,
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
        const counts = new Map<string, number>();
        for (const item of r.devices)
          counts.set(item.tipo.nombre, (counts.get(item.tipo.nombre) ?? 0) + 1);
        this.typeSummary.set(
          [...counts.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([label, count]) => ({
              label,
              count,
              percentage: r.devices.length ? Math.round((count * 100) / r.devices.length) : 0,
            })),
        );
        this.totalDevices.set(r.devices.length);
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
}
