import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideCircleAlert,
  LucidePackageCheck,
  LucideRotateCcw,
  LucideSearch,
  LucideUserMinus,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import { forkJoin } from 'rxjs';
import { Colaborador, ComprobanteDevolucion, Dispositivo, PendienteOffboarding, ResultadoOffboarding } from '../../core/models/itam.models';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { ComprobantesDevolucionService } from '../../core/services/comprobantes-devolucion.service';
import { ToastService } from '../../core/services/toast.service';
import { ComprobanteDevolucionPreview } from '../../shared/components/document-preview/comprobante-devolucion-preview';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';
import { formatClp } from '../../shared/utils/currency';

interface EmployeeResult {
  person: Colaborador;
  assetCount: number;
}

@Component({
  selector: 'app-offboarding',
  imports: [
    ReactiveFormsModule,
    ComprobanteDevolucionPreview,
    PageHeader,
    StatusBadge,
    ViewState,
    LucideCircleAlert,
    LucidePackageCheck,
    LucideRotateCcw,
    LucideSearch,
    LucideUserMinus,
    LucideUsers,
    LucideX,
  ],
  template: `
    <app-page-header
      title="Offboarding & Recuperación"
      subtitle="Busque a la persona por RUT o nombre para recibir sus equipos."
      eyebrow="Salida de personal y recepción de equipos"
    />
    <section class="offboarding-hero">
      <div class="offboarding-hero__copy">
        <span><svg lucideUserMinus></svg></span>
        <div>
          <h2>Recepción de equipos tecnológicos</h2>
          <p>
            Identifique a la persona y gestione cada equipo pendiente.
            Todas las recepciones quedan registradas en el historial del equipo y de la persona.
          </p>
        </div>
      </div>
      <form class="employee-search" [formGroup]="searchForm" (ngSubmit)="search()">
        <svg lucideSearch></svg
        ><label class="sr-only" for="employee-search">Buscar persona por RUT o nombre</label
        ><input
          id="employee-search"
          formControlName="query"
          placeholder="Buscar persona por RUT o nombre..."
          autocomplete="off"
        /><button class="btn btn--primary" type="submit" [disabled]="searching()">
          {{ searching() ? 'Buscando…' : 'Buscar' }}
        </button>
      </form>
    </section>

    <section class="card global-summary" aria-labelledby="global-summary-title">
      <header>
        <div>
          <span>PANORAMA GLOBAL</span>
          <h2 id="global-summary-title">Equipos pendientes de recepción</h2>
        </div>
        <p>Equipos que siguen registrados a nombre de una persona, antes de iniciar la búsqueda.</p>
      </header>
      @if (globalLoading()) {
        <app-view-state
          kind="loading"
          title="Calculando equipos pendientes"
          message="Consultando el inventario real…"
        />
      } @else if (globalError()) {
        <app-view-state
          kind="error"
          title="No se pudo cargar el resumen"
          [message]="globalError()"
          (retry)="loadGlobalSummary()"
        />
      } @else {
        <div class="offboarding-values global-summary__grid">
          <div>
            <span>Personas con equipos pendientes</span>
            <strong>{{ pendingCollaborators() }}</strong>
          </div>
          <div>
            <span>Total de equipos por recibir</span>
            <strong>{{ pendingAssetsCount() }}</strong>
          </div>
          <div class="global-summary__value">
            <span>Valor total pendiente</span>
            <strong>{{ clp(globalPendingValue()) }}</strong>
          </div>
        </div>
      }
    </section>

    <section class="card pending-list" aria-labelledby="pending-list-title">
      <header><div><span>SEGUIMIENTO OPERATIVO</span><h2 id="pending-list-title">EQUIPOS PENDIENTES DE RECEPCIÓN</h2></div></header>
      @if (!globalLoading() && !globalError()) {
        @if (!pendingRows().length) {
          <app-view-state kind="empty" title="Sin equipos por recuperar" message="No hay equipos pendientes de recuperación actualmente." />
        } @else {
          <div class="table-wrap desktop-table"><table class="data-table pending-table">
            <thead><tr><th>Persona</th><th>RUT</th><th>Departamento</th><th>Equipos pendientes</th><th>Valor pendiente</th><th>Estado</th><th>Acción</th></tr></thead>
            <tbody>@for (row of pendingRows(); track row.colaborador.id) {<tr><td><strong>{{ row.colaborador.nombre }}</strong></td><td>{{ row.colaborador.rut }}</td><td>{{ row.colaborador.departamento?.nombre || 'Sin departamento' }}</td><td>{{ row.activosPendientes }}</td><td>{{ clp(row.valorPendiente) }}</td><td><app-status-badge code="PENDIENTE" label="Pendiente" /></td><td><button class="btn btn--secondary btn--small" type="button" (click)="manage(row)">Gestionar</button></td></tr>}</tbody>
          </table></div>
          <div class="mobile-record-list pending-mobile-list">
            @for (row of pendingRows(); track row.colaborador.id) {
              <article class="mobile-record-card">
                <header class="mobile-record-card__top">
                  <div><strong class="mobile-record-card__title">{{ row.colaborador.nombre }}</strong><span class="mobile-record-card__subtitle">{{ row.colaborador.rut }}</span></div>
                  <app-status-badge code="PENDIENTE" label="Pendiente" />
                </header>
                <dl class="mobile-record-card__details">
                  <div><dt>Departamento</dt><dd>{{ row.colaborador.departamento?.nombre || 'Sin departamento' }}</dd></div>
                  <div><dt>Activos pendientes</dt><dd>{{ row.activosPendientes }}</dd></div>
                  <div><dt>Valor pendiente</dt><dd>{{ clp(row.valorPendiente) }}</dd></div>
                </dl>
                <footer class="mobile-record-card__actions"><button class="btn btn--primary" type="button" (click)="manage(row)">Gestionar recuperacion</button></footer>
              </article>
            }
          </div>
        }
      }
    </section>

    @if (searchError()) {
      <div class="notice notice--error"><svg lucideCircleAlert></svg>{{ searchError() }}</div>
    }
    @if (searching()) {
      <section class="card">
        <app-view-state
          kind="loading"
          title="Buscando personas"
          message="Consultando equipos pendientes…"
        />
      </section>
    } @else if (searched() && !selected()) {
      <section class="results-section">
        <header>
          <div>
            <span>RESULTADOS</span>
            <h2>Personas encontradas</h2>
          </div>
          <strong>{{ results().length }}</strong>
        </header>
        @if (!results().length) {
          <section class="card">
            <app-view-state
              kind="empty"
              title="Sin coincidencias"
              message="No encontramos personas con ese nombre o RUT."
            />
          </section>
        } @else {
          <div class="employee-grid">
            @for (result of results(); track result.person.id) {
              <button type="button" class="employee-card" (click)="select(result.person)">
                <span class="employee-card__icon"><svg lucideUsers></svg></span
                ><span
                  ><strong>{{ result.person.nombre }}</strong
                  ><small>{{ result.person.rut }} · {{ result.person.cargo || 'Sin cargo' }}</small
                  ><small>{{
                    result.person.departamento?.nombre || 'Sin departamento'
                  }}</small></span
                ><b [class.has-assets]="result.assetCount > 0"
                  >{{ result.assetCount }} {{ result.assetCount === 1 ? 'equipo' : 'equipos' }}</b
                >
              </button>
            }
          </div>
        }
      </section>
    }

    @if (selected(); as person) {
      <section class="selected-header">
        <button class="btn btn--ghost" type="button" (click)="backToResults()">
          ← Volver a resultados
        </button>
        <div>
          <span>RECEPCIÓN EN CURSO</span>
          <h2>Recibir equipos de {{ person.nombre }}</h2>
          <p>
            {{ person.rut }} · {{ person.cargo || 'Sin cargo' }} ·
            {{ person.departamento?.nombre || 'Sin departamento' }}
          </p>
        </div>
        <strong
          >{{ selectedAssets().length }}
          {{ selectedAssets().length === 1 ? 'equipo pendiente' : 'equipos pendientes' }}</strong
        >
      </section>
      <section class="offboarding-values">
        <div>
          <span>Valor total de equipos asignados</span><strong>{{ clp(totalCustody()) }}</strong>
        </div>
        <div>
          <span>Valor recuperado</span><strong>{{ clp(recoveredValue()) }}</strong>
        </div>
        <div>
          <span>Valor de equipos por recuperar</span><strong>{{ clp(pendingValue()) }}</strong>
        </div>
      </section>
      @if (!selectedAssets().length) {
        <section class="card no-assets">
          <span><svg lucidePackageCheck></svg></span
          ><app-view-state
            kind="empty"
            title="No hay personas con equipos pendientes"
            message="Esta persona no tiene equipos pendientes según el inventario actual."
          />
        </section>
      } @else {
        <div class="asset-recovery-list">
          @for (device of selectedAssets(); track device.id) {
            <article class="recovery-card">
              <div class="recovery-card__identity">
                <span class="device-icon"><svg lucidePackageCheck></svg></span>
                <div>
                  <span>{{ device.tipo.nombre }}</span>
                  <h3>{{ device.marca || 'Sin marca' }} {{ device.modelo || '' }}</h3>
                  <p class="code">
                    {{
                      device.imei ? 'IMEI: ' + device.imei : 'SN: ' + (device.numeroSerie || '—')
                    }}
                    | Cód: {{ device.codigoInventario }}
                  </p>
                  <strong>{{ clp(device.valorComercial) }}</strong>
                </div>
              </div>
              <app-status-badge
                [code]="device.estado.codigo"
                [label]="outcomes()[device.id] || 'Pendiente'"
              />
              <div class="accessory-note">
                <svg lucideCircleAlert></svg
                ><span
                  ><strong>Accesorios</strong>El sistema no almacena accesorios; no se muestran
                  datos ficticios.</span
                >
              </div>
              <button class="btn btn--primary" type="button" (click)="openReceipt(device)">
                <svg lucideRotateCcw></svg>Resolver equipo
              </button>
            </article>
          }
        </div>
      }
    }

    @if (receiving(); as device) {
      <div class="dialog-backdrop" role="presentation" (click)="closeBackdrop($event)">
        <form
          class="dialog receipt-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="receipt-dialog-title"
          [formGroup]="receiptForm"
          (ngSubmit)="receive()"
        >
          <header class="receipt-dialog__header">
            <span><svg lucideCircleAlert></svg></span>
            <div>
              <small>RECEPCIÓN DE EQUIPO</small>
              <h2 id="receipt-dialog-title">Registrar recepción</h2>
            </div>
            <button
              type="button"
              class="icon-button"
              aria-label="Cerrar"
              (click)="receiving.set(null)"
            >
              <svg lucideX></svg>
            </button>
          </header>
          <p>Equipo en revisión:</p>
          <div class="receiving-device">
            <strong
              >{{ device.tipo.nombre }} {{ device.marca || '' }} {{ device.modelo || '' }}</strong
            ><span
              >{{ device.imei ? 'IMEI: ' + device.imei : 'SN: ' + (device.numeroSerie || '—') }} ·
              Código {{ device.codigoInventario }}</span
            >
          </div>
          <div class="field">
            <label for="outcome">Resultado individual *</label
            ><select id="outcome" formControlName="resultado">
              <option value="DEVUELTO">Devuelto</option>
              <option value="PENDIENTE">Pendiente</option>
              <option value="DANADO">Dañado</option>
              <option value="NO_ENTREGADO">No entregado</option>
              <option value="EXTRAVIADO">Equipo perdido</option>
              <option value="ROBADO">Reportado como robado/hurtado</option>
            </select>
          </div>
          <div class="field">
            <label for="physical-condition">Condición</label
            ><input
              id="physical-condition"
              formControlName="condicion"
              maxlength="120"
              placeholder="Estado físico observado"
            />
          </div>
          <div class="field">
            <label for="condition">Observación</label
            ><textarea
              id="condition"
              formControlName="observaciones"
              placeholder="Registre antecedentes objetivos de la recepción"
            ></textarea>
          </div>
          <div class="field">
            <label for="responsible">Responsable TI que recibe *</label
            ><input
              id="responsible"
              formControlName="responsable"
              maxlength="150"
              [class.invalid]="
                receiptForm.controls.responsable.invalid && receiptForm.controls.responsable.touched
              "
            />
            @if (
              receiptForm.controls.responsable.invalid && receiptForm.controls.responsable.touched
            ) {
              <p class="field-error">Identifique a quien recibe el activo.</p>
            }
          </div>
          @if (receiptError()) {
            <div class="notice notice--error">{{ receiptError() }}</div>
          }
          <footer>
            <button class="btn btn--secondary" type="button" (click)="receiving.set(null)">
              Cancelar</button
            ><button class="btn btn--primary" type="submit" [disabled]="submitting()">
              {{ submitting() ? 'Registrando…' : 'Confirmar resultado' }}
            </button>
          </footer>
        </form>
      </div>
    }
    @if (receiptPreview(); as proof) {
      <app-comprobante-devolucion-preview
        [comprobante]="proof"
        [pdfUrl]="proofService.pdfUrl(proof.id)"
        (close)="receiptPreview.set(null)"
      />
    }
  `,
  styleUrl: './offboarding.scss',
})
export class Offboarding implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly peopleService = inject(ColaboradoresService);
  private readonly devicesService = inject(DispositivosService);
  protected readonly proofService = inject(ComprobantesDevolucionService);
  private readonly toast = inject(ToastService);
  protected readonly searchForm = this.fb.nonNullable.group({
    query: ['', [Validators.required, Validators.minLength(2)]],
  });
  protected readonly receiptForm = this.fb.nonNullable.group({
    resultado: [
      'DEVUELTO' as 'DEVUELTO' | 'PENDIENTE' | 'DANADO' | 'NO_ENTREGADO' | 'EXTRAVIADO' | 'ROBADO',
      Validators.required,
    ],
    condicion: [''],
    responsable: ['', [Validators.required, Validators.maxLength(150)]],
    observaciones: [''],
  });
  protected readonly results = signal<EmployeeResult[]>([]);
  protected readonly allAssets = signal<Dispositivo[]>([]);
  protected readonly selected = signal<Colaborador | null>(null);
  protected readonly selectedAssets = signal<Dispositivo[]>([]);
  protected readonly receiving = signal<Dispositivo | null>(null);
  protected readonly receiptPreview = signal<ComprobanteDevolucion | null>(null);
  protected readonly lastObservations = signal('');
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly submitting = signal(false);
  protected readonly searchError = signal('');
  protected readonly receiptError = signal('');
  protected readonly outcomes = signal<Record<string, string>>({});
  protected readonly recoveredValue = signal(0);
  protected readonly globalLoading = signal(true);
  protected readonly globalError = signal('');
  protected readonly pendingCollaborators = signal(0);
  protected readonly pendingAssetsCount = signal(0);
  protected readonly globalPendingValue = signal(0);
  protected readonly pendingRows = signal<PendienteOffboarding[]>([]);
  protected readonly clp = formatClp;

  ngOnInit(): void {
    this.loadGlobalSummary();
  }

  protected loadGlobalSummary(): void {
    this.globalLoading.set(true);
    this.globalError.set('');
    this.peopleService.pendientesOffboarding().subscribe({
      next: (rows) => {
        this.pendingRows.set(rows);
        this.pendingCollaborators.set(rows.length);
        this.pendingAssetsCount.set(rows.reduce((total,row)=>total+row.activosPendientes,0));
        this.globalPendingValue.set(rows.reduce((total,row)=>total+row.valorPendiente,0));
        this.globalLoading.set(false);
      },
      error: (error) => {
        this.globalError.set(errorMessage(error));
        this.globalLoading.set(false);
      },
    });
  }
  protected manage(row:PendienteOffboarding):void {
    this.searchForm.controls.query.setValue(row.colaborador.rut);
    this.search();
  }
  protected totalCustody(): number {
    return (
      this.selectedAssets().reduce((sum, item) => sum + item.valorComercial, 0) +
      this.recoveredValue()
    );
  }
  protected pendingValue(): number {
    return this.selectedAssets().reduce((sum, item) => sum + item.valorComercial, 0);
  }

  protected search(): void {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }
    const query = this.searchForm.controls.query.value.trim();
    this.searching.set(true);
    this.searched.set(true);
    this.searchError.set('');
    this.selected.set(null);
    const filter = /\d|[.-]/.test(query) ? { rut: query } : { nombre: query };
    forkJoin({
      people: this.peopleService.listar(filter),
      assets: this.devicesService.listar(),
    }).subscribe({
      next: ({ people, assets }) => {
        this.allAssets.set(assets);
        this.outcomes.set(
          Object.fromEntries(
            assets
              .filter((asset) => asset.ultimoResultadoOffboarding)
              .map((asset) => [asset.id, this.outcomeLabel(asset.ultimoResultadoOffboarding)]),
          ),
        );
        this.results.set(
          people.map((person) => ({
            person,
            assetCount: assets.filter((asset) => asset.colaborador?.id === person.id).length,
          })),
        );
        this.searching.set(false);
      },
      error: (error) => {
        this.searchError.set(errorMessage(error));
        this.searching.set(false);
      },
    });
  }
  protected select(person: Colaborador): void {
    this.selected.set(person);
    this.refreshSelectedAssets();
  }
  protected backToResults(): void {
    this.selected.set(null);
    this.selectedAssets.set([]);
  }
  protected openReceipt(device: Dispositivo): void {
    this.receiptForm.reset({
      resultado: 'DEVUELTO',
      condicion: '',
      responsable: '',
      observaciones: '',
    });
    this.receiptError.set('');
    this.receiving.set(device);
  }
  protected closeBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.receiving.set(null);
  }
  protected receive(): void {
    if (this.receiptForm.invalid) {
      this.receiptForm.markAllAsTouched();
      return;
    }
    const device = this.receiving();
    if (!device) return;
    const value = this.receiptForm.getRawValue();
    this.submitting.set(true);
    this.receiptError.set('');
    const resultado: ResultadoOffboarding =
      value.resultado === 'ROBADO' ? 'ROBADO_HURTADO' : value.resultado;
    const returned = resultado === 'DEVUELTO' || resultado === 'DANADO';
    const observation = [value.resultado.replaceAll('_', ' '), value.observaciones.trim()]
      .filter(Boolean)
      .join(' · ');
    const request = this.devicesService.registrarResultadoOffboarding(device.codigoInventario, {
      resultado,
      responsable: value.responsable.trim(),
      observaciones: observation || null,
      condicion: value.condicion.trim() || null,
    });
    if (!request) {
      this.receiptError.set(
        'No existe el estado EXTRAVIADO requerido para registrar este resultado.',
      );
      this.submitting.set(false);
      return;
    }
    request.subscribe({
      next: (result) => {
        const updated = 'comprobante' in result ? result.dispositivo : result;
        this.allAssets.update((items) =>
          items.map((item) => (item.id === updated.id ? updated : item)),
        );
        this.outcomes.update((items) => ({
          ...items,
          [device.id]: value.resultado.replaceAll('_', ' '),
        }));
        if (returned) this.recoveredValue.update((total) => total + device.valorComercial);
        this.lastObservations.set(observation);
        this.receiving.set(null);
        this.submitting.set(false);
        this.refreshSelectedAssets();
        this.loadGlobalSummary();
        if (returned && 'comprobante' in result) {
          this.proofService.obtener(result.comprobante.id).subscribe({
            next: (proof) => this.receiptPreview.set(proof),
            error: (error) => this.toast.warning('Devolución registrada', `No fue posible abrir el comprobante: ${errorMessage(error)}`),
          });
        }
        this.toast.success(
          'Resultado registrado',
          returned
            ? 'La devolución y su comprobante quedaron registrados.'
            : 'El activo continúa pendiente y su estado fue actualizado.',
        );
      },
      error: (error) => {
        this.receiptError.set(errorMessage(error));
        this.submitting.set(false);
      },
    });
  }
  protected outcomeLabel(value: ResultadoOffboarding | null): string {
    return value ? value.replaceAll('_', ' ') : 'Pendiente';
  }
  private refreshSelectedAssets(): void {
    const id = this.selected()?.id;
    this.selectedAssets.set(
      id ? this.allAssets().filter((asset) => asset.colaborador?.id === id) : [],
    );
  }
}
