import { DatePipe } from '@angular/common';
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
import { formatRut } from '../../shared/utils/rut';

export const custodyValue = (assets: readonly { valorComercial: number }[]): number =>
  assets.reduce((total, asset) => total + asset.valorComercial, 0);

export const reconciliationLabel = (classification: ClasificacionConciliada): string =>
  ({
    ACTUAL_CONFIRMADO: 'Actual probable',
    ACTUAL_PROBABLE: 'Actual probable',
    HISTORICO_CONFIRMADO: 'Histórico confirmado',
    HISTORICO_PROBABLE: 'Histórico probable',
    PENDIENTE_VALIDACION: 'Pendiente de validación',
    CONFLICTO_DATOS: 'Conflicto de datos',
  })[classification];

export const assetIdentifier = (
  asset: Pick<ActivoConciliado, 'tipoDispositivo' | 'imei' | 'numeroSerie'>,
): { label: string; value: string } => {
  const smartphone = asset.tipoDispositivo.trim().toUpperCase().includes('SMARTPHONE');
  if (smartphone) return { label: 'IMEI', value: asset.imei?.trim() || 'Sin IMEI registrado' };
  return { label: 'N° de serie', value: asset.numeroSerie?.trim() || 'Sin N° de serie registrado' };
};

export const suggestedValidationAction = (classification: ClasificacionConciliada): string =>
  classification === 'CONFLICTO_DATOS'
    ? 'Revisar evidencia física y confirmar el custodio correcto.'
    : 'Verificar IMEI o serie y completar la identificación del activo.';

