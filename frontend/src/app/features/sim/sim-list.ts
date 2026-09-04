import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucidePrinter, LucideX } from '@lucide/angular';
import QRCode from 'qrcode';
import { Estado, Sim } from '../../core/models/itam.models';
import { EstadosService } from '../../core/services/estados.service';
import { SimService } from '../../core/services/sim.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';
import { buildItamQrValue } from '../../shared/utils/itam-qr';

const escapeHtml = (value: unknown): string => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const simLabel = (sim: Sim, qr: string, mode: 'A4' | 'THERMAL'): string => `<article class="${mode === 'A4' ? 'label' : 'thermal-label'}"><header>AGUAS SAN ISIDRO</header><div class="label-body"><img class="${mode === 'A4' ? 'label-qr' : 'thermal-label__qr'}" src="${qr}" alt="Código QR"><div class="${mode === 'A4' ? 'label-data' : 'thermal-label__info'}"><small>INVENTARIO TI</small><strong>ITAM ${escapeHtml(sim.codigoInventario)}</strong><span>SIM</span>${sim.iccidCodigoFabrica ? `<small>ICCID: ${escapeHtml(sim.iccidCodigoFabrica)}</small>` : ''}${sim.compania ? `<small>${escapeHtml(sim.compania)}</small>` : ''}</div></div></article>`;
const simPrintDocument = (sims: readonly Sim[], qrs: readonly string[], mode: 'A4' | 'THERMAL'): string => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiquetas SIM</title><style>@page{size:${mode === 'A4' ? 'A4 portrait' : '50mm 30mm'};margin:${mode === 'A4' ? '10mm' : '0'}}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,sans-serif}.sheet{display:${mode === 'A4' ? 'grid' : 'block'};grid-template-columns:repeat(3,60mm);gap:4mm 3mm}.label,.thermal-label{border:1px solid #000;overflow:hidden}.label{width:60mm;height:35mm;padding:2mm;break-inside:avoid}.label header,.thermal-label header{border-bottom:1px solid #000;text-align:center;font-size:8pt;font-weight:800;padding-bottom:1mm;margin-bottom:1.5mm}.label-body{display:flex;align-items:center;gap:2mm}.label-qr{width:20mm;height:20mm}.label-data,.thermal-label__info{display:flex;flex-direction:column;min-width:0;overflow:hidden}.label-data small,.label-data span{font-size:7pt;line-height:1.25;overflow-wrap:anywhere}.label-data strong{font:700 12pt Consolas,monospace;margin:.7mm 0}.thermal-label{width:50mm;height:30mm;padding:2mm;display:grid;grid-template-columns:18mm 1fr;column-gap:2mm;page-break-after:always;break-after:page}.thermal-label header{grid-column:1/-1;font-size:7pt;margin:0}.thermal-label__body{grid-column:1/-1;display:flex;align-items:center;gap:2mm}.thermal-label__qr{width:17mm;height:17mm}.thermal-label__info{font-size:6pt;line-height:1.15}.thermal-label__info small,.thermal-label__info span{font-size:6pt;line-height:1.15;overflow-wrap:anywhere}.thermal-label__info strong{font-size:10pt}.thermal-label:last-child{page-break-after:auto;break-after:auto}</style></head><body><main class="sheet">${sims.map((sim, i) => simLabel(sim, qrs[i], mode)).join('')}</main></body></html>`;

@Component({
  selector: 'app-sim-list',
  imports: [FormsModule, RouterLink, PageHeader, StatusBadge, ViewState, LucidePrinter, LucideX],
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
        <div class="sim-selection-toolbar"><label><input type="checkbox" [checked]="allVisibleSelected()" (change)="toggleVisible($event)" /> Seleccionar visibles</label><span>{{ selectedCount() }} seleccionadas</span><button class="btn btn--primary btn--small" type="button" [disabled]="!selectedCount()" (click)="printOptionsOpen.set(true)"><svg lucidePrinter></svg> Imprimir etiquetas</button></div>
        <div class="table-wrap desktop-table">
          <table class="data-table">
            <thead><tr><th class="select-column"><input type="checkbox" aria-label="Seleccionar SIM visibles" [checked]="allVisibleSelected()" (change)="toggleVisible($event)" /></th><th>Inventario</th><th>Identificacion</th><th>Compania</th><th>Estado</th><th>Asignacion</th><th>Dispositivo</th><th></th></tr></thead>
            <tbody>
              @for (item of filtered(); track item.id) {
                <tr>
                  <td class="select-column"><input type="checkbox" [attr.aria-label]="'Seleccionar SIM ' + item.codigoInventario" [checked]="selected(item.id)" (change)="toggleItem(item.id, $event)" /></td><td><a class="asset-link" [routerLink]="[item.codigoInventario]">#{{ item.codigoInventario }}</a></td>
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
                <div><label><input type="checkbox" [checked]="selected(item.id)" (change)="toggleItem(item.id, $event)" /> Seleccionar</label>
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
    @if (printOptionsOpen()) {
      <div class="print-options-overlay" role="presentation" (click)="printOptionsOpen.set(false)">
        <section class="print-options-dialog" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <header><div><span>IMPRESIÓN MÚLTIPLE</span><h2>Imprimir {{ selectedCount() }} etiquetas SIM</h2></div><button type="button" aria-label="Cerrar" (click)="printOptionsOpen.set(false)"><svg lucideX></svg></button></header>
          <p>Las etiquetas no incluyen nombres, RUT ni números telefónicos.</p>
          <div class="print-choice-grid"><button type="button" (click)="printLabels('A4')"><svg lucidePrinter></svg><strong>Hoja A4</strong><span>Grilla de etiquetas SIM.</span></button><button type="button" (click)="printLabels('THERMAL')"><svg lucidePrinter></svg><strong>Impresora de etiquetas</strong><span>Una etiqueta por SIM.</span></button></div>
        </section>
      </div>
    }
  `,
  styles: [`.sim-selection-toolbar{align-items:center;display:flex;gap:1rem;margin:.8rem 0}.sim-selection-toolbar span{color:var(--slate-500);font-size:.8rem;margin-right:auto}.select-column{width:2.5rem}.print-options-overlay{align-items:center;background:rgba(15,23,42,.58);display:flex;inset:0;justify-content:center;position:fixed;z-index:1000}.print-options-dialog{background:#fff;border-radius:1rem;box-shadow:var(--shadow-lg);max-width:34rem;padding:1.4rem;width:calc(100% - 2rem)}.print-options-dialog header{align-items:start;display:flex;justify-content:space-between}.print-options-dialog header span{color:var(--blue);font-size:.65rem;font-weight:800}.print-options-dialog h2{font-size:1.1rem;margin:.25rem 0}.print-options-dialog header button{background:none;border:0;cursor:pointer}.print-choice-grid{display:grid;gap:.7rem;grid-template-columns:1fr 1fr}.print-choice-grid button{background:var(--gray-50);border:1px solid var(--gray-200);border-radius:.7rem;cursor:pointer;display:grid;gap:.3rem;padding:1rem;text-align:left}.print-choice-grid button svg{color:var(--blue)}.print-choice-grid button span{color:var(--slate-500);font-size:.72rem}.asset-link{color:var(--color-primary);font-weight:800;text-decoration:none}.sim-iccid{grid-column:1/-1}.sim-iccid dd{font-family:var(--font-mono);overflow-wrap:anywhere;word-break:break-word}`]
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
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());
  protected readonly printOptionsOpen = signal(false);

  ngOnInit(): void {
    this.estados.listar('SIM').subscribe({ next: (items) => this.states.set(items) });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.listar().subscribe({
      next: (items) => { this.items.set(items); this.selectedIds.set(new Set()); this.loading.set(false); },
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
  protected selected(id: string): boolean { return this.selectedIds().has(id); }
  protected selectedCount(): number { return this.selectedIds().size; }
  protected allVisibleSelected(): boolean { return this.filtered().length > 0 && this.filtered().every((item) => this.selected(item.id)); }
  protected toggleItem(id: string, event: Event): void {
    const next = new Set(this.selectedIds());
    (event.target as HTMLInputElement).checked ? next.add(id) : next.delete(id);
    this.selectedIds.set(next);
  }
  protected toggleVisible(event: Event): void {
    this.selectedIds.set((event.target as HTMLInputElement).checked ? new Set(this.filtered().map((item) => item.id)) : new Set());
  }
  protected async printLabels(mode: 'A4' | 'THERMAL'): Promise<void> {
    const sims = this.filtered().filter((item) => this.selectedIds().has(item.id));
    if (!sims.length) return;
    this.printOptionsOpen.set(false);
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    try {
      const qrs = await Promise.all(sims.map((sim) => QRCode.toDataURL(buildItamQrValue(sim.codigoInventario), {
        errorCorrectionLevel: 'M', margin: 1, width: 160, color: { dark: '#000000', light: '#FFFFFF' },
      })));
      printWindow.document.open();
      printWindow.document.write(simPrintDocument(sims, qrs, mode));
      printWindow.document.close();
      let printed = false;
      const print = () => { if (printed) return; printed = true; printWindow.focus(); printWindow.print(); };
      printWindow.onload = () => window.setTimeout(print, 300);
      window.setTimeout(print, 1000);
    } catch (error) {
      printWindow.close();
      this.error.set(errorMessage(error));
    }
  }
}
