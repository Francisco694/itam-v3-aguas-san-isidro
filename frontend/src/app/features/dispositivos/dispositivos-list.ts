import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideCamera, LucideDownload, LucidePrinter, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal, LucideTriangleAlert, LucideX } from '@lucide/angular';
import QRCode from 'qrcode';
import { catchError, forkJoin, of } from 'rxjs';
import { Departamento, Dispositivo, Estado, ResultadoVerificacionFisica, TipoDispositivo } from '../../core/models/itam.models';
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
import type { ItamQrTarget } from '../../shared/utils/itam-qr';
import { buildItamQrValue } from '../../shared/utils/itam-qr';
import { errorMessage } from '../../shared/utils/error-message';
import { formatRut } from '../../shared/utils/rut';

export const quickSearchMode = (query: string): 'DEVICE_CODE' | 'FILTER' | 'EMPTY' => {
  const normalized = query.trim();
  if (!normalized) return 'EMPTY';
  return /^\d+$/.test(normalized) ? 'DEVICE_CODE' : 'FILTER';
};

export const quickSearchNotFoundMessage =
  'No se encontró ningún equipo con ese código, IMEI, serie, marca o modelo.';

export const extractQuickSearchCode = (query: string): number | null => {
  const match = query.trim().match(/^\/q\/(\d+)\/?$/i);
  return match ? Number(match[1]) : null;
};

export const inventoryStateCount = (
  items: readonly Pick<Dispositivo, 'estado'>[],
  code: string
): number => code ? items.filter((item) => item.estado.codigo === code).length : items.length;

export const inventoryPhysicalIdentifier = (
  item: Pick<Dispositivo, 'imei' | 'numeroSerie'> & { tipo: Pick<Dispositivo['tipo'], 'nombre'> },
): string => {
  if (item.tipo.nombre.trim().toUpperCase().includes('SMARTPHONE')) {
    return item.imei?.trim() ? `IMEI: ${item.imei.trim()}` : 'Sin IMEI registrado';
  }
  return item.numeroSerie?.trim()
    ? `N° serie: ${item.numeroSerie.trim()}`
    : 'Sin número de serie';
};

export const verificationLabel = (result: ResultadoVerificacionFisica | undefined): string =>
  ({ PENDIENTE: '○ Pendiente', VERIFICADO: '✓ Verificado', REVISAR_DATOS: '! Revisar datos', NO_ENCONTRADO: '✕ No encontrado' }[result || 'PENDIENTE']);

export const isAssignedWithoutResponsible = (
  item: Pick<Dispositivo, 'estado' | 'colaborador' | 'departamento'>,
): boolean =>
  item.estado.codigo === 'ASIGNADO' && !item.colaborador && !item.departamento;

export const isClosedCustodyState = (stateCode: string): boolean =>
  stateCode === 'DADO_BAJA' || stateCode === 'EXTRAVIADO';

export const batchLabelIdentifier = (
  item: Pick<Dispositivo, 'imei' | 'numeroSerie'>,
): string => item.imei?.trim()
  ? `IMEI: ${item.imei.trim()}`
  : item.numeroSerie?.trim()
    ? `N° serie: ${item.numeroSerie.trim()}`
    : 'Sin IMEI/Serie registrado';

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const printableLabel = (device: Dispositivo, qrDataUrl: string, mode: 'A4' | 'THERMAL'): string => `
  <article class="${mode === 'A4' ? 'label' : 'thermal-label'}">
    <header>AGUAS SAN ISIDRO</header>
    <div class="${mode === 'A4' ? 'label-body' : 'thermal-label__body'}">
      <img class="${mode === 'A4' ? 'label-qr' : 'thermal-label__qr'}" src="${qrDataUrl}" alt="Código QR">
      <div class="${mode === 'A4' ? 'label-data' : 'thermal-label__info'}">
        <small>INVENTARIO TI</small>
        <strong class="${mode === 'THERMAL' ? 'thermal-label__code' : ''}">ITAM ${escapeHtml(device.codigoInventario)}</strong>
        <span>${escapeHtml(device.tipo.nombre)}</span>
        ${device.marca || device.modelo
          ? `<b>${escapeHtml(`${device.marca ?? ''} ${device.modelo ?? ''}`.trim())}</b>`
          : ''}
        <small>${escapeHtml(batchLabelIdentifier(device))}</small>
      </div>
    </div>
  </article>`;

