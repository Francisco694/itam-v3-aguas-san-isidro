import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideCamera, LucideDownload, LucideEye, LucidePencil, LucidePrinter, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal, LucideTriangleAlert } from '@lucide/angular';
import QRCode from 'qrcode';
import { catchError, forkJoin, of } from 'rxjs';
import { Departamento, Dispositivo, DispositivoFilters, Estado, FiltroVerificacionDispositivo, ResultadoVerificacionFisica, TipoDispositivo } from '../../core/models/itam.models';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { AuthService } from '../../core/services/auth.service';
import { EstadosService } from '../../core/services/estados.service';
import { SimService } from '../../core/services/sim.service';
import { ToastService } from '../../core/services/toast.service';
import { TiposDispositivoService } from '../../core/services/tipos-dispositivo.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { PHYSICAL_LABEL_CALL_PHONE, PHYSICAL_LABEL_WHATSAPP, assetLabelResponsible } from '../../shared/components/asset-label/asset-label';
import { QrScanner } from '../../shared/components/qr-scanner/qr-scanner';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import type { ItamQrTarget } from '../../shared/utils/itam-qr';
import { buildItamQrValue } from '../../shared/utils/itam-qr';
import { errorMessage } from '../../shared/utils/error-message';
import { formatRut } from '../../shared/utils/rut';
import { belongsToInventoryView, classificationForView, type InventoryView } from '../../shared/utils/inventory-classification';

const normalizeInventorySearch = (value: unknown): string => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase();

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

