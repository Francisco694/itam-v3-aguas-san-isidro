import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideCamera, LucideDownload, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal } from '@lucide/angular';
import { catchError, forkJoin, of } from 'rxjs';
import { Departamento, Dispositivo, Estado, TipoDispositivo } from '../../core/models/itam.models';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { EstadosService } from '../../core/services/estados.service';
import { SimService } from '../../core/services/sim.service';
import { ToastService } from '../../core/services/toast.service';
import { TiposDispositivoService } from '../../core/services/tipos-dispositivo.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { QrScanner } from '../../shared/components/qr-scanner/qr-scanner';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { RutPipe } from '../../shared/pipes/rut.pipe';
import type { ItamQrTarget } from '../../shared/utils/itam-qr';
import { errorMessage } from '../../shared/utils/error-message';

export const quickSearchMode = (query: string): 'DEVICE_CODE' | 'FILTER' | 'EMPTY' => {
  const normalized = query.trim();
  if (!normalized) return 'EMPTY';
  return /^\d+$/.test(normalized) ? 'DEVICE_CODE' : 'FILTER';
};

export const inventoryStateCount = (
  items: readonly Pick<Dispositivo, 'estado'>[],
  code: string
): number => code ? items.filter((item) => item.estado.codigo === code).length : items.length;

