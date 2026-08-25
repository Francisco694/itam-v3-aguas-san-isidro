import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideCamera, LucideDownload, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal } from '@lucide/angular';
import { Departamento, Dispositivo, Estado, TipoDispositivo } from '../../core/models/itam.models';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { EstadosService } from '../../core/services/estados.service';
import { ToastService } from '../../core/services/toast.service';
import { TiposDispositivoService } from '../../core/services/tipos-dispositivo.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { QrScanner } from '../../shared/components/qr-scanner/qr-scanner';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
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
  imports: [FormsModule, RouterLink, PageHeader, QrScanner, StatusBadge, ViewState, LucideCamera, LucideDownload, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal],
  template: `
    <app-page-header title="Inventario de Equipos" subtitle="Control físico, custodias y condición operativa de los activos.">
      <button class="btn btn--secondary" type="button" [disabled]="!items().length" (click)="exportCsv()"><svg lucideDownload></svg> Exportar CSV</button>
      <a class="btn btn--primary" routerLink="nuevo"><svg lucidePlus></svg> Nuevo Equipo</a>
    </app-page-header>
    <section class="scan-card" aria-labelledby="scan-title">
      <div class="scan-card__icon"><svg lucideScanBarcode></svg></div>
      <form class="scan-card__form" (ngSubmit)="quickSearch()">
        <label id="scan-title" for="asset-search">Escanear con Pistola USB o Digitar Código</label>
        <div class="scan-input"><svg lucideSearch aria-hidden="true"></svg><input id="asset-search" name="assetSearch" [(ngModel)]="quickQuery" (keydown.enter)="$event.preventDefault(); quickSearch()" autocomplete="off" inputmode="search" placeholder="Código de inventario, serie, marca o modelo..." /><button class="btn btn--primary" type="submit" [disabled]="quickLoading()">{{ quickLoading() ? 'Buscando…' : 'Buscar' }}</button></div>
        <p>Los lectores USB funcionan como teclado: escanee el activo y presione Enter.</p>
      </form>
      <button class="camera-button" type="button" (click)="scannerOpen.set(true)"><svg lucideCamera></svg><span>Escanear QR<small>Usar camara</small></span></button>
    </section>
    @if (scannerOpen()) {
      <app-qr-scanner
        (scanned)="openScannedAsset($event)"
        (cancelled)="scannerOpen.set(false)"
      />
    }
    <nav class="state-shortcuts" aria-label="Filtros rápidos por estado">
      @for(shortcut of shortcuts;track shortcut.code){<button type="button" [class.active]="filters.estado===shortcut.code" (click)="selectState(shortcut.code)"><span>{{shortcut.label}}</span><strong>{{stateCount(shortcut.code)}}</strong></button>}
    </nav>
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
      @else if (!items().length) { <div class="empty-with-action"><app-view-state kind="empty" [title]="emptyTitle()" [message]="emptyMessage()" />@if(!allItems().length){<a class="btn btn--primary" routerLink="nuevo"><svg lucidePlus></svg> Registrar dispositivo</a>}</div> }
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
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly typeService = inject(TiposDispositivoService);
  protected readonly items = signal<Dispositivo[]>([]);
  protected readonly states = signal<Estado[]>([]);
  protected readonly departments = signal<Departamento[]>([]);
  protected readonly types = signal<TipoDispositivo[]>([]);
  protected readonly allItems = signal<Dispositivo[]>([]);
  protected readonly shortcuts=[{code:'',label:'Todos'},{code:'DISPONIBLE',label:'Disponibles'},{code:'ASIGNADO',label:'Asignados'},{code:'SERVICIO_TECNICO',label:'Servicio Técnico'},{code:'EXTRAVIADO',label:'Extraviados'},{code:'DADO_BAJA',label:'Dados de Baja'}];
  protected readonly loading = signal(true);
  protected readonly quickLoading = signal(false);
  protected readonly scannerOpen = signal(false);
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
  protected openScannedAsset(code: number): void {
    this.scannerOpen.set(false);
    this.quickLoading.set(true);
    this.service.obtener(code).subscribe({
      next: (item) => {
        this.quickLoading.set(false);
        void this.router.navigate(['/dispositivos', item.codigoInventario]);
      },
      error: (requestError) => {
        this.quickLoading.set(false);
        this.toast.error('Activo no encontrado', errorMessage(requestError));
      }
    });
  }
  protected load(): void {
    this.loading.set(true); this.error.set('');
    this.service.listar({ q: this.filters.q || undefined, tipoDispositivoId: this.filters.tipoDispositivoId ? Number(this.filters.tipoDispositivoId) : undefined, estado: this.filters.estado || undefined, departamentoId: this.filters.departamentoId ? Number(this.filters.departamentoId) : undefined, localidad: this.filters.localidad || undefined }).subscribe({ next: (items) => { this.items.set(items); this.loading.set(false); }, error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); } });
  }
  protected clear(): void { this.filters = { q: '', tipoDispositivoId: '', estado: '', departamentoId: '', localidad: '' }; this.load(); }
  protected custody(item: Dispositivo): string { return item.colaborador?.nombre || item.departamento?.nombre || 'Sin responsable'; }
  protected exportCsv():void {
    const headers=['Código ITAM','Tipo','Marca','Modelo','Número de serie','IMEI','Estado','Custodio','Departamento','Dependencia','Ubicación','Valor comercial','Fecha registro'];
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
    return ({DISPONIBLE:'No hay dispositivos disponibles',ASIGNADO:'No hay dispositivos asignados',SERVICIO_TECNICO:'No hay equipos en servicio técnico',EXTRAVIADO:'No hay dispositivos extraviados',DADO_BAJA:'No hay dispositivos dados de baja'} as Record<string,string>)[this.filters.estado]||'Sin resultados para los filtros aplicados';
  }
  protected emptyMessage():string {
    if(!this.allItems().length)return 'Aún no se han ingresado activos al sistema.';
    if(this.hasCombinedFilters())return 'No existen dispositivos que coincidan con esta combinación de filtros.';
    if(this.filters.estado==='DISPONIBLE')return 'Existen activos registrados, pero ninguno se encuentra disponible actualmente.';
    return 'No existen activos en este estado actualmente.';
  }
  private hasCombinedFilters():boolean {
    return Boolean(this.filters.q||this.filters.tipoDispositivoId||this.filters.departamentoId||this.filters.localidad);
  }
}
