import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideCircleAlert, LucidePackageCheck, LucideRotateCcw, LucideSearch, LucideUserMinus, LucideUsers, LucideX } from '@lucide/angular';
import { forkJoin } from 'rxjs';
import { Colaborador, Dispositivo } from '../../core/models/itam.models';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { ToastService } from '../../core/services/toast.service';
import { DocumentPreview } from '../../shared/components/document-preview/document-preview';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

interface EmployeeResult { person: Colaborador; assetCount: number; }

@Component({
  selector: 'app-offboarding',
  imports: [ReactiveFormsModule, DocumentPreview, PageHeader, StatusBadge, ViewState, LucideCircleAlert, LucidePackageCheck, LucideRotateCcw, LucideSearch, LucideUserMinus, LucideUsers, LucideX],
  template: `
    <app-page-header title="Offboarding & Recuperación" subtitle="Busque al colaborador por RUT o nombre para gestionar la devolución de su hardware." eyebrow="Desvinculación y cadena de custodia" />
    <section class="offboarding-hero">
      <div class="offboarding-hero__copy"><span><svg lucideUserMinus></svg></span><div><h2>Recuperación de activos tecnológicos</h2><p>Identifique al colaborador y gestione individualmente cada activo bajo su custodia. Todas las devoluciones se registran mediante la API y quedan en el historial.</p></div></div>
      <form class="employee-search" [formGroup]="searchForm" (ngSubmit)="search()"><svg lucideSearch></svg><label class="sr-only" for="employee-search">Buscar empleado por RUT o nombre</label><input id="employee-search" formControlName="query" placeholder="Buscar empleado por RUT o nombre..." autocomplete="off" /><button class="btn btn--primary" type="submit" [disabled]="searching()">{{ searching() ? 'Buscando…' : 'Buscar' }}</button></form>
    </section>

    @if (searchError()) { <div class="notice notice--error"><svg lucideCircleAlert></svg>{{ searchError() }}</div> }
    @if (searching()) { <section class="card"><app-view-state kind="loading" title="Buscando colaboradores" message="Consultando personas y custodias vigentes…" /></section> }
    @else if (searched() && !selected()) {
      <section class="results-section"><header><div><span>RESULTADOS</span><h2>Colaboradores encontrados</h2></div><strong>{{ results().length }}</strong></header>
        @if (!results().length) { <section class="card"><app-view-state kind="empty" title="Sin coincidencias" message="No encontramos colaboradores con ese nombre o RUT." /></section> }
        @else { <div class="employee-grid">@for(result of results(); track result.person.id){<button type="button" class="employee-card" (click)="select(result.person)"><span class="employee-card__icon"><svg lucideUsers></svg></span><span><strong>{{ result.person.nombre }}</strong><small>{{ result.person.rut }} · {{ result.person.cargo || 'Sin cargo' }}</small><small>{{ result.person.departamento?.nombre || 'Sin departamento' }}</small></span><b [class.has-assets]="result.assetCount > 0">{{ result.assetCount }} {{ result.assetCount === 1 ? 'equipo' : 'equipos' }}</b></button>}</div> }
      </section>
    }

    @if (selected(); as person) {
      <section class="selected-header"><button class="btn btn--ghost" type="button" (click)="backToResults()">← Volver a resultados</button><div><span>RECUPERACIÓN EN CURSO</span><h2>Recuperar equipos de {{ person.nombre }}</h2><p>{{ person.rut }} · {{ person.cargo || 'Sin cargo' }} · {{ person.departamento?.nombre || 'Sin departamento' }}</p></div><strong>{{ selectedAssets().length }} {{ selectedAssets().length === 1 ? 'activo pendiente' : 'activos pendientes' }}</strong></section>
      @if (!selectedAssets().length) { <section class="card no-assets"><span><svg lucidePackageCheck></svg></span><app-view-state kind="empty" title="No hay colaboradores con activos pendientes" message="Este colaborador no mantiene equipos en custodia según el inventario actual." /></section> }
      @else { <div class="asset-recovery-list">@for(device of selectedAssets(); track device.id){<article class="recovery-card"><div class="recovery-card__identity"><span class="device-icon"><svg lucidePackageCheck></svg></span><div><span>{{ device.tipo.nombre }}</span><h3>{{ device.marca || 'Sin marca' }} {{ device.modelo || '' }}</h3><p class="code">SN: {{ device.numeroSerie || '—' }} | Cód: {{ device.codigoInventario }}</p></div></div><app-status-badge [code]="device.estado.codigo" [label]="device.estado.nombre" /><div class="accessory-note"><svg lucideCircleAlert></svg><span><strong>Accesorios</strong>La API actual no almacena accesorios; no se muestran datos ficticios.</span></div><button class="btn btn--primary" type="button" (click)="openReceipt(device)"><svg lucideRotateCcw></svg>Marcar Recuperado</button></article>}</div> }
    }

    @if (receiving(); as device) {
      <div class="dialog-backdrop" role="presentation" (click)="closeBackdrop($event)"><form class="dialog receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title" [formGroup]="receiptForm" (ngSubmit)="receive()"><header class="receipt-dialog__header"><span><svg lucideCircleAlert></svg></span><div><small>CADENA DE CUSTODIA</small><h2 id="receipt-dialog-title">Confirmar Recepción</h2></div><button type="button" class="icon-button" aria-label="Cerrar" (click)="receiving.set(null)"><svg lucideX></svg></button></header><p>Está a punto de recibir:</p><div class="receiving-device"><strong>{{ device.tipo.nombre }} {{ device.marca || '' }} {{ device.modelo || '' }}</strong><span>SN: {{ device.numeroSerie || '—' }} · Código {{ device.codigoInventario }}</span></div><div class="field"><label for="condition">Condición física y observaciones</label><textarea id="condition" formControlName="observaciones" placeholder="Describa el estado de recepción, daños visibles u otros antecedentes"></textarea><p class="hint">Esta observación sí quedará asociada al evento de devolución.</p></div><div class="field"><label for="responsible">Responsable TI *</label><input id="responsible" formControlName="responsable" maxlength="150" [class.invalid]="receiptForm.controls.responsable.invalid && receiptForm.controls.responsable.touched" />@if(receiptForm.controls.responsable.invalid && receiptForm.controls.responsable.touched){<p class="field-error">Identifique a quien recibe el activo.</p>}</div>@if(receiptError()){<div class="notice notice--error">{{ receiptError() }}</div>}<footer><button class="btn btn--secondary" type="button" (click)="receiving.set(null)">Cancelar</button><button class="btn btn--primary" type="submit" [disabled]="submitting()">{{ submitting() ? 'Recibiendo…' : 'Confirmar y recibir' }}</button></footer></form></div>
    }
    @if (receiptPreview(); as device) { <app-document-preview documentType="receipt" [device]="device" [collaborator]="selected()" [observations]="lastObservations()" (close)="receiptPreview.set(null)" /> }
  `,
  styleUrl: './offboarding.scss'
})
export class Offboarding {
  private readonly fb = inject(FormBuilder);
  private readonly peopleService = inject(ColaboradoresService);
  private readonly devicesService = inject(DispositivosService);
  private readonly toast = inject(ToastService);
  protected readonly searchForm = this.fb.nonNullable.group({ query: ['', [Validators.required, Validators.minLength(2)]] });
  protected readonly receiptForm = this.fb.nonNullable.group({ responsable: ['', [Validators.required, Validators.maxLength(150)]], observaciones: [''] });
  protected readonly results = signal<EmployeeResult[]>([]);
  protected readonly allAssets = signal<Dispositivo[]>([]);
  protected readonly selected = signal<Colaborador | null>(null);
  protected readonly selectedAssets = signal<Dispositivo[]>([]);
  protected readonly receiving = signal<Dispositivo | null>(null);
  protected readonly receiptPreview = signal<Dispositivo | null>(null);
  protected readonly lastObservations = signal('');
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly submitting = signal(false);
  protected readonly searchError = signal('');
  protected readonly receiptError = signal('');