@Component({
  selector: 'app-colaborador-detail',
  imports: [DatePipe, RouterLink, PageHeader, StatusBadge, ViewState],
  template: `
    <app-page-header
      title="Detalle del colaborador"
      subtitle="Dispositivo vigente, historial y casos que requieren validación."
    >
      @if (item()) { <a class="btn btn--secondary" [routerLink]="['editar']">Editar</a> }
    </app-page-header>

    @if (loading()) {
      <section class="card"><app-view-state kind="loading" title="Cargando detalle" /></section>
    } @else if (error()) {
      <section class="card"><app-view-state kind="error" title="No se pudo cargar" [message]="error()" /></section>
    } @else if (item(); as collaborator) {
      <section class="card detail-card">
        <div class="detail-title">
          <div>
            <span class="initial">{{ collaborator.nombre.charAt(0) }}</span>
            <div><h2>{{ collaborator.nombre }}</h2><p>{{ rut(collaborator.rut) }}</p></div>
          </div>
          <app-status-badge [code]="collaborator.activo" [label]="collaborator.activo ? 'Activo' : 'Inactivo'" />
        </div>
        <dl class="detail-grid">
          <div class="detail-item"><dt>Cargo</dt><dd>{{ collaborator.cargo || '—' }}</dd></div>
          <div class="detail-item"><dt>Departamento</dt><dd>{{ collaborator.departamento?.nombre || 'Sin departamento' }}</dd></div>
          <div class="detail-item"><dt>Localidad</dt><dd>{{ collaborator.localidad || '—' }}</dd></div>
          <div class="detail-item"><dt>Creado</dt><dd>{{ collaborator.creadoEn | date: 'dd-MM-yyyy HH:mm' }}</dd></div>
        </dl>
      </section>

      @if (inventory(); as inventoryData) {
        <section class="custody-summary" aria-label="Resumen del inventario conciliado">
          <div><span>Dispositivo vigente</span><strong>{{ inventoryData.actuales.length }}</strong></div>
          <div><span>Valor actual en custodia</span><strong>{{ clp(inventoryData.valorTotalActual) }}</strong></div>
          <div class="summary-warning"><span>Pendientes / conflictos</span><strong>{{ inventoryData.pendientes.length }}</strong></div>
        </section>

        @if (!inventoryData.actuales.length && !inventoryData.historicos.length && !inventoryData.pendientes.length) {
          <section class="card"><app-view-state kind="empty" title="Sin dispositivos vinculados" message="No existe evidencia de dispositivos asociada a este RUT en las tablas actuales." /></section>
        } @else {
          <section class="card collaborator-assets current-assets">
            <header><div><span>CUSTODIA CONCILIADA</span><h2>Dispositivo vigente</h2><p>Activo vigente o actual probable según la evidencia disponible.</p></div></header>
            @if (!inventoryData.actuales.length) {
              <app-view-state kind="empty" title="Sin dispositivo vigente confirmado" />
            } @else {
              <div class="table-wrap"><table class="data-table reconciled-table"><thead><tr>
                <th>Código ITAM</th><th>Marca / modelo</th><th>IMEI o serie</th><th>Fecha de asignación</th><th>Estado</th><th>Clasificación</th><th>Motivo</th>
              </tr></thead><tbody>
                @for (asset of inventoryData.actuales; track asset.dispositivoId) { <tr>
                  <td><a [routerLink]="['/dispositivos', asset.codigoItam]">{{ asset.codigoItam }}</a></td>
                  <td><strong>{{ asset.marca || asset.tipoDispositivo }} {{ asset.modelo || '' }}</strong><span class="cell-secondary">{{ asset.tipoDispositivo }}</span></td>
                  <td><span class="identity-label">{{ identifier(asset).label }}</span><span class="code">{{ identifier(asset).value }}</span></td>
                  <td>{{ asset.fechaAsignacion | date: 'dd/MM/yyyy' }}</td>
                  <td><app-status-badge [code]="asset.estadoOriginal.codigo" [label]="asset.estadoOriginal.nombre" /></td>
                  <td><span class="reconciliation-badge current">{{ label(asset.clasificacionConciliada) }}</span></td>
                  <td class="reason-cell">{{ asset.motivoConciliacion }}</td>
                </tr> }
              </tbody></table></div>
            }
          </section>

          <section class="card collaborator-assets historical-assets">
            <header><div><span>TRAZABILIDAD</span><h2>Historial de dispositivos</h2><p>Equipos que el colaborador tuvo anteriormente, sin convertirlos en custodia vigente.</p></div></header>
            @if (!inventoryData.historicos.length) {
              <app-view-state kind="empty" title="Sin dispositivos históricos" />
            } @else {
              <div class="table-wrap"><table class="data-table reconciled-table"><thead><tr>
                <th>Código ITAM</th><th>Marca / modelo</th><th>IMEI o serie</th><th>Fecha de asignación</th><th>Fecha de salida</th><th>Motivo histórico</th><th>Clasificación</th>
              </tr></thead><tbody>
                @for (asset of inventoryData.historicos; track asset.dispositivoId) { <tr>
                  <td><a [routerLink]="['/dispositivos', asset.codigoItam]">{{ asset.codigoItam }}</a></td>
                  <td><strong>{{ asset.marca || asset.tipoDispositivo }} {{ asset.modelo || '' }}</strong><span class="cell-secondary">{{ asset.tipoDispositivo }}</span></td>
                  <td><span class="identity-label">{{ identifier(asset).label }}</span><span class="code">{{ identifier(asset).value }}</span></td>
                  <td>{{ asset.fechaAsignacion | date: 'dd/MM/yyyy' }}</td>
                  <td>{{ asset.fechaSalida ? (asset.fechaSalida | date: 'dd/MM/yyyy') : 'Sin salida registrada' }}</td>
                  <td class="reason-cell">{{ asset.motivoConciliacion }}</td>
                  <td><span class="reconciliation-badge historical">{{ label(asset.clasificacionConciliada) }}</span></td>
                </tr> }
              </tbody></table></div>
            }
          </section>

          <section class="card collaborator-assets pending-assets">
            <header><div><span>CONTROL MANUAL</span><h2>Pendientes / conflictos</h2><p>Evidencia insuficiente o contradictoria que no debe resolverse automáticamente.</p></div></header>
            @if (!inventoryData.pendientes.length) {
              <app-view-state kind="empty" title="Sin pendientes ni conflictos" />
            } @else {
              <div class="table-wrap"><table class="data-table reconciled-table pending-table"><thead><tr>
                <th>Código ITAM / evidencia</th><th>Equipo</th><th>Problema detectado</th><th>Motivo</th><th>Acción sugerida</th>
              </tr></thead><tbody>
                @for (asset of inventoryData.pendientes; track asset.dispositivoId) { <tr>
                  <td><a [routerLink]="['/dispositivos', asset.codigoItam]">{{ asset.codigoItam }}</a><span class="cell-secondary">{{ identifier(asset).value }}</span></td>
                  <td><strong>{{ asset.marca || asset.tipoDispositivo }} {{ asset.modelo || '' }}</strong><span class="cell-secondary">{{ asset.tipoDispositivo }}</span></td>
                  <td><span class="reconciliation-badge" [class.conflict]="asset.clasificacionConciliada === 'CONFLICTO_DATOS'" [class.pending]="asset.clasificacionConciliada === 'PENDIENTE_VALIDACION'">{{ label(asset.clasificacionConciliada) }}</span></td>
                  <td class="reason-cell">{{ asset.motivoConciliacion }}</td>
                  <td>{{ action(asset.clasificacionConciliada) }}</td>
                </tr> }
              </tbody></table></div>
            }
          </section>
        }
      }
    }
  `,
  styles: [`
    .detail-card{padding:1.4rem}.detail-title{align-items:center;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between;margin-bottom:1.2rem;padding-bottom:1.2rem}.detail-title>div{align-items:center;display:flex;gap:.8rem}.detail-title h2{font-size:1.2rem;margin:0}.detail-title p{color:var(--color-muted);margin:.2rem 0 0}.initial{align-items:center;background:var(--color-primary-soft);border-radius:.7rem;color:var(--color-primary);display:flex;font-size:1.15rem;font-weight:850;height:2.8rem;justify-content:center;width:2.8rem}
    .custody-summary{display:grid;gap:1rem;grid-template-columns:repeat(3,minmax(0,1fr));margin:1rem 0}.custody-summary>div{background:var(--navy);border-bottom:3px solid var(--cyan);border-radius:1rem;color:#fff;padding:1.2rem}.custody-summary .summary-warning{border-bottom-color:#f59e0b}.custody-summary span{display:block;font-size:.75rem}.custody-summary strong{display:block;font-size:1.5rem;margin-top:.3rem}
    .collaborator-assets{margin-top:1rem;overflow:hidden}.collaborator-assets header{border-left:4px solid var(--cyan);padding:1rem 1.2rem}.historical-assets header{border-left-color:var(--blue)}.pending-assets header{border-left-color:#f59e0b}.collaborator-assets header span{color:var(--blue);font-size:.68rem;font-weight:800;letter-spacing:.05em}.collaborator-assets h2{font-size:1.05rem;margin:.2rem 0 0}.collaborator-assets header p{color:var(--slate-500);font-size:.76rem;margin:.25rem 0 0}.reconciled-table{min-width:1050px}.pending-table{min-width:900px}.identity-label{color:var(--slate-500);display:block;font-size:.68rem;font-weight:700;text-transform:uppercase}.code{display:block;margin-top:.2rem}.reason-cell{color:var(--slate-700);font-size:.76rem;line-height:1.4;max-width:24rem}.reconciliation-badge{border-radius:999px;display:inline-flex;font-size:.7rem;font-weight:800;line-height:1.2;padding:.35rem .55rem}.reconciliation-badge.current{background:#dbeafe;color:#1e40af}.reconciliation-badge.historical{background:#e2e8f0;color:#334155}.reconciliation-badge.pending{background:#fef3c7;color:#92400e}.reconciliation-badge.conflict{background:#fee2e2;color:#991b1b}
    @media(max-width:767px){.detail-title{align-items:flex-start;gap:1rem}.custody-summary{grid-template-columns:1fr}.collaborator-assets header{padding:.9rem 1rem}}
  `],
})
export class ColaboradorDetail implements OnInit {
  private readonly service = inject(ColaboradoresService);
  private readonly route = inject(ActivatedRoute);
  protected readonly item = signal<Colaborador | null>(null);
  protected readonly inventory = signal<InventarioConciliadoColaborador | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly clp = formatClp;
  protected readonly rut = formatRut;
  protected readonly identifier = assetIdentifier;
  protected readonly label = reconciliationLabel;
  protected readonly action = suggestedValidationAction;

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') || '';
    forkJoin({ person: this.service.obtener(id), inventory: this.service.inventarioConciliado(id) }).subscribe({
      next: (result) => { this.item.set(result.person); this.inventory.set(result.inventory); this.loading.set(false); },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); },
    });
  }
}