const printableDocument = (
  devices: readonly Dispositivo[],
  qrDataUrls: readonly string[],
  mode: 'A4' | 'THERMAL'
): string => `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Etiquetas ITAM</title>
  <style>
    @page { size: ${mode === 'A4' ? 'A4 portrait' : '50mm 30mm'}; margin: ${mode === 'A4' ? '10mm' : '0'}; }
    * { box-sizing: border-box; }
    html, body { background: #fff; color: #000; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    .sheet { display: ${mode === 'A4' ? 'grid' : 'block'}; gap: 4mm 3mm; grid-template-columns: repeat(3, 60mm); }
    .label, .thermal-label { border: 1px solid #000; box-sizing: border-box; overflow: hidden; }
    .label { break-inside: avoid; display: flex; flex-direction: column; height: 35mm; page-break-inside: avoid; padding: 2mm; width: 60mm; }
    .label header, .thermal-label header { border-bottom: 1px solid #000; font-size: 8pt; font-weight: 800; line-height: 1; margin-bottom: 1.5mm; padding-bottom: 1mm; text-align: center; }
    .label-body, .thermal-label__body { align-items: center; display: flex; gap: 2mm; min-height: 0; }
    .label-qr { flex: 0 0 20mm; height: 20mm; width: 20mm; }
    .label-data, .thermal-label__info { display: flex; flex: 1; flex-direction: column; min-width: 0; }
    .label-data small, .label-data span, .label-data b { font-size: 7pt; line-height: 1.25; overflow-wrap: anywhere; }
    .label-data strong { font-family: Consolas, monospace; font-size: 12pt; line-height: 1.2; margin: .7mm 0; }
    .thermal-label { break-after: page; display: grid; grid-template-columns: 18mm 1fr; column-gap: 2mm; height: 30mm; page-break-after: always; padding: 2mm; width: 50mm; }
    .thermal-label header { grid-column: 1 / -1; font-size: 7pt; margin-bottom: 0; }
    .thermal-label__body { grid-column: 1 / -1; }
    .thermal-label__qr { flex: 0 0 17mm; height: 17mm; width: 17mm; }
    .thermal-label__info { font-size: 6pt; line-height: 1.15; overflow: hidden; }
    .thermal-label__info small, .thermal-label__info span { font-size: 6pt; line-height: 1.15; overflow-wrap: anywhere; }
    .thermal-label__code { font-size: 10pt; font-weight: 700; }
    .thermal-label:last-child { break-after: auto; page-break-after: auto; }
  </style>
</head>
<body>
  <main class="sheet">${devices.map((device, index) => printableLabel(device, qrDataUrls[index], mode)).join('')}</main>
</body>
</html>`;