@Component({
  selector: 'app-dispositivos-list',
  imports: [FormsModule, RouterLink, PageHeader, QrScanner, StatusBadge, ViewState, RutPipe, LucideCamera, LucideDownload, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal],
  template: `
    <app-page-header title="Inventario de Equipos" subtitle="Control fÃ­sico, custodias y condiciÃ³n operativa de los activos.">
      <button class="btn btn--navy mobile-qr-action" type="button" (click)="scannerOpen.set(true)"><svg lucideCamera></svg> Escanear QR</button>
      <a class="btn btn--primary inventory-new-action" routerLink="nuevo"><svg lucidePlus></svg> Nuevo activo</a>
      <button class="btn btn--secondary inventory-export-action" type="button" [disabled]="!items().length" (click)="exportCsv()"><svg lucideDownload></svg> Exportar CSV</button>
    </app-page-header>
    <section class="scan-card" aria-labelledby="scan-title">
      <div class="scan-card__icon"><svg lucideScanBarcode></svg></div>
      <form class="scan-card__form" (ngSubmit)="quickSearch()">
        <label id="scan-title" for="asset-search"><span class="desktop-copy">Escanear con Pistola USB o Digitar CÃ³digo</span><span class="mobile-copy">Buscar activo</span></label>
        <div class="scan-input"><svg lucideSearch aria-hidden="true"></svg><input id="asset-search" name="assetSearch" [(ngModel)]="quickQuery" (keydown.enter)="$event.preventDefault(); quickSearch()" autocomplete="off" inputmode="search" placeholder="CÃ³digo de inventario, serie, marca o modelo..." /><button class="btn btn--primary" type="submit" [disabled]="quickLoading()">{{ quickLoading() ? 'Buscandoâ€¦' : 'Buscar' }}</button></div>
        <p><span class="desktop-copy">Los lectores USB funcionan como teclado: escanee el activo y presione Enter.</span><span class="mobile-copy">TambiÃ©n puede utilizar un lector USB como teclado.</span></p>
      </form>
      <button class="camera-button" type="button" (click)="scannerOpen.set(true)"><svg lucideCamera></svg><span>Escanear QR<small>Usar camara</small></span></button>
    </section>
    @if (scannerOpen()) {
      <app-qr-scanner
        (scanned)="openScannedAsset($event)"
        (cancelled)="scannerOpen.set(false)"
      />
    }
    <nav class="state-shortcuts" aria-label="Filtros rÃ¡pidos por estado">
      @for(shortcut of shortcuts;track shortcut.code){<button type="button" [class.active]="filters.estado===shortcut.code" (click)="selectState(shortcut.code)"><span>{{shortcut.label}}</span><strong>{{stateCount(shortcut.code)}}</strong></button>}
    </nav>
    <button
      class="advanced-filter-toggle"
      type="button"
      aria-controls="inventory-filters"
      [attr.aria-expanded]="filtersOpen()"
      (click)="filtersOpen.update((open) => !open)"
    >
      <svg lucideSlidersHorizontal></svg>
      {{ filtersOpen() ? 'Ocultar filtros' : 'Filtros avanzados' }}
    </button>
    <section class="card inventory-card">
      <form id="inventory-filters" class="filter-panel" [class.filter-panel--open]="filtersOpen()" (ngSubmit)="load()">
        <div class="filter-panel__title"><svg lucideSlidersHorizontal></svg><strong>Filtros del inventario</strong></div>
        <div class="field filter-search"><label for="q">BÃºsqueda general</label><input id="q" name="q" [(ngModel)]="filters.q" placeholder="CÃ³digo, serie, marca o modelo" /></div>
        <div class="field"><label for="tipo">Tipo</label><select id="tipo" name="tipo" [(ngModel)]="filters.tipoDispositivoId"><option value="">Todos</option>@for(type of types(); track type.id){<option [value]="type.id">{{ type.nombre }}</option>}</select></div>
        <div class="field"><label for="estado">Estado</label><select id="estado" name="estado" [(ngModel)]="filters.estado"><option value="">Todos</option>@for(e of states(); track e.id){<option [value]="e.codigo">{{ e.nombre }}</option>}</select></div>
        <div class="field"><label for="department">Departamento</label><select id="department" name="department" [(ngModel)]="filters.departamentoId"><option value="">Todos</option>@for(d of departments(); track d.id){<option [value]="d.id">{{ d.nombre }}</option>}</select></div>
        <div class="field"><label for="location">Localidad</label><input id="location" name="location" [(ngModel)]="filters.localidad" /></div>
        <div class="filter-panel__actions"><button class="btn btn--primary" type="submit">Aplicar</button><button class="btn btn--ghost" type="button" (click)="clear()">Limpiar</button></div>
      </form>
      @if (loading()) { <app-view-state kind="loading" title="Cargando dispositivos" message="Consultando el inventario realâ€¦" /> }
      @else if (error()) { <app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" /> }
      @else if (!items().length) { <div class="empty-with-action"><app-view-state kind="empty" [title]="emptyTitle()" [message]="emptyMessage()" />@if(!allItems().length){<a class="btn btn--primary" routerLink="nuevo"><svg lucidePlus></svg> Registrar dispositivo</a>}</div> }
      @else {
        <div class="table-heading"><div><strong>{{ items().length }}</strong><span>{{ items().length === 1 ? 'activo encontrado' : 'activos encontrados' }}</span></div></div>
        <div class="table-wrap desktop-table"><table class="data-table inventory-table"><thead><tr><th>ID / CÃ³digo</th><th>Equipo</th><th>Estado</th><th>Responsable</th><th>UbicaciÃ³n</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
          @for(item of items(); track item.id){<tr><td><a class="asset-code-link" [routerLink]="[item.codigoInventario]">{{ item.codigoInventario }}</a><span class="cell-secondary mono">{{ identifier(item) }}</span></td><td><span class="cell-primary">{{ item.marca || item.tipo.nombre }} {{ item.modelo || '' }}</span><span class="cell-secondary">{{ item.tipo.nombre }}</span></td><td><app-status-badge [code]="item.estado.codigo" [label]="item.estado.nombre" /></td><td><span class="cell-primary">{{ custody(item) }}</span><span class="cell-secondary">{{ item.colaborador ? (item.colaborador.rut | rut) : (item.departamento?.nombre || 'Sin custodia vigente') }}</span></td><td>{{ item.localidad || 'â€”' }}<span class="cell-secondary">{{ item.ubicacionDetalle || '' }}</span></td><td><div class="actions"><a class="btn btn--secondary btn--small" [routerLink]="[item.codigoInventario]">Gestionar ficha</a><a class="btn btn--ghost btn--small" [routerLink]="[item.codigoInventario,'editar']">Editar</a></div></td></tr>}
        </tbody></table></div>
        <div class="mobile-record-list inventory-mobile-list">
          @for(item of items(); track item.id) {
            <article class="mobile-record-card">
              <header class="mobile-record-card__top">
                <div>
                  <a class="mobile-record-card__title code" [routerLink]="[item.codigoInventario]">ITAM {{ item.codigoInventario }}</a>
                  <span class="mobile-record-card__subtitle">{{ item.marca || item.tipo.nombre }} {{ item.modelo || '' }}</span>
                  <span class="mobile-record-card__subtitle">{{ item.tipo.nombre }} &middot; {{ identifier(item) }}</span>
                </div>
                <app-status-badge [code]="item.estado.codigo" [label]="item.estado.nombre" />
              </header>
              <dl class="mobile-record-card__details">
                <div><dt>Responsable</dt><dd>{{ custody(item) }}</dd></div>
                <div><dt>Ubicaci&oacute;n</dt><dd>{{ item.localidad || item.ubicacionDetalle || 'Sin ubicaci&oacute;n' }}</dd></div>
              </dl>
              <footer class="mobile-record-card__actions">
                <a class="btn btn--primary" [routerLink]="[item.codigoInventario]">Gestionar</a>
                <a class="btn btn--secondary" [routerLink]="[item.codigoInventario,'editar']">Editar</a>
              </footer>
            </article>
          }
        </div>
      }
    </section>
  `,
  styleUrl: './dispositivos-list.scss'
})
export class DispositivosList implements OnInit {
  private readonly service = inject(DispositivosService);
  private readonly simService = inject(SimService);
  private readonly estados = inject(EstadosService);
  private readonly deptService = inject(DepartamentosService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly typeService = inject(TiposDispositivoService);
  protected readonly items = signal<Dispositivo[]>([]);
  protected readonly states = signal<Estado[]>([]);
  protected readonly departments = signal<Departamento[]>([]);
  protected readonly types = signal<TipoDispositivo[]>([]);
  protected readonly allItems = signal<Dispositivo[]>([]);
  protected readonly shortcuts=[{code:'',label:'Todos'},{code:'DISPONIBLE',label:'Disponibles'},{code:'ASIGNADO',label:'Asignados'},{code:'SERVICIO_TECNICO',label:'Servicio TÃ©cnico'},{code:'EXTRAVIADO',label:'Extraviados'},{code:'DADO_BAJA',label:'Dados de Baja'}];
  protected readonly loading = signal(true);
  protected readonly quickLoading = signal(false);
  protected readonly scannerOpen = signal(false);
  protected readonly filtersOpen = signal(false);
  protected readonly error = signal('');
  protected quickQuery = '';
  protected filters = { q: '', tipoDispositivoId: '', estado: '', departamentoId: '', localidad: '' };

  ngOnInit(): void {
    this.filters.estado=this.route.snapshot.queryParamMap.get('estado')||'';
    this.estados.listar('DISPOSITIVO').subscribe({ next: (items) => this.states.set(items) });
    this.deptService.listar().subscribe({ next: (items) => this.departments.set(items) });
    this.typeService.listar().subscribe({ next: (items) => this.types.set(items) });
    this.service.listar().subscribe({next:items=>this.allItems.set(items)});
    this.load();
  }
  protected stateCount(code:string):number{return inventoryStateCount(this.allItems(),code);}
  protected selectState(code:string):void{this.filters.estado=code;void this.router.navigate([], {relativeTo:this.route,queryParams:{estado:code||null},queryParamsHandling:'merge',replaceUrl:true});this.load();}
  protected quickSearch(): void {
    const query = this.quickQuery.trim();
    const mode = quickSearchMode(query);
    if (mode === 'EMPTY') return;
    if (mode === 'DEVICE_CODE') {
      this.quickLoading.set(true);
      this.service.obtener(Number(query)).subscribe({ next: (item) => { this.quickLoading.set(false); void this.router.navigate(['/dispositivos', item.codigoInventario]); }, error: (error) => { this.quickLoading.set(false); this.toast.error('Activo no encontrado', errorMessage(error)); } });
      return;
    }
    this.filters.q = query;
    this.load();
  }
  protected openScannedAsset(target: ItamQrTarget): void {
    this.scannerOpen.set(false);
    this.quickLoading.set(true);
    const notFound = () => {
      this.quickLoading.set(false);
      this.toast.error(
        'CÃ³digo ITAM no encontrado',
        'El cÃ³digo ITAM leÃ­do no corresponde a un registro existente.'
      );
    };
    if (target.entity === 'SIM') {
      this.simService.obtener(target.code).subscribe({
        next: (item) => {
          this.quickLoading.set(false);
          void this.router.navigate(['/sim', item.codigoInventario]);
        },
        error: notFound
      });
      return;
    }
    if (target.entity === 'DISPOSITIVO') {
      this.service.obtener(target.code).subscribe({
        next: (item) => {
          this.quickLoading.set(false);
          void this.router.navigate(['/dispositivos', item.codigoInventario]);
        },
        error: notFound
      });
      return;
    }
    forkJoin({
      device: this.service.obtener(target.code).pipe(catchError(() => of(null))),
      sim: this.simService.obtener(target.code).pipe(catchError(() => of(null)))
    }).subscribe(({ device, sim }) => {
      this.quickLoading.set(false);
      if (device && !sim) {
        void this.router.navigate(['/dispositivos', device.codigoInventario]);
        return;
      }
      if (sim && !device) {
        void this.router.navigate(['/sim', sim.codigoInventario]);
        return;
      }
      notFound();
    });
  }
  protected load(): void {
    this.loading.set(true); this.error.set('');
    this.service.listar({ q: this.filters.q || undefined, tipoDispositivoId: this.filters.tipoDispositivoId ? Number(this.filters.tipoDispositivoId) : undefined, estado: this.filters.estado || undefined, departamentoId: this.filters.departamentoId ? Number(this.filters.departamentoId) : undefined, localidad: this.filters.localidad || undefined }).subscribe({ next: (items) => { this.items.set(items); this.loading.set(false); }, error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); } });
  }
  protected clear(): void { this.quickQuery = ''; this.filters = { q: '', tipoDispositivoId: '', estado: '', departamentoId: '', localidad: '' }; this.load(); }
  protected identifier(item: Dispositivo): string {
    if (item.tipo.requiereImei || item.tipo.nombre.toUpperCase() === 'SMARTPHONE') {
      return item.imei ? `IMEI: ${item.imei}` : 'Sin IMEI registrado';
    }
    return item.numeroSerie ? `NÃ‚Â° de serie: ${item.numeroSerie}` : 'Sin nÃƒÂºmero de serie registrado';
  }
  protected custody(item: Dispositivo): string { return item.colaborador?.nombre || item.departamento?.nombre || 'Sin responsable'; }
  protected exportCsv():void {
    const headers=['CÃ³digo ITAM','Tipo','Marca','Modelo','NÃºmero de serie','IMEI','Estado','Custodio','Departamento','Dependencia','UbicaciÃ³n','Valor comercial','Fecha registro'];
    const rows=this.items().map((item)=>{
      const departmentId=item.departamento?.id||item.colaborador?.departamento?.id;
      const department=departmentId?this.departments().find((candidate)=>candidate.id===departmentId):undefined;
      return [item.codigoInventario,item.tipo.nombre,item.marca,item.modelo,item.numeroSerie,item.imei,item.estado.nombre,this.custody(item),department?.nombre,department?.dependencia_nombre,item.localidad||item.ubicacionDetalle,item.valorComercial,item.fechaRegistro];
    });
    const escape=(value:unknown):string=>'"'+String(value??'').replace(/"/g,'""')+'"';
    const csv='\uFEFF'+[headers,...rows].map((row)=>row.map(escape).join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download='inventario-itam-'+new Date().toISOString().slice(0,10)+'.csv';link.click();URL.revokeObjectURL(url);
  }
  protected emptyTitle():string {
    if(!this.allItems().length)return 'No hay dispositivos registrados';
    if(this.hasCombinedFilters())return 'Sin resultados para los filtros aplicados';
    return ({DISPONIBLE:'No hay dispositivos disponibles',ASIGNADO:'No hay dispositivos asignados',SERVICIO_TECNICO:'No hay equipos en servicio tÃ©cnico',EXTRAVIADO:'No hay dispositivos extraviados',DADO_BAJA:'No hay dispositivos dados de baja'} as Record<string,string>)[this.filters.estado]||'Sin resultados para los filtros aplicados';
  }
  protected emptyMessage():string {
    if(!this.allItems().length)return 'AÃºn no se han ingresado activos al sistema.';
    if(this.hasCombinedFilters())return 'No existen dispositivos que coincidan con esta combinaciÃ³n de filtros.';
    if(this.filters.estado==='DISPONIBLE')return 'Existen activos registrados, pero ninguno se encuentra disponible actualmente.';
    return 'No existen activos en este estado actualmente.';
  }
  private hasCombinedFilters():boolean {
    return Boolean(this.filters.q||this.filters.tipoDispositivoId||this.filters.departamentoId||this.filters.localidad);
  }
}
