import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Estado, Sim } from '../../core/models/itam.models';
import { EstadosService } from '../../core/services/estados.service';
import { SimService } from '../../core/services/sim.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-sim-list',
  imports: [FormsModule, RouterLink, PageHeader, StatusBadge, ViewState],
  template: `
    <app-page-header title="Tarjetas SIM" subtitle="Lineas corporativas, asignaciones y asociacion con dispositivos.">
      <a class="btn btn--primary" routerLink="nuevo">+ Nueva SIM</a>
    </app-page-header>
    <section class="card">
      <div class="toolbar">
        <div class="field"><label for="q">Buscar</label><input id="q" [(ngModel)]="query" placeholder="Codigo, ICCID, numero o compania" /></div>
        <div class="field">
          <label for="state">Estado</label>
          <select id="state" [(ngModel)]="state">
            <option value="">Todos</option>
            @for (item of states(); track item.id) { <option [value]="item.codigo">{{ item.nombre }}</option> }
          </select>
        </div>
      </div>
      @if (loading()) {
        <app-view-state kind="loading" title="Cargando tarjetas SIM" />
      } @else if (error()) {
        <app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" />
      } @else if (!filtered().length) {
        <app-view-state kind="empty" title="Sin resultados" message="No hay SIM que coincidan con los filtros." />
      } @else {
        <div class="table-wrap desktop-table">
          <table class="data-table">
            <thead><tr><th>Inventario</th><th>Identificacion</th><th>Compania</th><th>Estado</th><th>Asignacion</th><th>Dispositivo</th><th></th></tr></thead>
            <tbody>
              @for (item of filtered(); track item.id) {
                <tr>
                  <td><a class="asset-link" [routerLink]="[item.codigoInventario]">#{{ item.codigoInventario }}</a></td>
                  <td><span class="cell-primary">{{ item.numeroAsociado || 'Sin numero' }}</span><span class="cell-secondary">ICCID {{ item.iccidCodigoFabrica || 'pendiente de completar' }}</span></td>
                  <td>{{ item.compania || 'Sin compania' }}</td>
                  <td><app-status-badge [code]="item.estado.codigo" [label]="item.estado.nombre" /></td>
                  <td>{{ item.colaborador?.nombre || 'Sin asignar' }}</td>
                  <td>{{ item.dispositivo ? '#' + item.dispositivo.codigoInventario : 'Sin asociar' }}</td>
                  <td><div class="actions"><a class="btn btn--ghost btn--small" [routerLink]="[item.codigoInventario]">Ver</a><a class="btn btn--ghost btn--small" [routerLink]="[item.codigoInventario,'editar']">Editar</a></div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mobile-record-list">
          @for (item of filtered(); track item.id) {
            <article class="mobile-record-card">
              <header class="mobile-record-card__top">
                <div>
                  <a class="mobile-record-card__title code" [routerLink]="[item.codigoInventario]">SIM {{ item.codigoInventario }}</a>
                  <span class="mobile-record-card__subtitle">{{ item.numeroAsociado || 'Sin numero asociado' }}</span>
                </div>
                <app-status-badge [code]="item.estado.codigo" [label]="item.estado.nombre" />
              </header>
              <dl class="mobile-record-card__details">
                <div class="sim-iccid"><dt>ICCID</dt><dd>{{ item.iccidCodigoFabrica || 'Pendiente de completar' }}</dd></div>
                <div><dt>Compania</dt><dd>{{ item.compania || 'Sin compania' }}</dd></div>
                <div><dt>Asignacion</dt><dd>{{ item.colaborador?.nombre || 'Sin asignar' }}</dd></div>
                <div><dt>Dispositivo</dt><dd>{{ item.dispositivo ? 'ITAM ' + item.dispositivo.codigoInventario : 'Sin asociar' }}</dd></div>
              </dl>
              <footer class="mobile-record-card__actions">
                <a class="btn btn--primary" [routerLink]="[item.codigoInventario]">Ver</a>
                <a class="btn btn--secondary" [routerLink]="[item.codigoInventario,'editar']">Editar</a>
              </footer>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [`.asset-link{color:var(--color-primary);font-weight:800;text-decoration:none}.sim-iccid{grid-column:1/-1}.sim-iccid dd{font-family:var(--font-mono);overflow-wrap:anywhere;word-break:break-word}`]
})
export class SimList implements OnInit {
  private readonly service = inject(SimService);
  private readonly estados = inject(EstadosService);
  protected readonly items = signal<Sim[]>([]);
  protected readonly states = signal<Estado[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected query = '';
  protected state = '';

  ngOnInit(): void {
    this.estados.listar('SIM').subscribe({ next: (items) => this.states.set(items) });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.listar().subscribe({
      next: (items) => { this.items.set(items); this.loading.set(false); },
      error: (requestError) => { this.error.set(errorMessage(requestError)); this.loading.set(false); }
    });
  }

  protected filtered(): Sim[] {
    const query = this.query.trim().toLowerCase();
    return this.items().filter((item) =>
      (!this.state || item.estado.codigo === this.state) &&
      (!query ||
        String(item.codigoInventario).includes(query) ||
        item.iccidCodigoFabrica?.toLowerCase().includes(query) ||
        (item.numeroAsociado || '').toLowerCase().includes(query) ||
        (item.compania || '').toLowerCase().includes(query))
    );
  }
}
