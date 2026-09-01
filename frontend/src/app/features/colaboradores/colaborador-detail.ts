import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import {
  ActivoConciliado,
  ClasificacionConciliada,
  Colaborador,
  InventarioConciliadoColaborador,
} from '../../core/models/itam.models';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { formatClp } from '../../shared/utils/currency';
import { errorMessage } from '../../shared/utils/error-message';

export const custodyValue = (assets: readonly { valorComercial: number }[]): number =>
  assets.reduce((total, asset) => total + asset.valorComercial, 0);

export const reconciliationLabel = (classification: ClasificacionConciliada): string =>
  ({
    ACTUAL_CONFIRMADO: 'Actual confirmado',
    ACTUAL_PROBABLE: 'Actual probable',
    HISTORICO_CONFIRMADO: 'Histórico confirmado',
    HISTORICO_PROBABLE: 'Histórico probable — sin devolución registrada',
    PENDIENTE_VALIDACION: 'Pendiente de validación',
    CONFLICTO_DATOS: 'Conflicto de datos',
  })[classification];

export const assetIdentifier = (
  asset: Pick<ActivoConciliado, 'tipoDispositivo' | 'imei' | 'numeroSerie'>,
): { label: string; value: string } => {
  const smartphone = asset.tipoDispositivo.trim().toUpperCase().includes('SMARTPHONE');
  if (smartphone) {
    return { label: 'IMEI', value: asset.imei?.trim() || 'Sin IMEI registrado' };
  }
  return { label: 'N° de serie', value: asset.numeroSerie?.trim() || 'Sin N° de serie registrado' };
};

