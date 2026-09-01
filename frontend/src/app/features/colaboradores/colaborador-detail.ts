import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Colaborador, InventarioColaborador } from '../../core/models/itam.models';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { RutPipe } from '../../shared/pipes/rut.pipe';
import { formatClp } from '../../shared/utils/currency';
import { errorMessage } from '../../shared/utils/error-message';

export const custodyValue = (assets: readonly { valorComercial: number }[]): number =>
  assets.reduce((total, asset) => total + asset.valorComercial, 0);

@Component({
  selector: 'app-colaborador-detail',
  imports: [DatePipe, RouterLink, PageHeader, StatusBadge, ViewState, RutPipe],
  template: `
    <app-page-header
      title="Detalle del colaborador"
      subtitle="IdentificaciÃ³n, custodia vigente e historial de equipos."
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
    } @else if (item(); as c) {
      <section class="card detail-card">
        <div class="detail-title">
          <div>
            <span class="initial">{{ c.nombre.charAt(0) }}</span>
            <div>
              <h2>{{ c.nombre }}</h2>
              <p>{{ c.rut | rut }}</p>
            </div>
          </div>
          <app-status-badge [code]="c.activo" [label]="c.activo ? 'Activo' : 'Inactivo'" />
        </div>
        <dl class="detail-grid">
          <div class="detail-item">
            <dt>Cargo</dt>
            <dd>{{ c.cargo || 'â€”' }}</dd>
          </div>
          <div class="detail-item">
            <dt>Departamento</dt>
            <dd>{{ c.departamento?.nombre || 'Sin departamento' }}</dd>
          </div>
          <div class="detail-item">
            <dt>Localidad</dt>
            <dd>{{ c.localidad || 'â€”' }}</dd>
          </div>
          <div class="detail-item">
            <dt>Creado</dt>
            <dd>{{ c.creadoEn | date: 'dd-MM-yyyy HH:mm' }}</dd>
          </div>
        </dl>
      </section>
      @if (inventory(); as inv) {
        <section class="custody-summary">
          <div>
            <span>Equipos actuales</span><strong>{{ inv.equiposActuales.length }}</strong>
          </div>
          <div>
            <span>Valor total en custodia</span
            ><strong>{{ clp(custodyValue(inv.equiposActuales)) }}</strong>
          </div>
        </section>
        <section class="card collaborator-assets">
          <header>
            <div>
              <span>CUSTODIA VIGENTE</span>
              <h2>Equipos actuales</h2>
              <p>Activos que permanecen asignados al colaborador.</p>
            </div>
          </header>
          @if (!inv.equiposActuales.length) {
            <app-view-state kind="empty" title="Sin equipos en custodia" />
          } @else {
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>CÃ³digo ITAM</th>
                    <th>Equipo</th>
                    <th>IMEI / Serie</th>
                    <th>Estado</th>
                    <th>Valor comercial</th>
                  </tr>
                </thead>
                <tbody>
                  @for (asset of inv.equiposActuales; track asset.id) {
                    <tr>
                      <td>
                        <a [routerLink]="['/dispositivos', asset.codigoInventario]">{{
                          asset.codigoInventario
                        }}</a>
                      </td>
                      <td>
                        <strong>{{ asset.tipo }}</strong
                        ><span class="cell-secondary"
                          >{{ asset.marca || 'â€”' }} {{ asset.modelo || '' }}</span
                        >
                      </td>
                      <td class="code">{{ asset.tipo.toUpperCase().includes('SMARTPHONE') ? (asset.imei || 'Sin IMEI registrado') : (asset.numeroSerie || 'Sin serie registrada') }}</td>
                      <td>
                        <app-status-badge
                          [code]="asset.estado.codigo"
                          [label]="asset.estado.nombre"
                        />
                      </td>
                      <td>{{ clp(asset.valorComercial) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
        <section class="card collaborator-assets">
          <header>
            <div>
              <span>TRAZABILIDAD</span>
              <h2>Historial de equipos</h2>
              <p>Asignaciones y devoluciones anteriores, separadas de la custodia actual.</p>
            </div>
          </header>
          @if (!inv.historialEquipos.length) {
            <app-view-state kind="empty" title="Sin asignaciones histÃ³ricas" />
          } @else {
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Activo</th>
                    <th>Fecha de asignaciÃ³n</th>
                    <th>Fecha de devoluciÃ³n</th>
                    <th>Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  @for (
                    event of inv.historialEquipos;
                    track event.codigoInventario + '-' + event.fechaAsignacion
                  ) {
                    <tr>
                      <td>
                        <a [routerLink]="['/dispositivos', event.codigoInventario]"
                          >{{ event.tipo }} {{ event.codigoInventario }}</a
                        >
                      </td>
                      <td>{{ event.fechaAsignacion | date: 'dd/MM/yyyy HH:mm' }}</td>
                      <td>
                        {{
                          event.fechaDevolucion
                            ? (event.fechaDevolucion | date: 'dd/MM/yyyy HH:mm')
                            : 'Actual'
                        }}
                      </td>
                      <td>{{ event.resultado }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
        <section class="card collaborator-assets pending-history">
          <header>
            <div>
              <span>CONCILIACI&Oacute;N</span>
              <h2>Registros hist&oacute;ricos pendientes</h2>
              <p>Evidencias preservadas que todav&iacute;a no identifican un activo f&iacute;sico con certeza.</p>
            </div>
          </header>
          @if (!inv.registrosHistoricosPendientes.length) {
            <app-view-state kind="empty" title="Sin evidencias pendientes" />
          } @else {
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Registro</th><th>Identificador original</th><th>Fecha de entrega</th><th>Estado de conciliaci&oacute;n</th></tr></thead>
                <tbody>
                  @for (record of inv.registrosHistoricosPendientes; track record.id) {
                    <tr>
                      <td><strong>{{ record.tipoActivo || 'Activo sin clasificar' }}</strong><span class="cell-secondary">{{ record.descripcion || 'Sin descripci&oacute;n adicional' }}</span></td>
                      <td class="code">{{ record.imei || record.numeroSerie || 'Activo f&iacute;sico pendiente de identificar' }}</td>
                      <td>{{ record.fechaEntrega ? (record.fechaEntrega | date: 'dd/MM/yyyy') : 'Fecha no documentada' }}</td>
                      <td><strong>{{ record.estadoConciliacion.replaceAll('_', ' ') }}</strong>@if (record.motivo) { <span class="cell-secondary">{{ record.motivo }}</span> }</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      }
    }
  `,  styles: [
    `
      .detail-card {
        padding: 1.4rem;
      }
      .detail-title {
        align-items: center;
        border-bottom: 1px solid var(--color-border);
        display: flex;
        justify-content: space-between;
        margin-bottom: 1.2rem;
        padding-bottom: 1.2rem;
      }
      .detail-title > div {
        align-items: center;
        display: flex;
        gap: 0.8rem;
      }
      .detail-title h2 {
        font-size: 1.2rem;
        margin: 0;
      }
      .detail-title p {
        color: var(--color-muted);
        margin: 0.2rem 0 0;
      }
      .initial {
        align-items: center;
        background: var(--color-primary-soft);
        border-radius: 0.7rem;
        color: var(--color-primary);
        display: flex;
        font-size: 1.15rem;
        font-weight: 850;
        height: 2.8rem;
        justify-content: center;
        width: 2.8rem;
      }
      .custody-summary {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin: 1rem 0;
      }
      .custody-summary > div {
        background: var(--navy);
        border-bottom: 3px solid var(--cyan);
        border-radius: 1rem;
        color: #fff;
        padding: 1.2rem;
      }
      .custody-summary span {
        display: block;
        font-size: 0.75rem;
      }
      .custody-summary strong {
        display: block;
        font-size: 1.5rem;
        margin-top: 0.3rem;
      }
      .collaborator-assets {
        margin-top: 1rem;
        overflow: hidden;
      }
      .collaborator-assets header {
        padding: 1rem 1.2rem;
      }
      .collaborator-assets header span {
        color: var(--blue);
        font-size: 0.68rem;
        font-weight: 800;
      }
      .collaborator-assets h2 {
        font-size: 1.05rem;
        margin: 0.2rem 0 0;
      }
      .collaborator-assets header p {
        color: var(--slate-500);
        font-size: 0.72rem;
        margin: 0.25rem 0 0;
      }
      .pending-history {
        border-left: 4px solid var(--color-warning, #d97706);
      }
      .pending-history .code {
        max-width: 24rem;
        white-space: normal;
      }
    `,
  ],
})
export class ColaboradorDetail implements OnInit {
  private readonly service = inject(ColaboradoresService);
  private readonly route = inject(ActivatedRoute);
  protected readonly item = signal<Colaborador | null>(null);
  protected readonly inventory = signal<InventarioColaborador | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly clp = formatClp;
  protected readonly custodyValue = custodyValue;
  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    forkJoin({
      person: this.service.obtener(id),
      inventory: this.service.inventario(id),
    }).subscribe({
      next: (r) => {
        this.item.set(r.person);
        this.inventory.set(r.inventory);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