export const verificationLabel = (
  result: ResultadoVerificacionFisica | undefined,
  origin: Dispositivo['origenRegistro'] = 'IMPORTADO',
): string => origin === 'MANUAL'
  ? '✓ Verificado'
  : ({ PENDIENTE: '○ No verificado', VERIFICADO: '✓ Verificado', REVISAR: '○ No verificado' }[result || 'PENDIENTE']);

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
    <div class="label-responsible">Responsable: ${escapeHtml(assetLabelResponsible(device))}</div>
    <div class="${mode === 'A4' ? 'label-body' : 'thermal-label__body'}">
      <img class="${mode === 'A4' ? 'label-qr' : 'thermal-label__qr'}" src="${qrDataUrl}" alt="Código QR">
      <div class="${mode === 'A4' ? 'label-data' : 'thermal-label__info'}">
        <small>INVENTARIO TI</small>
        <strong class="${mode === 'THERMAL' ? 'thermal-label__code' : ''}">ITAM ${escapeHtml(device.codigoInventario)}</strong>
        <span>${escapeHtml(device.tipo.nombre)}</span>
        <b class="label-model">${escapeHtml(`${device.marca ?? ''} ${device.modelo ?? ''}`.trim() || 'Modelo no registrado')}</b>
      </div>
    </div>
    <div class="label-loss"><strong>EN CASO DE PÉRDIDA</strong><span>Llamar: ${PHYSICAL_LABEL_CALL_PHONE}</span><span>WhatsApp: ${PHYSICAL_LABEL_WHATSAPP}</span></div>
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
    @page { size: ${mode === 'A4' ? 'A4 portrait' : '60mm 38mm'}; margin: ${mode === 'A4' ? '10mm' : '0'}; }
    * { box-sizing: border-box; }
    html, body { background: #fff; color: #000; margin: 0; max-width: 100%; min-height: 0; min-width: 0; padding: 0; }
    body { font-family: Arial, sans-serif; }
    ${mode === 'THERMAL' ? 'html, body, .sheet { height: 38mm; width: 60mm; }' : ''}
    .sheet { display: ${mode === 'A4' ? 'grid' : 'block'}; gap: 4mm 3mm; grid-template-columns: repeat(3, 60mm); margin: 0; max-width: 100%; min-height: 0; min-width: 0; padding: 0; }
    .label, .thermal-label { border: 1px solid #000; box-sizing: border-box; display: flex; flex-direction: column; height: 38mm; max-height: 38mm; max-width: 60mm; min-height: 0; min-width: 0; overflow: hidden; padding: 1.5mm 2mm; width: 60mm; }
    .label { break-inside: avoid; page-break-inside: avoid; }
    .label header, .thermal-label header { color: #000; font-size: 8.5pt; font-weight: 800; line-height: 1; margin-bottom: .6mm; overflow: hidden; padding-bottom: .5mm; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
    .label-responsible { color: #000; display: -webkit-box; font-size: 6.7pt; font-weight: 700; line-height: 1.1; margin-bottom: .3mm; max-height: 2.2em; overflow: hidden; overflow-wrap: anywhere; padding-bottom: 0; text-align: center; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .label-body, .thermal-label__body { align-items: center; display: flex; flex: 0 0 20mm; gap: 1.6mm; min-height: 0; min-width: 0; overflow: hidden; }
    .label-qr { flex: 0 0 20mm; height: 20mm; max-height: 20mm; max-width: 20mm; width: 20mm; }
    .label-data, .thermal-label__info { display: flex; flex: 1 1 auto; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; }
    .label-data small, .label-data span, .label-data b { color: #000; font-size: 7.2pt; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label-data strong { color: #000; font-family: Consolas, monospace; font-size: 11pt; line-height: 1.1; margin: .45mm 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .label-model { display: -webkit-box; font-size: 6.2pt !important; max-height: 2.2em; overflow: hidden; overflow-wrap: anywhere; text-overflow: clip; white-space: normal !important; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .thermal-label { background: #fff; border: 0; break-after: page; color: #000; margin: 0; page-break-after: always; }
    .thermal-label header { color: #000; font-size: 7.5pt; }
    .thermal-label .label-responsible { font-size: 6.4pt; }
    .thermal-label__body { gap: 1.6mm; height: auto; justify-content: center; }
    .thermal-label__qr { flex: 0 0 20mm; height: 20mm; max-height: 20mm; max-width: 20mm; object-fit: contain; width: 20mm; }
    .thermal-label__info { color: #000; font-size: 6.6pt; line-height: 1.05; }
    .thermal-label__info > * { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .thermal-label__info small, .thermal-label__info span { font-size: 6.6pt; line-height: 1.05; }
    .thermal-label__code { font-size: 10pt; font-weight: 800; line-height: 1; margin: .25mm 0; }
    .thermal-label .label-model { display: -webkit-box; font-size: 6.2pt !important; line-height: 1.08; max-height: 2.16em; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .label-loss { align-items: center; color: #000; display: flex; flex-direction: column; gap: .1mm; margin-top: .2mm; padding-top: .1mm; text-align: center; width: 100%; }
    .label-loss strong { font-size: 6.1pt; letter-spacing: .04em; line-height: 1; }
    .label-loss span { font-size: 6.3pt; font-weight: 700; line-height: 1.02; white-space: nowrap; }
    .thermal-label:last-child { break-after: auto; page-break-after: auto; }
    @media print {
      @page { size: ${mode === 'A4' ? 'A4 portrait' : '60mm 38mm'}; margin: ${mode === 'A4' ? '10mm' : '0'}; }
      html, body { margin: 0 !important; padding: 0 !important; }
      ${mode === 'THERMAL' ? 'html, body { background: #fff !important; color: #000 !important; height: 38mm !important; margin: 0 !important; padding: 0 !important; width: 60mm !important; } .sheet { margin: 0 !important; padding: 0 !important; } .thermal-label { background: #fff !important; border: 0 !important; color: #000 !important; height: 38mm !important; margin: 0 !important; max-height: 38mm !important; max-width: 60mm !important; padding: 1.5mm 2mm !important; width: 60mm !important; } .thermal-label .label-responsible, .thermal-label .label-loss { border-color: #000 !important; } .thermal-label__info, .thermal-label__info * { color: #000 !important; }' : ''}
    }
  </style>
</head>
<body>
  <main class="sheet">${devices.map((device, index) => printableLabel(device, qrDataUrls[index], mode)).join('')}</main>
</body>
</html>`;

@Component({
  selector: 'app-dispositivos-list',
  imports: [DatePipe, FormsModule, RouterLink, PageHeader, QrScanner, StatusBadge, ViewState, LucideCamera, LucideDownload, LucideEye, LucidePencil, LucidePrinter, LucidePlus, LucideScanBarcode, LucideSearch, LucideSlidersHorizontal, LucideTriangleAlert],
  template: `
    <app-page-header title="Inventario de Equipos" subtitle="Control físico, custodias y condición operativa de los activos.">
      <button class="btn btn--navy mobile-qr-action" type="button" (click)="scannerOpen.set(true)"><svg lucideCamera></svg> Escanear QR</button>
      @if (auth.user()?.rol !== 'SOLO_LECTURA') { <a class="btn btn--primary inventory-new-action" routerLink="nuevo"><svg lucidePlus></svg> Nuevo activo</a> }
      <button class="btn btn--secondary inventory-export-action" type="button" [disabled]="!items().length" (click)="exportCsv()"><svg lucideDownload></svg> Exportar CSV</button>
    </app-page-header>
    <section class="inventory-view-switch" aria-label="Vista del inventario">
      <div class="inventory-view-switch__copy">
        <strong>{{ viewMode === 'REAL' ? 'Inventario' : 'Histórico' }}</strong>
        <span>{{ viewMode === 'REAL' ? 'Solo equipos verificados, separados del histórico legacy.' : 'Registros provenientes del inventario/base legacy.' }}</span>
      </div>
      <div class="inventory-view-switch__actions" role="group" aria-label="Cambiar inventario">
        <button type="button" [class.active]="viewMode === 'REAL'" [attr.aria-pressed]="viewMode === 'REAL'" (click)="selectView('REAL')">Inventario</button>
        <button type="button" [class.active]="viewMode === 'HISTORICO'" [attr.aria-pressed]="viewMode === 'HISTORICO'" (click)="selectView('HISTORICO')">Histórico</button>
      </div>
    </section>
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
      @for(shortcut of shortcuts;track shortcut.code){<button type="button" [class.active]="filters.estado===shortcut.code" (click)="selectState(shortcut.code)">@if(shortcut.color){<i class="state-dot" [style.background]="shortcut.color" aria-hidden="true"></i>}<span>{{shortcut.label}}</span><strong>{{stateCount(shortcut.code)}}</strong></button>}
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
      <form id="inventory-filters" class="filter-panel" [class.filter-panel--open]="filtersOpen()" (submit)="applyFilters($event)">
        <div class="filter-panel__title"><svg lucideSlidersHorizontal></svg><strong>Filtros del inventario</strong></div>
        <div class="field filter-search"><label for="q">Búsqueda general</label><input id="q" name="q" [(ngModel)]="filters.q" placeholder="Código, serie, marca o modelo" /></div>
        <div class="field"><label for="tipo">Tipo</label><select id="tipo" name="tipo" [(ngModel)]="filters.tipoDispositivoId"><option value="">Todos</option>@for(type of types(); track type.id){<option [value]="type.id">{{ type.nombre }}</option>}</select></div>
        <div class="field"><label for="estado">Estado</label><select id="estado" name="estado" [(ngModel)]="filters.estado"><option value="">Todos</option>@for(e of states(); track e.id){<option [value]="e.codigo">{{ e.nombre }}</option>}</select></div>
        <div class="field"><label for="department">Departamento</label><select id="department" name="department" [(ngModel)]="filters.departamentoId"><option value="">Todos</option>@for(d of departments(); track d.id){<option [value]="d.id">{{ d.nombre }}</option>}</select></div>
        <div class="field"><label for="location">Localidad</label><input id="location" name="location" [(ngModel)]="filters.localidad" /></div>
        @if (viewMode === 'HISTORICO') {
          <div class="field"><label for="verification">Verificación física</label><select id="verification" name="verification" [(ngModel)]="filters.verificacion"><option value="">Todos</option><option value="PENDIENTE">Pendientes o por revisar</option></select></div>
        }
        <div class="filter-panel__actions"><button class="btn btn--primary" type="submit">Aplicar</button><button class="btn btn--ghost" type="button" (click)="clear()">Limpiar</button></div>
      </form>
      @if (loading()) { <app-view-state kind="loading" title="Cargando dispositivos" message="Consultando el inventario real…" /> }
      @else if (error()) { <app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" /> }
      @else if (!items().length) { <div class="empty-with-action"><app-view-state kind="empty" [title]="emptyTitle()" [message]="emptyMessage()" />@if(!allItems().length && auth.user()?.rol !== 'SOLO_LECTURA'){<a class="btn btn--primary" routerLink="nuevo"><svg lucidePlus></svg> Registrar dispositivo</a>}</div> }
      @else {
        <div class="table-heading">
          <div><strong>{{ items().length }}</strong><span>{{ items().length === 1 ? 'equipo encontrado' : 'equipos encontrados' }}</span></div>
          <div class="selection-tools">
            <label class="visible-selector"><input type="checkbox" [checked]="allVisibleSelected()" (change)="toggleVisible($event)" /> Seleccionar visibles</label>
            <span>{{ selectedCount() }} seleccionados</span>
            <button class="btn btn--primary btn--small" type="button" [disabled]="!selectedCount()" (click)="printLabels('THERMAL')"><svg lucidePrinter></svg> Imprimir etiquetas</button>
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
          </td><td><span class="verification-badge" [class.verification-badge--PENDIENTE]="item.origenRegistro === 'IMPORTADO' && item.verificacionFisica?.resultado !== 'VERIFICADO'" [class.verification-badge--VERIFICADO]="item.origenRegistro === 'MANUAL' || item.verificacionFisica?.resultado === 'VERIFICADO'" [class.verification-badge--REVISAR]="false">{{ verification(item.verificacionFisica?.resultado, item.origenRegistro) }}</span></td><td class="location-cell"><span class="cell-primary">{{ item.localidad || 'Sin localidad' }}</span><span class="cell-secondary">{{ item.ubicacionDetalle || 'Sin detalle de ubicación' }}</span></td><td><div class="actions"><a class="btn btn--secondary btn--small table-icon-action" [routerLink]="[item.codigoInventario]" title="Ver detalle" [attr.aria-label]="'Ver detalle de ITAM ' + item.codigoInventario"><svg lucideEye aria-hidden="true"></svg></a>@if (auth.user()?.rol !== 'SOLO_LECTURA') { <a class="btn btn--secondary btn--small table-icon-action" [routerLink]="[item.codigoInventario,'editar']" title="Editar ficha" [attr.aria-label]="'Editar ficha de ITAM ' + item.codigoInventario"><svg lucidePencil aria-hidden="true"></svg></a> }</div></td></tr>}
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
                <div><dt>Verificación</dt><dd><span class="verification-badge" [class.verification-badge--PENDIENTE]="item.origenRegistro === 'IMPORTADO' && item.verificacionFisica?.resultado !== 'VERIFICADO'" [class.verification-badge--VERIFICADO]="item.origenRegistro === 'MANUAL' || item.verificacionFisica?.resultado === 'VERIFICADO'" [class.verification-badge--REVISAR]="false">{{ verification(item.verificacionFisica?.resultado, item.origenRegistro) }}</span></dd></div>
                <div><dt>Responsable</dt><dd>@if(assignedWithoutResponsible(item)){<span class="custody-warning"><svg lucideTriangleAlert></svg>Asignado sin responsable</span><small>Revisar custodia</small>}@else if(closedCustody(item)){<span>Último responsable: {{ lastResponsibleName(item) }}</span>@if(item.ultimoResponsableConocido;as previous){<small>{{ previous.tipo === 'COLABORADOR' ? 'Colaborador' : 'Departamento' }} · {{ previous.fechaMovimiento | date:'dd/MM/yyyy' }}</small>}}@else{<span>{{ custody(item) }}</span>}</dd></div>
                <div><dt>Ubicaci&oacute;n</dt><dd>{{ item.localidad || item.ubicacionDetalle || 'Sin ubicaci&oacute;n' }}</dd></div>
              </dl>
              <footer class="mobile-record-card__actions">
                <a class="btn btn--primary" [routerLink]="[item.codigoInventario]">Gestionar</a>
                @if (auth.user()?.rol !== 'SOLO_LECTURA') { <a class="btn btn--secondary" [routerLink]="[item.codigoInventario,'editar']">Editar</a> }
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
  protected readonly auth = inject(AuthService);
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
  protected readonly shortcuts=[{code:'',label:'Todos',color:''},{code:'DISPONIBLE',label:'Disponibles',color:'#16a34a'},{code:'ASIGNADO',label:'Asignados',color:'#0879bd'},{code:'SERVICIO_TECNICO',label:'Servicio Técnico',color:'#f59e0b'},{code:'EXTRAVIADO',label:'Extraviados',color:'#ef4444'},{code:'DADO_BAJA',label:'Dados de Baja',color:'#94a3b8'}];
  protected readonly loading = signal(true);
  protected readonly quickLoading = signal(false);
  protected readonly scannerOpen = signal(false);
  protected readonly filtersOpen = signal(false);
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly error = signal('');
  protected viewMode: InventoryView = 'REAL';
  private listRequestSequence = 0;
  private viewItemsRequestSequence = 0;
  protected readonly physicalIdentifier = inventoryPhysicalIdentifier;
  protected readonly assignedWithoutResponsible = isAssignedWithoutResponsible;
  protected readonly verification = verificationLabel;
  protected readonly rut = formatRut;
  protected quickQuery = '';
  protected filters: { q: string; tipoDispositivoId: string; estado: string; departamentoId: string; localidad: string; verificacion: '' | FiltroVerificacionDispositivo } = { q: '', tipoDispositivoId: '', estado: '', departamentoId: '', localidad: '', verificacion: '' };

  ngOnInit(): void {
    this.viewMode = this.route.snapshot.queryParamMap.get('vista') === 'historico' ? 'HISTORICO' : 'REAL';
    this.filters.q = this.route.snapshot.queryParamMap.get('q') || '';
    this.filters.verificacion = this.viewMode === 'HISTORICO'
      ? (this.route.snapshot.queryParamMap.get('verificacion') as FiltroVerificacionDispositivo | null) || ''
      : '';
    this.filters.estado = this.route.snapshot.queryParamMap.get('estado') || '';
    this.filters.tipoDispositivoId = this.route.snapshot.queryParamMap.get('tipoDispositivoId') || '';
    this.filters.departamentoId = this.route.snapshot.queryParamMap.get('departamentoId') || '';
    this.filters.localidad = this.route.snapshot.queryParamMap.get('localidad') || '';
    this.estados.listar('DISPOSITIVO').subscribe({ next: (items) => this.states.set(items) });
    this.deptService.listar().subscribe({ next: (items) => this.departments.set(items) });
    this.typeService.listar().subscribe({ next: (items) => this.types.set(items) });
    this.loadViewItems();
    this.load();
  }
  protected stateCount(code:string):number{return inventoryStateCount(this.allItems(),code);}
  protected selectState(code:string):void{this.filters.estado=code;this.filters.verificacion='';void this.router.navigate([], {relativeTo:this.route,queryParams:{estado:code||null},queryParamsHandling:'merge',replaceUrl:true});this.load();}
  protected applyFilters(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: this.filters.q || null,
        tipoDispositivoId: this.filters.tipoDispositivoId || null,
        estado: this.filters.estado || null,
        departamentoId: this.filters.departamentoId || null,
        localidad: this.filters.localidad || null,
        verificacion: this.filters.verificacion || null
      },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.load();
  }
  protected selectView(view: InventoryView): void {
    this.viewMode = view;
    this.filters.verificacion = '';
    this.filters.estado = '';
    this.selectedIds.set(new Set());
    void this.router.navigate([], { relativeTo: this.route, queryParams: { vista: view === 'HISTORICO' ? 'historico' : null, estado: null, verificacion: null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.loadViewItems();
    this.load();
  }
  protected quickSearch(): void {
    const query = this.quickQuery.trim();
    const qrCode = extractQuickSearchCode(query);
    if (qrCode !== null) {
      this.quickLoading.set(true);
      this.openDeviceFromCurrentView(qrCode, query);
      return;
    }
    const mode = quickSearchMode(query);
    if (mode === 'EMPTY') return;
    this.quickLoading.set(true);
    if (mode === 'DEVICE_CODE') {
      this.openDeviceFromCurrentView(Number(query), query);
      return;
    }
    this.searchDevicesByQuickQuery(query);
  }
  private searchDevicesByQuickQuery(query: string): void {
    this.service.listar({ q: query, ...this.currentViewFilters() }).subscribe({
      next: (items) => {
        this.quickLoading.set(false);
        this.items.set(items);
        const visible = new Set(items.map((item) => item.id));
        this.selectedIds.update((selected) => new Set([...selected].filter((id) => visible.has(id))));
        if (!items.length) this.notifyAssetOutsideCurrentView(query);
      },
      error: (error) => {
        this.quickLoading.set(false);
        this.toast.error('No se pudo buscar el activo', errorMessage(error));
      }
    });
  }
  private openDeviceFromCurrentView(codigo: number, query: string): void {
    this.quickLoading.set(true);
    this.service.buscarPorCodigoInventario(codigo, this.currentViewFilters()).subscribe({
      next: (item) => {
        this.quickLoading.set(false);
        void this.router.navigate(['/dispositivos', item.codigoInventario]);
      },
      error: () => this.notifyAssetOutsideCurrentView(query)
    });
  }
  private notifyAssetOutsideCurrentView(query: string): void {
    this.service.listar({ q: query }).subscribe({
      next: (items) => {
        this.quickLoading.set(false);
        const otherView: InventoryView = this.viewMode === 'REAL' ? 'HISTORICO' : 'REAL';
        if (items.some((item) => belongsToInventoryView(item, otherView))) {
          this.toast.error(
            'Activo en otra vista',
            `El resultado pertenece a ${otherView === 'REAL' ? 'Inventario' : 'Histórico'}. Cambie de pestaña para revisarlo.`
          );
          return;
        }
        this.toast.error('Activo no encontrado', quickSearchNotFoundMessage);
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
      this.openDeviceFromCurrentView(target.code, String(target.code));
      return;
    }
    forkJoin({
      device: this.service.buscarPorCodigoInventario(target.code, this.currentViewFilters()).pipe(catchError(() => of(null))),
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
    const requestSequence = ++this.listRequestSequence;
    const requestedView = this.viewMode;
    const requestedState = this.filters.estado;
    const requestedQuery = normalizeInventorySearch(this.filters.q);
    this.loading.set(true); this.error.set('');
    this.service.listar({ q: this.filters.q || undefined, tipoDispositivoId: this.filters.tipoDispositivoId ? Number(this.filters.tipoDispositivoId) : undefined, estado: this.filters.estado || undefined, departamentoId: this.filters.departamentoId ? Number(this.filters.departamentoId) : undefined, localidad: this.filters.localidad || undefined, ...this.currentViewFilters() }).subscribe({ next: (items) => { if (requestSequence !== this.listRequestSequence || requestedView !== this.viewMode || requestedState !== this.filters.estado) return; const scopedItems = items.filter((item) => this.belongsToView(item, requestedView) && (!requestedState || item.estado.codigo === requestedState) && this.matchesGeneralSearch(item, requestedQuery)); this.items.set(scopedItems); const visible = new Set(scopedItems.map((item) => item.id)); this.selectedIds.update((selected) => new Set([...selected].filter((id) => visible.has(id)))); this.loading.set(false); }, error: (error) => { if (requestSequence !== this.listRequestSequence || requestedView !== this.viewMode || requestedState !== this.filters.estado) return; this.error.set(errorMessage(error)); this.loading.set(false); } });
  }
  private matchesGeneralSearch(item: Dispositivo, query: string): boolean {
    if (!query) return true;
    return [
      item.codigoInventario,
      item.numeroSerie,
      item.imei,
      item.marca,
      item.modelo,
      item.tipo.nombre
    ].some((value) => normalizeInventorySearch(value).includes(query));
  }
  private loadViewItems(): void {
    const requestSequence = ++this.viewItemsRequestSequence;
    const requestedView = this.viewMode;
    this.service.listar(this.currentViewFilters()).subscribe({ next: (items) => { if (requestSequence !== this.viewItemsRequestSequence || requestedView !== this.viewMode) return; this.allItems.set(items.filter((item) => this.belongsToView(item, requestedView))); } });
  }
  private belongsToView(item: Dispositivo, view: InventoryView): boolean {
    return belongsToInventoryView(item, view);
  }
  private currentViewFilters(): Pick<DispositivoFilters, 'clasificacion' | 'verificacion'> {
    return {
      clasificacion: classificationForView(this.viewMode),
      ...(this.viewMode === 'HISTORICO' && this.filters.verificacion
        ? { verificacion: this.filters.verificacion }
        : {})
    };
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
  protected async printLabels(mode: 'THERMAL'): Promise<void> {
    const devices = this.selectedDevices();
    if (!devices.length) return;
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
  protected clear(): void {
    this.quickQuery = '';
    this.filters = { q: '', tipoDispositivoId: '', estado: '', departamentoId: '', localidad: '', verificacion: '' };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null, tipoDispositivoId: null, estado: null, departamentoId: null, localidad: null, verificacion: null },
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
    this.load();
  }
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
    if(!this.allItems().length)return this.viewMode === 'REAL' ? 'No hay equipos verificados' : 'No hay registros históricos pendientes';
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
    return Boolean(this.filters.q||this.filters.tipoDispositivoId||this.filters.estado||this.filters.departamentoId||this.filters.localidad||this.filters.verificacion);
  }
}