@Component({
  selector: 'app-colaborador-detail',
  imports: [DatePipe, NgTemplateOutlet, RouterLink, PageHeader, StatusBadge, ViewState],
  template: `
    <app-page-header
      title="Detalle del colaborador"
      subtitle="Identificación, inventario conciliado e historial de equipos."
    >
      @if (item()) {
        <a class="btn btn--secondary" [routerLink]="['editar']">Editar</a>
      }
    </app-page-header>

    @if (loading()) {
      <section class="card"><app-view-state kind="loading" title="Cargando detalle" /></section>
    } @else if (error()) {
      <section class="card">
        <app-view-state kind="error" title="No se pudo cargar" [message]="error()" />
      </section>
    } @else if (item(); as collaborator) {
      <section class="card detail-card">
        <div class="detail-title">
          <div>
            <span class="initial">{{ collaborator.nombre.charAt(0) }}</span>
            <div><h2>{{ collaborator.nombre }}</h2><p>{{ collaborator.rut }}</p></div>
          </div>
          <app-status-badge
            [code]="collaborator.activo"
            [label]="collaborator.activo ? 'Activo' : 'Inactivo'"
          />
        </div>
        <dl class="detail-grid">
          <div class="detail-item"><dt>Cargo</dt><dd>{{ collaborator.cargo || '—' }}</dd></div>
          <div class="detail-item">
            <dt>Departamento</dt><dd>{{ collaborator.departamento?.nombre || 'Sin departamento' }}</dd>
          </div>
          <div class="detail-item"><dt>Localidad</dt><dd>{{ collaborator.localidad || '—' }}</dd></div>
          <div class="detail-item">
            <dt>Creado</dt><dd>{{ collaborator.creadoEn | date: 'dd-MM-yyyy HH:mm' }}</dd>
          </div>
        </dl>
      </section>

      @if (inventory(); as inventoryData) {
        <section class="custody-summary" aria-label="Resumen del inventario conciliado">
          <div><span>Equipos actuales</span><strong>{{ inventoryData.actuales.length }}</strong></div>
          <div><span>Valor actual en custodia</span><strong>{{ clp(inventoryData.valorTotalActual) }}</strong></div>
          <div class="summary-warning">
            <span>Pendientes de validación</span><strong>{{ inventoryData.pendientes.length }}</strong>
          </div>
        </section>

        <section class="card collaborator-assets current-assets">
          <header>
            <div>
              <span>CUSTODIA CONCILIADA</span>
              <h2>Equipos actuales</h2>
              <p>Solo activos confirmados o probablemente vigentes según la evidencia disponible.</p>
            </div>
          </header>
          @if (!inventoryData.actuales.length) {
            <app-view-state kind="empty" title="Sin equipos actuales conciliados" />
          } @else {
            <ng-container
              [ngTemplateOutlet]="assetTable"
              [ngTemplateOutletContext]="{ assets: inventoryData.actuales }"
            />
          }
        </section>

        <section class="card collaborator-assets historical-assets">
          <header>
            <div>
              <span>TRAZABILIDAD</span>
              <h2>Historial conciliado de equipos</h2>
              <p>Registros anteriores preservados sin inventar devoluciones ni alterar estados físicos.</p>
            </div>
          </header>
          @if (!inventoryData.historicos.length) {
            <app-view-state kind="empty" title="Sin equipos históricos conciliados" />
          } @else {
            <ng-container
              [ngTemplateOutlet]="assetTable"
              [ngTemplateOutletContext]="{ assets: inventoryData.historicos }"
            />
          }
        </section>

        <section class="card collaborator-assets pending-assets">
          <header>
            <div>
              <span>CONTROL MANUAL</span>
              <h2>Pendientes de validación</h2>
              <p>Activos con identificación insuficiente o evidencia contradictoria.</p>
            </div>
          </header>
          @if (!inventoryData.pendientes.length) {
            <app-view-state kind="empty" title="Sin pendientes de validación" />
          } @else {
            <ng-container
              [ngTemplateOutlet]="assetTable"
              [ngTemplateOutletContext]="{ assets: inventoryData.pendientes }"
            />
          }
        </section>
      }
    }

    <ng-template #assetTable let-assets="assets">
      <div class="table-wrap">
        <table class="data-table reconciled-table">
          <thead>
            <tr>
              <th>Código ITAM</th><th>Equipo</th><th>Identificación física</th>
              <th>Asignación</th><th>Clasificación</th><th>Estado original</th><th>Valor comercial</th>
            </tr>
          </thead>
          <tbody>
            @for (asset of assets; track asset.dispositivoId) {
              <tr>
                <td><a [routerLink]="['/dispositivos', asset.codigoItam]">{{ asset.codigoItam }}</a></td>
                <td>
                  <strong>{{ asset.tipoDispositivo }}</strong>
                  <span class="cell-secondary">{{ asset.marca || '—' }} {{ asset.modelo || '' }}</span>
                </td>
                <td>
                  <span class="identity-label">{{ identifier(asset).label }}</span>
                  <span class="code">{{ identifier(asset).value }}</span>
                </td>
                <td>{{ asset.fechaAsignacion | date: 'dd/MM/yyyy' }}</td>
                <td>
                  <span class="reconciliation-badge" [class]="'reconciliation-badge ' + tone(asset.clasificacionConciliada)">
                    {{ label(asset.clasificacionConciliada) }}
                  </span>
                  <small class="reconciliation-reason">{{ asset.motivoConciliacion }}</small>
                </td>
                <td>
                  <app-status-badge [code]="asset.estadoOriginal.codigo" [label]="asset.estadoOriginal.nombre" />
                </td>
                <td>{{ clp(asset.valorComercial) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </ng-template>
  `,
  styles: [
    `
      .detail-card { padding: 1.4rem; }
      .detail-title { align-items: center; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; margin-bottom: 1.2rem; padding-bottom: 1.2rem; }
      .detail-title > div { align-items: center; display: flex; gap: 0.8rem; }
      .detail-title h2 { font-size: 1.2rem; margin: 0; }
      .detail-title p { color: var(--color-muted); margin: 0.2rem 0 0; }
      .initial { align-items: center; background: var(--color-primary-soft); border-radius: 0.7rem; color: var(--color-primary); display: flex; font-size: 1.15rem; font-weight: 850; height: 2.8rem; justify-content: center; width: 2.8rem; }
      .custody-summary { display: grid; gap: 1rem; grid-template-columns: repeat(3, minmax(0, 1fr)); margin: 1rem 0; }
      .custody-summary > div { background: var(--navy); border-bottom: 3px solid var(--cyan); border-radius: 1rem; color: #fff; padding: 1.2rem; }
      .custody-summary .summary-warning { border-bottom-color: #f59e0b; }
      .custody-summary span { display: block; font-size: 0.75rem; }
      .custody-summary strong { display: block; font-size: 1.5rem; margin-top: 0.3rem; }
      .collaborator-assets { margin-top: 1rem; overflow: hidden; }
      .collaborator-assets header { border-left: 4px solid var(--cyan); padding: 1rem 1.2rem; }
      .historical-assets header { border-left-color: var(--blue); }
      .pending-assets header { border-left-color: #f59e0b; }
      .collaborator-assets header span { color: var(--blue); font-size: 0.68rem; font-weight: 800; letter-spacing: 0.05em; }
      .collaborator-assets h2 { font-size: 1.05rem; margin: 0.2rem 0 0; }
      .collaborator-assets header p { color: var(--slate-500); font-size: 0.76rem; margin: 0.25rem 0 0; }
      .reconciled-table { min-width: 980px; }
      .identity-label { color: var(--slate-500); display: block; font-size: 0.68rem; font-weight: 700; text-transform: uppercase; }
      .code { display: block; margin-top: 0.2rem; }
      .reconciliation-badge { border-radius: 999px; display: inline-flex; font-size: 0.7rem; font-weight: 800; line-height: 1.2; padding: 0.35rem 0.55rem; }
      .reconciliation-badge.current { background: #dbeafe; color: #1e40af; }
      .reconciliation-badge.historical { background: #e2e8f0; color: #334155; }
      .reconciliation-badge.pending { background: #fef3c7; color: #92400e; }
      .reconciliation-badge.conflict { background: #fee2e2; color: #991b1b; }
      .reconciliation-reason { color: var(--slate-500); display: block; line-height: 1.35; margin-top: 0.4rem; max-width: 28rem; }
      @media (max-width: 767px) {
        .detail-title { align-items: flex-start; gap: 1rem; }
        .custody-summary { grid-template-columns: 1fr; }
        .collaborator-assets header { padding: 0.9rem 1rem; }
      }
    `,
  ],
})
export class ColaboradorDetail implements OnInit {
  private readonly service = inject(ColaboradoresService);
  private readonly route = inject(ActivatedRoute);
  protected readonly item = signal<Colaborador | null>(null);
  protected readonly inventory = signal<InventarioConciliadoColaborador | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly clp = formatClp;
  protected readonly custodyValue = custodyValue;
  protected readonly identifier = assetIdentifier;
  protected readonly label = reconciliationLabel;

  protected readonly tone = (classification: ClasificacionConciliada): string => {
    if (classification.startsWith('ACTUAL')) return 'current';
    if (classification.startsWith('HISTORICO')) return 'historical';
    if (classification === 'CONFLICTO_DATOS') return 'conflict';
    return 'pending';
  };

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    forkJoin({
      person: this.service.obtener(id),
      inventory: this.service.inventarioConciliado(id),
    }).subscribe({
      next: (result) => {
        this.item.set(result.person);
        this.inventory.set(result.inventory);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }
}