  protected search(): void {
    if (this.searchForm.invalid) { this.searchForm.markAllAsTouched(); return; }
    const query = this.searchForm.controls.query.value.trim();
    this.searching.set(true); this.searched.set(true); this.searchError.set(''); this.selected.set(null);
    const filter = /\d|[.-]/.test(query) ? { rut: query } : { nombre: query };
    forkJoin({ people: this.peopleService.listar(filter), assets: this.devicesService.listar() }).subscribe({ next: ({ people, assets }) => { this.allAssets.set(assets); this.results.set(people.map((person) => ({ person, assetCount: assets.filter((asset) => asset.colaborador?.id === person.id).length }))); this.searching.set(false); }, error: (error) => { this.searchError.set(errorMessage(error)); this.searching.set(false); } });
  }
  protected select(person: Colaborador): void { this.selected.set(person); this.refreshSelectedAssets(); }
  protected backToResults(): void { this.selected.set(null); this.selectedAssets.set([]); }
  protected openReceipt(device: Dispositivo): void { this.receiptForm.reset({ responsable: '', observaciones: '' }); this.receiptError.set(''); this.receiving.set(device); }
  protected closeBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget) this.receiving.set(null); }
  protected receive(): void {
    if (this.receiptForm.invalid) { this.receiptForm.markAllAsTouched(); return; }
    const device = this.receiving(); if (!device) return;
    const value = this.receiptForm.getRawValue(); this.submitting.set(true); this.receiptError.set('');
    this.devicesService.devolver(device.codigoInventario, { responsable: value.responsable.trim(), observaciones: value.observaciones.trim() || null }).subscribe({ next: (updated) => { this.allAssets.update((items) => items.map((item) => item.id === updated.id ? updated : item)); this.lastObservations.set(value.observaciones); this.receiving.set(null); this.submitting.set(false); this.refreshSelectedAssets(); this.receiptPreview.set(updated); this.toast.success('Activo recuperado', 'La devolución quedó registrada en el historial.'); }, error: (error) => { this.receiptError.set(errorMessage(error)); this.submitting.set(false); } });
  }
  private refreshSelectedAssets(): void { const id = this.selected()?.id; this.selectedAssets.set(id ? this.allAssets().filter((asset) => asset.colaborador?.id === id) : []); }
}
