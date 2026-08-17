import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LucideCamera, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal } from '@lucide/angular';
import { Departamento, Dispositivo, Estado, TipoDispositivo } from '../../core/models/itam.models';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { EstadosService } from '../../core/services/estados.service';
import { ToastService } from '../../core/services/toast.service';
import { TiposDispositivoService } from '../../core/services/tipos-dispositivo.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-dispositivos-list',
  imports: [FormsModule, RouterLink, PageHeader, StatusBadge, ViewState, LucideCamera, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal],
  template: `
    <app-page-header title="Inventario de Equipos" subtitle="Control físico, custodias y condición operativa de los activos.">
      <a class="btn btn--primary" routerLink="nuevo"><svg lucidePlus></svg> Nuevo Equipo</a>
    </app-page-header>
    <section class="scan-card" aria-labelledby="scan-title">
      <div class="scan-card__icon"><svg lucideScanBarcode></svg></div>
      <form class="scan-card__form" (ngSubmit)="quickSearch()">
        <label id="scan-title" for="asset-search">Escanear con Pistola USB o Digitar Código</label>
        <div class="scan-input"><svg lucideSearch aria-hidden="true"></svg><input id="asset-search" name="assetSearch" [(ngModel)]="quickQuery" autocomplete="off" inputmode="search" placeholder="Código de inventario, serie, marca o modelo..." /><button class="btn btn--primary" type="submit" [disabled]="quickLoading()">{{ quickLoading() ? 'Buscando…' : 'Buscar' }}</button></div>
        <p>Los lectores USB funcionan como teclado: escanee el activo y presione Enter.</p>
      </form>
      <button class="camera-button" type="button" disabled title="Lectura mediante cámara pendiente de implementación real"><svg lucideCamera></svg><span>Cámara<small>Próximamente</small></span></button>
    </section>
    <section class="card inventory-card">
      <form class="filter-panel" (ngSubmit)="load()">
        <div class="filter-panel__title"><svg lucideSlidersHorizontal></svg><strong>Filtros del inventario</strong></div>
        <div class="field"><label for="q">Búsqueda general</label><input id="q" name="q" [(ngModel)]="filters.q" placeholder="Código, serie, marca o modelo" /></div>
        <div class="field"><label for="tipo">Tipo</label><select id="tipo" name="tipo" [(ngModel)]="filters.tipoDispositivoId"><option value="">Todos</option>@for(type of types(); track type.id){<option [value]="type.id">{{ type.nombre }}</option>}</select></div>
        <div class="field"><label for="estado">Estado</label><select id="estado" name="estado" [(ngModel)]="filters.estado"><option value="">Todos</option>@for(e of states(); track e.id){<option [value]="e.codigo">{{ e.nombre }}</option>}</select></div>
        <div class="field"><label for="department">Departamento</label><select id="department" name="department" [(ngModel)]="filters.departamentoId"><option value="">Todos</option>@for(d of departments(); track d.id){<option [value]="d.id">{{ d.nombre }}</option>}</select></div>
        <div class="field"><label for="location">Localidad</label><input id="location" name="location" [(ngModel)]="filters.localidad" /></div>
        <div class="filter-panel__actions"><button class="btn btn--primary" type="submit">Aplicar</button><button class="btn btn--ghost" type="button" (click)="clear()">Limpiar</button></div>
      </form>
      @if (loading()) { <app-view-state kind="loading" title="Cargando dispositivos" message="Consultando el inventario real…" /> }
      @else if (error()) { <app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" /> }
      @else if (!items().length) { <div class="empty-with-action"><app-view-state kind="empty" title="No hay dispositivos registrados" message="No existen activos que coincidan con los filtros aplicados." /><a class="btn btn--primary" routerLink="nuevo"><svg lucidePlus></svg> Registrar dispositivo</a></div> }
      @else {
        <div class="table-heading"><div><strong>{{ items().length }}</strong><span>{{ items().length === 1 ? 'activo encontrado' : 'activos encontrados' }}</span></div></div>
        <div class="table-wrap"><table class="data-table inventory-table"><thead><tr><th>ID / Código</th><th>Equipo</th><th>Estado</th><th>Responsable</th><th>Ubicación</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
          @for(item of items(); track item.id){<tr><td><a class="asset-code-link" [routerLink]="[item.codigoInventario]">{{ item.codigoInventario }}</a><span class="cell-secondary mono">{{ item.numeroSerie ? 'SN: ' + item.numeroSerie : 'Sin serie' }}</span></td><td><span class="cell-primary">{{ item.marca || item.tipo.nombre }} {{ item.modelo || '' }}</span><span class="cell-secondary">{{ item.tipo.nombre }}</span></td><td><app-status-badge [code]="item.estado.codigo" [label]="item.estado.nombre" /></td><td><span class="cell-primary">{{ custody(item) }}</span><span class="cell-secondary">{{ item.colaborador?.rut || item.departamento?.nombre || 'Sin custodia vigente' }}</span></td><td>{{ item.localidad || '—' }}<span class="cell-secondary">{{ item.ubicacionDetalle || '' }}</span></td><td><div class="actions"><a class="btn btn--secondary btn--small" [routerLink]="[item.codigoInventario]">Gestionar ficha</a><a class="btn btn--ghost btn--small" [routerLink]="[item.codigoInventario,'editar']">Editar</a></div></td></tr>}
        </tbody></table></div>
      }
    </section>
  `,
  styleUrl: './dispositivos-list.scss'
})
export class DispositivosList implements OnInit {
  private readonly service = inject(DispositivosService);
  private readonly estados = inject(EstadosService);
  private readonly deptService = inject(DepartamentosService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly typeService = inject(TiposDispositivoService);
  protected readonly items = signal<Dispositivo[]>([]);
  protected readonly states = signal<Estado[]>([]);
  protected readonly departments = signal<Departamento[]>([]);
  protected readonly types = signal<TipoDispositivo[]>([]);
  protected readonly loading = signal(true);
  protected readonly quickLoading = signal(false);
  protected readonly error = signal('');
  protected quickQuery = '';
  protected filters = { q: '', tipoDispositivoId: '', estado: '', departamentoId: '', localidad: '' };

  ngOnInit(): void {
    this.estados.listar('DISPOSITIVO').subscribe({ next: (items) => this.states.set(items) });
    this.deptService.listar().subscribe({ next: (items) => this.departments.set(items) });
    this.typeService.listar().subscribe({ next: (items) => this.types.set(items) });
    this.load();
  }
  protected quickSearch(): void {
    const query = this.quickQuery.trim();
    if (!query) return;
    if (/^\d+$/.test(query)) {
      this.quickLoading.set(true);
      this.service.obtener(Number(query)).subscribe({ next: (item) => { this.quickLoading.set(false); void this.router.navigate(['/dispositivos', item.codigoInventario]); }, error: (error) => { this.quickLoading.set(false); this.toast.error('Activo no encontrado', errorMessage(error)); } });
      return;
    }
    this.filters.q = query;
    this.load();
  }
  protected load(): void {
    this.loading.set(true); this.error.set('');
    this.service.listar({ q: this.filters.q || undefined, tipoDispositivoId: this.filters.tipoDispositivoId ? Number(this.filters.tipoDispositivoId) : undefined, estado: this.filters.estado || undefined, departamentoId: this.filters.departamentoId ? Number(this.filters.departamentoId) : undefined, localidad: this.filters.localidad || undefined }).subscribe({ next: (items) => { this.items.set(items); this.loading.set(false); }, error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); } });
  }
  protected clear(): void { this.filters = { q: '', tipoDispositivoId: '', estado: '', departamentoId: '', localidad: '' }; this.load(); }
  protected custody(item: Dispositivo): string { return item.colaborador?.nombre || item.departamento?.nombre || 'Sin responsable'; }
}
