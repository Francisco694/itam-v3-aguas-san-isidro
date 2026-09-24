import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  LucideBuilding,
  LucideCardSim,
  LucideCircleAlert,
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
import type {
  Departamento,
  Dispositivo,
  InventarioDepartamento,
} from '../../core/models/itam.models';
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

interface DepartmentInventorySummary {
  departamento: Departamento;
  custodiaDirecta: number;
  conColaboradores: number;
  totalRelacionado: number;
  valorDirecto: number;
  valorPersonal: number;
  valorTotal: number;
}

interface DepartmentInventoryDetailState {
  loading: boolean;
  error: string;
  data: InventarioDepartamento | null;
}

interface DepartmentInventoryDeviceRow {
  device: Dispositivo;
  custodyLabel: string;
  custodyType: 'DIRECTA' | 'COLABORADOR';
}

@Component({
  selector: 'app-dashboard',
  imports: [
    RouterLink,
    PageHeader,
    ViewState,
    LucideDynamicIcon,
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
      <section class="operational-resources-section" aria-labelledby="operational-resources-title">
        <article class="card operational-card">
          <div class="card-heading">
            <div>
              <span>Panorama operativo</span>
              <h2 id="operational-resources-title">Recursos relacionados</h2>
            </div>
          </div>
          <div class="mini-stat-grid" aria-label="Resumen de recursos relacionados">
            <div class="mini-stat">
              <span class="mini-icon"><svg [lucideIcon]="simIcon"></svg></span>
              <div>
                <strong>{{ totalSims() }}</strong>
                <span>Tarjetas SIM</span>
              </div>
            </div>
            <div class="mini-stat">
              <span class="mini-icon"><svg [lucideIcon]="usersIcon"></svg></span>
              <div>
                <strong>{{ activePeople() }}</strong>
                <span>Colaboradores activos</span>
              </div>
            </div>
            <div class="mini-stat">
              <span class="mini-icon"><svg [lucideIcon]="buildingIcon"></svg></span>
              <div>
                <strong>{{ activeDepartments() }}</strong>
                <span>Departamentos activos</span>
              </div>
            </div>
          </div>
        </article>
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
          <div class="active-inventory-overview" aria-label="Resumen del inventario activo real">
            <div class="active-inventory-overview__metric">
              <span>Equipos activos reales</span>
              <strong>{{ totalDevices() }}</strong>
              <small>Equipos actualmente vigentes</small>
            </div>
            <div class="active-inventory-overview__metric active-inventory-overview__metric--value">
              <span>Valor económico total</span>
              <strong>{{ formatClp(activeInventoryValue()) }}</strong>
              <small>Suma del inventario activo real</small>
            </div>
          </div>
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
      </section>
      <section class="department-inventory-section" aria-labelledby="department-inventory-title">
        <div class="section-heading department-inventory-section__heading">
          <div>
            <span>INVENTARIO ORGANIZACIONAL</span>
            <h2 id="department-inventory-title">Inventario por departamento</h2>
          </div>
          <p>Activos vigentes relacionados con cada unidad.</p>
        </div>

        <div class="department-inventory-summary" aria-label="Resumen del inventario por departamento">
          <div class="department-inventory-summary__item">
            <span>Departamentos con activos</span>
            <strong>{{ departmentsWithAssets() }}</strong>
          </div>
          <div class="department-inventory-summary__item">
            <span>Equipos relacionados</span>
            <strong>{{ relatedDepartmentDevices() }}</strong>
          </div>
          <div class="department-inventory-summary__item">
            <span>Valor económico relacionado</span>
            <strong>{{ formatClp(relatedDepartmentValue()) }}</strong>
          </div>
        </div>

        <div class="department-inventory-toolbar">
          <label class="department-inventory-search" for="department-inventory-search">
            <span>Buscar departamento</span>
            <input
              id="department-inventory-search"
              type="search"
              [value]="departmentInventoryQuery()"
              placeholder="Nombre del departamento"
              (input)="setDepartmentInventoryQuery($event)"
            />
          </label>
          <span class="department-inventory-toolbar__note">Datos reales · Sin duplicidades</span>
        </div>

        @if (!departmentInventoryRows().length) {
          <app-view-state
            kind="empty"
            [title]="departmentInventoryQuery() ? 'Sin resultados' : 'Sin departamentos con activos'"
            [message]="departmentInventoryQuery() ? 'No hay departamentos con dispositivos activos que coincidan con la búsqueda.' : 'No hay departamentos con dispositivos activos para mostrar.'"
          />
        } @else {
          <div class="department-inventory-list">
            @for (row of departmentInventoryRows(); track row.departamento.id) {
              <article class="department-inventory-row" [class.department-inventory-row--open]="expandedDepartmentId() === row.departamento.id">
                <div class="department-inventory-row__summary">
                  <div class="department-inventory-row__name">
                    <a [routerLink]="['/departamentos', row.departamento.id]">{{ row.departamento.nombre }}</a>
                    <span>{{ row.totalRelacionado }} {{ row.totalRelacionado === 1 ? 'equipo relacionado' : 'equipos relacionados' }}</span>
                  </div>
                  <div class="department-inventory-row__metric">
                    <span>Directos</span>
                    <strong>{{ row.custodiaDirecta }}</strong>
                  </div>
                  <div class="department-inventory-row__metric">
                    <span>Personal</span>
                    <strong>{{ row.conColaboradores }}</strong>
                  </div>
                  <div class="department-inventory-row__value">
                    <span>Valor total</span>
                    <strong>{{ formatClp(row.valorTotal) }}</strong>
                  </div>
                  <button
                    class="btn btn--secondary btn--small department-inventory-row__toggle"
                    type="button"
                    [attr.aria-expanded]="expandedDepartmentId() === row.departamento.id"
                    [attr.aria-controls]="'department-inventory-detail-' + row.departamento.id"
                    (click)="toggleDepartmentInventory(row)"
                  >
                    <svg [lucideIcon]="expandedDepartmentId() === row.departamento.id ? chevronUpIcon : chevronDownIcon"></svg>
                    {{ expandedDepartmentId() === row.departamento.id ? 'Ocultar' : 'Ver inventario' }}
                  </button>
                </div>

                @if (expandedDepartmentId() === row.departamento.id) {
                  <div class="department-inventory-row__detail" [id]="'department-inventory-detail-' + row.departamento.id">
                    @if (departmentInventoryDetail(row).loading) {
                      <app-view-state kind="loading" title="Cargando inventario" message="Consultando los equipos relacionados con este departamento…" />
                    } @else if (departmentInventoryDetail(row).error) {
                      <app-view-state
                        kind="error"
                        title="No se pudo cargar el inventario"
                        [message]="departmentInventoryDetail(row).error"
                        (retry)="retryDepartmentInventory(row)"
                      />
                    } @else if (departmentInventoryDetail(row).data; as detail) {
                      <div class="department-inventory-detail__header">
                        <div>
                          <span>DETALLE DE CUSTODIA</span>
                          <p>Directos: {{ detail.resumen.custodiaDirecta }} · Personal: {{ detail.resumen.conColaboradores }}</p>
                        </div>
                        <a class="btn btn--ghost btn--small" [routerLink]="['/departamentos', row.departamento.id]">Ver departamento</a>
                      </div>
                      @if (!departmentInventoryDevices(detail).length) {
                        <app-view-state kind="empty" title="Sin equipos vigentes" message="Este departamento no tiene equipos activos relacionados." />
                      } @else {
                        <div class="table-wrap department-inventory-table-wrap">
                          <table class="department-inventory-table">
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Equipo</th>
                                <th>Tipo</th>
                                <th>Custodia actual</th>
                                <th>Estado</th>
                                <th>Verificación</th>
                                <th>Valor</th>
                                <th>Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              @for (item of departmentInventoryDevices(detail); track item.device.id) {
                                <tr>
                                  <td class="cell-primary">{{ item.device.codigoInventario }}</td>
                                  <td>{{ departmentDeviceLabel(item.device) }}</td>
                                  <td>{{ item.device.tipo.nombre }}</td>
                                  <td>
                                    <span>{{ item.custodyLabel }}</span>
                                    <small>{{ item.custodyType === 'DIRECTA' ? 'Custodia directa' : 'Equipo del personal' }}</small>
                                  </td>
                                  <td>{{ item.device.estado.nombre }}</td>
                                  <td>
                                    <span [class.department-inventory-verification--positive]="departmentVerificationLabel(item.device) === 'Verificado'">
                                      {{ departmentVerificationLabel(item.device) }}
                                    </span>
                                  </td>
                                  <td>{{ formatClp(item.device.valorComercial) }}</td>
                                  <td>
                                    <a class="btn btn--ghost btn--small" routerLink="/dispositivos" [queryParams]="{ q: item.device.codigoInventario }">Ver equipo</a>
                                  </td>
                                </tr>
                              }
                            </tbody>
                          </table>
                        </div>
                      }
                    }
                  </div>
                }
              </article>
            }
          </div>
        }
      </section>
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
  protected readonly activeInventoryValue = signal(0);
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
  private readonly departmentInventorySummary = signal<DepartmentInventorySummary[]>([]);
  private readonly departmentInventoryDetails = signal<Record<string, DepartmentInventoryDetailState>>({});
  protected readonly departmentInventoryQuery = signal('');
  protected readonly expandedDepartmentId = signal<string | null>(null);
  protected readonly departmentInventoryRows = computed(() => {
    const query = this.departmentInventoryQuery().trim().toLocaleLowerCase('es');
    if (!query) return this.departmentInventorySummary();
    return this.departmentInventorySummary().filter((row) =>
      row.departamento.nombre.toLocaleLowerCase('es').includes(query),
    );
  });
  protected readonly departmentsWithAssets = computed(
    () => this.departmentInventorySummary().filter((row) => row.totalRelacionado > 0).length,
  );
  protected readonly relatedDepartmentDevices = computed(
    () => this.departmentInventorySummary().reduce((total, row) => total + row.totalRelacionado, 0),
  );
  protected readonly relatedDepartmentValue = computed(
    () => this.departmentInventorySummary().reduce((total, row) => total + row.valorTotal, 0),
  );
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
        this.departmentInventorySummary.set(this.buildDepartmentInventorySummary(r.departments, r.devices));
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
          percentage: inventoryActual.cantidad
            ? Math.round((item.cantidad * 1000) / inventoryActual.cantidad) / 10
            : 0,
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
        this.activeInventoryValue.set(inventoryActual.valorTotal);
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

  protected setDepartmentInventoryQuery(event: Event) {
    this.departmentInventoryQuery.set((event.target as HTMLInputElement | null)?.value ?? '');
  }

  protected departmentInventoryDetail(row: DepartmentInventorySummary): DepartmentInventoryDetailState {
    return this.departmentInventoryDetails()[row.departamento.id] ?? {
      loading: false,
      error: '',
      data: null,
    };
  }

  protected toggleDepartmentInventory(row: DepartmentInventorySummary) {
    const departmentId = row.departamento.id;
    if (this.expandedDepartmentId() === departmentId) {
      this.expandedDepartmentId.set(null);
      return;
    }

    this.expandedDepartmentId.set(departmentId);
    const cached = this.departmentInventoryDetails()[departmentId];
    if (!cached?.data && !cached?.loading) this.loadDepartmentInventory(departmentId);
  }

  protected retryDepartmentInventory(row: DepartmentInventorySummary) {
    this.loadDepartmentInventory(row.departamento.id);
  }

  protected departmentInventoryDevices(detail: InventarioDepartamento): DepartmentInventoryDeviceRow[] {
    const directIds = new Set<string>();
    const direct = detail.custodiaDirecta.reduce<DepartmentInventoryDeviceRow[]>((rows, device) => {
      if (directIds.has(device.id)) return rows;
      directIds.add(device.id);
      rows.push({
        device,
        custodyLabel: detail.departamento.nombre,
        custodyType: 'DIRECTA',
      });
      return rows;
    }, []);
    const personal = detail.activosColaboradores.reduce<DepartmentInventoryDeviceRow[]>((rows, device) => {
      if (directIds.has(device.id) || rows.some((item) => item.device.id === device.id)) return rows;
      rows.push({
        device,
        custodyLabel: device.colaborador?.nombre ?? 'Colaborador sin nombre',
        custodyType: 'COLABORADOR',
      });
      return rows;
    }, []);
    return [...direct, ...personal];
  }

  protected departmentDeviceLabel(device: Dispositivo): string {
    return [device.marca, device.modelo].filter(Boolean).join(' ') || device.tipo.nombre;
  }

  protected departmentVerificationLabel(device: Dispositivo): string {
    if (device.origenRegistro === 'MANUAL' || device.verificacionFisica?.resultado === 'VERIFICADO') {
      return 'Verificado';
    }
    if (device.verificacionFisica?.resultado === 'REVISAR') return 'Revisar';
    return 'Pendiente';
  }

  private loadDepartmentInventory(departmentId: string) {
    this.departmentInventoryDetails.update((details) => ({
      ...details,
      [departmentId]: { loading: true, error: '', data: details[departmentId]?.data ?? null },
    }));
    this.departamentos.inventario(departmentId).subscribe({
      next: (data) => {
        this.departmentInventoryDetails.update((details) => ({
          ...details,
          [departmentId]: { loading: false, error: '', data },
        }));
      },
      error: (error) => {
        this.departmentInventoryDetails.update((details) => ({
          ...details,
          [departmentId]: { loading: false, error: errorMessage(error), data: null },
        }));
      },
    });
  }

  private buildDepartmentInventorySummary(
    departments: readonly Departamento[],
    devices: readonly Dispositivo[],
  ): DepartmentInventorySummary[] {
    const rows = new Map<string, {
      direct: Set<string>;
      personal: Set<string>;
      directValue: number;
      personalValue: number;
    }>();
    const directDeviceIds = new Set(
      devices
        .filter((device) => CURRENT_OPERATIONAL_STATE_CODES.has(device.estado?.codigo ?? '') && device.departamento)
        .map((device) => device.id),
    );

    for (const device of devices) {
      if (!CURRENT_OPERATIONAL_STATE_CODES.has(device.estado?.codigo ?? '')) continue;
      const directDepartment = device.departamento;
      const collaboratorDepartment = device.colaborador?.departamento;
      const department = directDepartment ?? (
        directDeviceIds.has(device.id) ? null : collaboratorDepartment
      );
      if (!department) continue;
      const row = rows.get(department.id) ?? {
        direct: new Set<string>(),
        personal: new Set<string>(),
        directValue: 0,
        personalValue: 0,
      };
      if (directDepartment) {
        if (!row.direct.has(device.id)) {
          row.direct.add(device.id);
          row.directValue += device.valorComercial ?? 0;
        }
      } else if (!row.personal.has(device.id)) {
        row.personal.add(device.id);
        row.personalValue += device.valorComercial ?? 0;
      }
      rows.set(department.id, row);
    }

    return departments
      .map((departamento) => {
        const values = rows.get(departamento.id);
        const custodiaDirecta = values?.direct.size ?? 0;
        const conColaboradores = values?.personal.size ?? 0;
        const valorDirecto = values?.directValue ?? 0;
        const valorPersonal = values?.personalValue ?? 0;
        return {
          departamento,
          custodiaDirecta,
          conColaboradores,
          totalRelacionado: custodiaDirecta + conColaboradores,
          valorDirecto,
          valorPersonal,
          valorTotal: valorDirecto + valorPersonal,
        };
      })
      .filter((row) => row.totalRelacionado > 0)
      .sort((a, b) =>
        b.totalRelacionado - a.totalRelacionado ||
        a.departamento.nombre.localeCompare(b.departamento.nombre, 'es', { sensitivity: 'base' }),
      );
  }
}