@Component({
  selector: 'app-dispositivos-list',
  imports: [DatePipe, FormsModule, RouterLink, PageHeader, QrScanner, StatusBadge, ViewState, LucideCamera, LucideDownload, LucidePrinter, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal, LucideTriangleAlert, LucideX],
  template: `
    <app-page-header title="Inventario de Equipos" subtitle="Control físico, custodias y condición operativa de los activos.">
      <button class="btn btn--navy mobile-qr-action" type="button" (click)="scannerOpen.set(true)"><svg lucideCamera></svg> Escanear QR</button>
      <a class="btn btn--primary inventory-new-action" routerLink="nuevo"><svg lucidePlus></svg> Nuevo activo</a>
      <button class="btn btn--secondary inventory-export-action" type="button" [disabled]="!items().length" (click)="exportCsv()"><svg lucideDownload></svg> Exportar CSV</button>
    </app-page-header>
    <section class="scan-card" aria-labelledby="scan-title">
      <div class="scan-card__icon"><svg lucideScanBarcode></svg></div>
      <form class="scan-card__form" (ngSubmit)="quickSearch()">
        <label id="scan-title" for="asset-search"><span class="desktop-copy">Escanear con Pistola USB o Digitar Código</span><span class="mobile-copy">Buscar activo</span></label>
        <div class="scan-input"><svg lucideSearch aria-hidden="true"></svg><input id="asset-search" name="assetSearch" [(ngModel)]="quickQuery" (keydown.enter)="$event.preventDefault(); quickSearch()" autocomplete="off" inputmode="search" placeholder="Código de inventario, serie, marca o modelo..." /><button class="btn btn--primary" type="submit" [disabled]="quickLoading()">{{ quickLoading() ? 'Buscando…' : 'Buscar' }}</button></div>
        <p><span class="desktop-copy">Los lectores USB funcionan como teclado: escanee el activo y presione Enter.</span><span class="mobile-copy">También puede utilizar un lector USB como teclado.</span></p>
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
        <div class="field filter-search"><label for="q">Búsqueda general</label><input id="q" name="q" [(ngModel)]="filters.q" placeholder="Código, serie, marca o modelo" /></div>
        <div class="field"><label for="tipo">Tipo</label><select id="tipo" name="tipo" [(ngModel)]="filters.tipoDispositivoId"><option value="">Todos</option>@for(type of types(); track type.id){<option [value]="type.id">{{ type.nombre }}</option>}</select></div>
        <div class="field"><label for="estado">Estado</label><select id="estado" name="estado" [(ngModel)]="filters.estado"><option value="">Todos</option>@for(e of states(); track e.id){<option [value]="e.codigo">{{ e.nombre }}</option>}</select></div>
        <div class="field"><label for="department">Departamento</label><select id="department" name="department" [(ngModel)]="filters.departamentoId"><option value="">Todos</option>@for(d of departments(); track d.id){<option [value]="d.id">{{ d.nombre }}</option>}</select></div>
        <div class="field"><label for="location">Localidad</label><input id="location" name="location" [(ngModel)]="filters.localidad" /></div>
        <div class="field"><label for="verification">Verificación</label><select id="verification" name="verification" [(ngModel)]="filters.verificacion"><option value="">Todos</option><option value="PENDIENTE">Pendientes</option><option value="VERIFICADO">Verificados</option><option value="REVISAR_DATOS">Revisar datos</option><option value="NO_ENCONTRADO">No encontrados</option></select></div>
        <div class="filter-panel__actions"><button class="btn btn--primary" type="submit">Aplicar</button><button class="btn btn--ghost" type="button" (click)="clear()">Limpiar</button></div>
      </form>
      @if (loading()) { <app-view-state kind="loading" title="Cargando dispositivos" message="Consultando el inventario real…" /> }
      @else if (error()) { <app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" /> }
      @else if (!items().length) { <div class="empty-with-action"><app-view-state kind="empty" [title]="emptyTitle()" [message]="emptyMessage()" />@if(!allItems().length){<a class="btn btn--primary" routerLink="nuevo"><svg lucidePlus></svg> Registrar dispositivo</a>}</div> }
      @else {
        <div class="table-heading">
          <div><strong>{{ items().length }}</strong><span>{{ items().length === 1 ? 'equipo encontrado' : 'equipos encontrados' }}</span></div>
          <div class="selection-tools">
            <label class="visible-selector"><input type="checkbox" [checked]="allVisibleSelected()" (change)="toggleVisible($event)" /> Seleccionar visibles</label>
            <span>{{ selectedCount() }} seleccionados</span>
            <button class="btn btn--primary btn--small" type="button" [disabled]="!selectedCount()" (click)="printOptionsOpen.set(true)"><svg lucidePrinter></svg> Imprimir etiquetas</button>
          </div>
        </div>
        <div class="table-wrap desktop-table"><table class="data-table inventory-table"><thead><tr><th class="select-column"><input type="checkbox" aria-label="Seleccionar dispositivos visibles" [checked]="allVisibleSelected()" (change)="toggleVisible($event)" /></th><th>ID / Código</th><th>Equipo</th><th>Estado</th><th>Responsable</th><th>Verificación</th><th>Ubicación</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>
          @for(item of items(); track item.id){<tr><td class="select-column"><input type="checkbox" [attr.aria-label]="'Seleccionar ITAM ' + item.codigoInventario" [checked]="selected(item.id)" (change)="toggleItem(item.id, $event)" /></td><td><a class="asset-code-link" [routerLink]="[item.codigoInventario]">{{ item.codigoInventario }}</a><span class="cell-secondary mono">{{ physicalIdentifier(item) }}</span></td><td><span class="cell-primary">{{ item.marca || item.tipo.nombre }} {{ item.modelo || '' }}</span><span class="cell-secondary">{{ item.tipo.nombre }}</span></td><td><app-status-badge [code]="item.estado.codigo" [label]="item.estado.nombre" /></td><td>
            @if (assignedWithoutResponsible(item)) {
              <span class="custody-warning"><svg lucideTriangleAlert></svg>Asignado sin responsable</span><span class="cell-secondary">Requiere revisión del responsable</span>
            } @else if (closedCustody(item)) {
              <span class="cell-primary">Último responsable: {{ lastResponsibleName(item) }}</span>
              @if (item.ultimoResponsableConocido; as previous) {<span class="cell-secondary">{{ previous.tipo === 'COLABORADOR' ? 'Colaborador' : 'Departamento' }} · {{ previous.fechaMovimiento | date:'dd/MM/yyyy' }}</span>} @else {<span class="cell-secondary">Sin responsable conocido</span>}
            } @else {
              <span class="cell-primary">{{ custody(item) }}</span><span class="cell-secondary">{{ item.colaborador?.rut ? rut(item.colaborador!.rut) : item.departamento?.nombre || 'Sin responsable actual' }}</span>
            }
          </td><td><span class="verification-badge verification-badge--{{ item.verificacionFisica?.resultado || 'PENDIENTE' }}">{{ verification(item.verificacionFisica?.resultado) }}</span></td><td>{{ item.localidad || '—' }}<span class="cell-secondary">{{ item.ubicacionDetalle || '' }}</span></td><td><div class="actions"><a class="btn btn--secondary btn--small" [routerLink]="[item.codigoInventario]">Gestionar ficha</a><a class="btn btn--ghost btn--small" [routerLink]="[item.codigoInventario,'editar']">Editar</a></div></td></tr>}
        </tbody></table></div>
        <div class="mobile-record-list inventory-mobile-list">
          @for(item of items(); track item.id) {
            <article class="mobile-record-card" [class.mobile-record-card--selected]="selected(item.id)">
              <header class="mobile-record-card__top">
                <div>
                  <label class="mobile-selector"><input type="checkbox" [checked]="selected(item.id)" (change)="toggleItem(item.id, $event)" /> Seleccionar</label>
                  <a class="mobile-record-card__title code" [routerLink]="[item.codigoInventario]">ITAM {{ item.codigoInventario }}</a>
                  <span class="mobile-record-card__subtitle">{{ item.marca || item.tipo.nombre }} {{ item.modelo || '' }}</span>
                  <span class="mobile-record-card__subtitle">{{ item.tipo.nombre }} &middot; {{ physicalIdentifier(item) }}</span>
                </div>
                <app-status-badge [code]="item.estado.codigo" [label]="item.estado.nombre" />
              </header>
              <dl class="mobile-record-card__details">
                <div><dt>Verificación</dt><dd><span class="verification-badge verification-badge--{{ item.verificacionFisica?.resultado || 'PENDIENTE' }}">{{ verification(item.verificacionFisica?.resultado) }}</span></dd></div>
                <div><dt>Responsable</dt><dd>@if(assignedWithoutResponsible(item)){<span class="custody-warning"><svg lucideTriangleAlert></svg>Asignado sin responsable</span><small>Revisar custodia</small>}@else if(closedCustody(item)){<span>Último responsable: {{ lastResponsibleName(item) }}</span>@if(item.ultimoResponsableConocido;as previous){<small>{{ previous.tipo === 'COLABORADOR' ? 'Colaborador' : 'Departamento' }} · {{ previous.fechaMovimiento | date:'dd/MM/yyyy' }}</small>}}@else{<span>{{ custody(item) }}</span>}</dd></div>
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
    @if (printOptionsOpen()) {
      <div class="print-options-overlay" role="presentation" (click)="printOptionsOpen.set(false)">
        <section class="print-options-dialog" role="dialog" aria-modal="true" aria-labelledby="print-options-title" (click)="$event.stopPropagation()">
          <header><div><span>IMPRESIÓN MÚLTIPLE</span><h2 id="print-options-title">Imprimir {{ selectedCount() }} etiquetas</h2></div><button type="button" aria-label="Cerrar" (click)="printOptionsOpen.set(false)"><svg lucideX></svg></button></header>
          <p>Elija el formato de salida. Las etiquetas no incluyen nombres, RUT ni valores comerciales.</p>
          <div class="print-choice-grid">
            <button type="button" (click)="printLabels('A4')"><svg lucidePrinter></svg><strong>Hoja A4</strong><span>Varias etiquetas organizadas en grilla por hoja.</span></button>
            <button type="button" (click)="printLabels('THERMAL')"><svg lucidePrinter></svg><strong>Impresora de etiquetas</strong><span>Una etiqueta por dispositivo para impresora térmica Zebra.</span></button>
          </div>
        </section>
      </div>
    }
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
  protected readonly shortcuts=[{code:'',label:'Todos'},{code:'DISPONIBLE',label:'Disponibles'},{code:'ASIGNADO',label:'Asignados'},{code:'SERVICIO_TECNICO',label:'Servicio Técnico'},{code:'EXTRAVIADO',label:'Extraviados'},{code:'DADO_BAJA',label:'Dados de Baja'}];
  protected readonly loading = signal(true);
  protected readonly quickLoading = signal(false);
  protected readonly scannerOpen = signal(false);
  protected readonly filtersOpen = signal(false);
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly printOptionsOpen = signal(false);
  protected readonly error = signal('');
  protected readonly physicalIdentifier = inventoryPhysicalIdentifier;
  protected readonly assignedWithoutResponsible = isAssignedWithoutResponsible;
  protected readonly labelIdentifier = batchLabelIdentifier;
  protected readonly verification = verificationLabel;
  protected readonly rut = formatRut;
  protected quickQuery = '';
  protected filters: { q: string; tipoDispositivoId: string; estado: string; departamentoId: string; localidad: string; verificacion: '' | ResultadoVerificacionFisica } = { q: '', tipoDispositivoId: '', estado: '', departamentoId: '', localidad: '', verificacion: '' };

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
    const qrCode = extractQuickSearchCode(query);
    if (qrCode !== null) {
      this.quickLoading.set(true);
      this.service.buscarPorCodigoInventario(qrCode).subscribe({
        next: (item) => {
          this.quickLoading.set(false);
          void this.router.navigate(['/dispositivos', item.codigoInventario]);
        },
        error: () => this.searchDevicesByQuickQuery(query)
      });
      return;
    }
    const mode = quickSearchMode(query);
    if (mode === 'EMPTY') return;
    this.quickLoading.set(true);
    if (mode === 'DEVICE_CODE') {
      this.service.buscarPorCodigoInventario(Number(query)).subscribe({
        next: (item) => {
          this.quickLoading.set(false);
          void this.router.navigate(['/dispositivos', item.codigoInventario]);
        },
        error: () => this.searchDevicesByQuickQuery(query)
      });
      return;
    }
    this.searchDevicesByQuickQuery(query);
  }
  private searchDevicesByQuickQuery(query: string): void {
    this.service.listar({ q: query }).subscribe({
      next: (items) => {
        this.quickLoading.set(false);
        this.items.set(items);
        const visible = new Set(items.map((item) => item.id));
        this.selectedIds.update((selected) => new Set([...selected].filter((id) => visible.has(id))));
        if (!items.length) this.toast.error('Activo no encontrado', quickSearchNotFoundMessage);
      },
      error: (error) => {
        this.quickLoading.set(false);
        this.toast.error('No se pudo buscar el activo', errorMessage(error));
      }
    });
  }
  protected openScannedAsset(target: ItamQrTarget): void {
    this.scannerOpen.set(false);
    this.quickLoading.set(true);
    const notFound = () => {
      this.quickLoading.set(false);
      this.toast.error(
        'Código ITAM no encontrado',
        'El código ITAM leído no corresponde a un registro existente.'
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
      this.service.buscarPorCodigoInventario(target.code).subscribe({
        next: (item) => {
          this.quickLoading.set(false);
          void this.router.navigate(['/dispositivos', item.codigoInventario]);
        },
        error: notFound
      });
      return;
    }
    forkJoin({
      device: this.service.buscarPorCodigoInventario(target.code).pipe(catchError(() => of(null))),
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
    this.service.listar({ q: this.filters.q || undefined, tipoDispositivoId: this.filters.tipoDispositivoId ? Number(this.filters.tipoDispositivoId) : undefined, estado: this.filters.estado || undefined, departamentoId: this.filters.departamentoId ? Number(this.filters.departamentoId) : undefined, localidad: this.filters.localidad || undefined, verificacion: this.filters.verificacion || undefined }).subscribe({ next: (items) => { this.items.set(items); const visible = new Set(items.map((item) => item.id)); this.selectedIds.update((selected) => new Set([...selected].filter((id) => visible.has(id)))); this.loading.set(false); }, error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); } });
  }
  protected selected(id: string): boolean { return this.selectedIds().has(id); }
  protected selectedCount(): number { return this.selectedIds().size; }
  protected selectedDevices(): Dispositivo[] { const selected = this.selectedIds(); return this.items().filter((item) => selected.has(item.id)); }
  protected allVisibleSelected(): boolean { return this.items().length > 0 && this.items().every((item) => this.selected(item.id)); }
  protected toggleItem(id: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.update((current) => { const next = new Set(current); checked ? next.add(id) : next.delete(id); return next; });
  }
  protected toggleVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedIds.set(checked ? new Set(this.items().map((item) => item.id)) : new Set());
  }
  protected async printLabels(mode: 'A4' | 'THERMAL'): Promise<void> {
    const devices = this.selectedDevices();
    if (!devices.length) return;
    this.printOptionsOpen.set(false);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      this.toast.error('No se pudo abrir la impresión', 'Permite ventanas emergentes para imprimir las etiquetas.');
      return;
    }
    try {
      const qrDataUrls = await Promise.all(
        devices.map((device) => QRCode.toDataURL(buildItamQrValue(device.codigoInventario), {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: 160,
          color: { dark: '#000000', light: '#FFFFFF' },
        }))
      );
      const html = printableDocument(devices, qrDataUrls, mode);
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      let printed = false;
      const print = () => {
        if (printed) return;
        printed = true;
        printWindow.focus();
        printWindow.print();
      };
      printWindow.onload = () => window.setTimeout(print, 300);
      window.setTimeout(print, 1000);
    } catch (error) {
      printWindow.close();
      this.toast.error('No se pudieron generar las etiquetas', errorMessage(error));
    }
  }
  protected clear(): void { this.quickQuery = ''; this.filters = { q: '', tipoDispositivoId: '', estado: '', departamentoId: '', localidad: '', verificacion: '' }; this.load(); }
  protected custody(item: Dispositivo): string { return item.colaborador?.nombre || item.departamento?.nombre || 'Sin responsable actual'; }
  protected closedCustody(item: Dispositivo): boolean { return isClosedCustodyState(item.estado.codigo); }
  protected lastResponsibleName(item: Dispositivo): string {
    return item.ultimoResponsableConocido?.nombre
      || item.colaborador?.nombre
      || item.departamento?.nombre
      || 'Sin responsable conocido';
  }
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
