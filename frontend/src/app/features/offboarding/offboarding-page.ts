import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  LucideCircleAlert,
  LucideCircleCheck,
  LucideSearch,
  LucideUserMinus,
  LucideUsers,
  LucideX,
} from '@lucide/angular';
import {
  OffboardingAsset,
  OffboardingProcessDetail,
  OffboardingProcessSummary,
  OffboardingSearchResult,
} from '../../core/models/offboarding.models';
import {
  ComprobanteDevolucion,
  ResultadoOffboarding,
} from '../../core/models/itam.models';
import { AuthService } from '../../core/services/auth.service';
import { ComprobantesDevolucionService } from '../../core/services/comprobantes-devolucion.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { OffboardingService } from '../../core/services/offboarding.service';
import { ToastService } from '../../core/services/toast.service';
import { ComprobanteDevolucionPreview } from '../../shared/components/document-preview/comprobante-devolucion-preview';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { formatClp } from '../../shared/utils/currency';
import { errorMessage } from '../../shared/utils/error-message';
import { OffboardingProcessDetailComponent } from './offboarding-process-detail';

type DetailSource = 'search' | 'desktop' | 'mobile';

@Component({
  selector: 'app-offboarding-page',
  imports: [
    ReactiveFormsModule,
    ComprobanteDevolucionPreview,
    OffboardingProcessDetailComponent,
    PageHeader,
    StatusBadge,
    ViewState,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideSearch,
    LucideUserMinus,
    LucideUsers,
    LucideX,
  ],
  template: `
    <app-page-header
      title="Offboarding & Recuperación"
      subtitle="Busca a una persona para iniciar o continuar su proceso de salida y revisar los equipos que debe devolver."
      eyebrow="Salida y recuperación de equipos"
    />

    <section class="offboarding-hero">
      <div class="offboarding-hero__copy">
        <span><svg lucideUserMinus></svg></span>
        <div>
          <h2>Gestión de procesos de salida</h2>
          <p>
            Tener equipos asignados no inicia un proceso. Busca a la persona y comienza el proceso
            solo cuando corresponda.
          </p>
        </div>
      </div>
      <form class="employee-search" [formGroup]="searchForm" (ngSubmit)="search()">
        <svg lucideSearch></svg>
        <label class="sr-only" for="offboarding-search">Buscar por RUT o nombre</label>
        <input
          id="offboarding-search"
          formControlName="query"
          placeholder="Buscar por RUT o nombre…"
          autocomplete="off"
        />
        <button class="btn btn--primary" type="submit" [disabled]="searching()">
          {{ searching() ? 'Buscando…' : 'Buscar' }}
        </button>
      </form>
    </section>

    @if (searching()) {
      <section class="card search-results">
        <app-view-state
          kind="loading"
          title="Buscando personas"
          message="Consultando colaboradores…"
        />
      </section>
    } @else if (searched()) {
      <section class="search-results" aria-labelledby="search-results-title">
        <header class="section-heading">
          <div><span>RESULTADOS</span><h2 id="search-results-title">Personas encontradas</h2></div>
          <strong>{{ results().length }}</strong>
        </header>
        @if (searchError()) {
          <div class="notice notice--error"><svg lucideCircleAlert></svg>{{ searchError() }}</div>
        } @else if (!results().length) {
          <section class="card">
            <app-view-state
              kind="empty"
              title="Sin coincidencias"
              message="No encontramos personas con ese nombre o RUT."
            />
          </section>
        } @else {
          <div class="employee-grid">
            @for (result of results(); track result.colaborador.id) {
              <article class="employee-result" [class.employee-result--open]="isExpanded(result.procesoAbiertoId, 'search')">
                <div class="employee-card">
                  <span class="employee-card__icon"><svg lucideUsers></svg></span>
                  <div class="employee-card__identity">
                    <strong>{{ result.colaborador.nombre }}</strong>
                    <span>{{ result.colaborador.rut }} · {{ result.colaborador.cargo || 'Sin cargo' }}</span>
                    <span>{{ result.colaborador.departamento?.nombre || 'Sin departamento' }}</span>
                  </div>
                  <div class="employee-card__assets">
                    <strong>{{ result.equiposAsignados }}</strong>
                    <span>{{ result.equiposAsignados === 1 ? 'equipo asignado' : 'equipos asignados' }}</span>
                  </div>
                  @if (result.procesoAbiertoId) {
                    <button
                      class="btn btn--secondary"
                      type="button"
                      [attr.aria-expanded]="isExpanded(result.procesoAbiertoId, 'search')"
                      (click)="toggleProcess(result.procesoAbiertoId, 'search', 'search-process-' + result.procesoAbiertoId)"
                    >
                      {{ isExpanded(result.procesoAbiertoId, 'search') ? 'Contraer' : 'Continuar proceso' }}
                    </button>
                  } @else {
                    <button class="btn btn--primary" type="button" (click)="requestStart(result)">
                      Iniciar proceso
                    </button>
                  }
                </div>
                @if (isExpanded(result.procesoAbiertoId, 'search')) {
                  <div class="inline-detail" [id]="'search-process-' + result.procesoAbiertoId">
                    @if (detailLoading()) {
                      <app-view-state kind="loading" title="Abriendo proceso" message="Cargando equipos…" />
                    } @else if (detailError()) {
                      <app-view-state kind="error" title="No se pudo abrir" [message]="detailError()" (retry)="reloadDetail()" />
                    } @else if (detail(); as current) {
                      <app-offboarding-process-detail
                        [process]="current"
                        [closing]="closing()"
                        (resolve)="openResolution($event)"
                        (complete)="requestClose(current)"
                      />
                    }
                  </div>
                }
              </article>
            }
          </div>
        }
      </section>
    }

    <section class="card global-summary" aria-labelledby="global-summary-title">
      <header>
        <div><span>PANORAMA GLOBAL</span><h2 id="global-summary-title">Procesos de salida abiertos</h2></div>
        <p>Solo incluye procesos iniciados explícitamente.</p>
      </header>
      @if (loadingProcesses()) {
        <app-view-state kind="loading" title="Cargando panorama" message="Consultando procesos abiertos…" />
      } @else if (processError()) {
        <app-view-state kind="error" title="No se pudo cargar el panorama" [message]="processError()" (retry)="loadProcesses()" />
      } @else {
        <div class="summary-values">
          <div><span>Personas en proceso de salida</span><strong>{{ openProcesses().length }}</strong></div>
          <div><span>Equipos por recuperar</span><strong>{{ pendingAssets() }}</strong></div>
          <div class="summary-values__money"><span>Valor pendiente</span><strong>{{ clp(pendingValue()) }}</strong></div>
        </div>
      }
    </section>

    <section class="card process-list" aria-labelledby="process-list-title">
      <header class="section-heading">
        <div><span>SEGUIMIENTO</span><h2 id="process-list-title">Procesos en curso</h2></div>
      </header>
      @if (!loadingProcesses() && !processError()) {
        @if (!openProcesses().length) {
          <app-view-state
            kind="empty"
            title="No hay procesos de salida pendientes."
            message="Busca a una persona para iniciar un proceso cuando corresponda."
          />
        } @else {
          <div class="table-wrap desktop-table">
            <table class="data-table process-table">
              <thead><tr><th>Colaborador</th><th>RUT</th><th>Departamento</th><th>Equipos por recuperar</th><th>Valor pendiente</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>
                @for (process of openProcesses(); track process.id) {
                  <tr [class.selected-row]="isExpanded(process.id, 'desktop')">
                    <td><strong>{{ process.colaborador.nombre }}</strong></td>
                    <td>{{ process.colaborador.rut }}</td>
                    <td>{{ process.colaborador.departamento?.nombre || 'Sin departamento' }}</td>
                    <td>{{ process.equiposPendientes }}</td>
                    <td>{{ clp(process.valorPendiente) }}</td>
                    <td><app-status-badge code="ABIERTO" label="En proceso" /></td>
                    <td>
                      <button
                        class="btn btn--secondary btn--small"
                        type="button"
                        [attr.aria-expanded]="isExpanded(process.id, 'desktop')"
                        (click)="toggleProcess(process.id, 'desktop', 'desktop-process-' + process.id)"
                      >{{ isExpanded(process.id, 'desktop') ? 'Contraer' : 'Gestionar' }}</button>
                    </td>
                  </tr>
                  @if (isExpanded(process.id, 'desktop')) {
                    <tr class="detail-row" [id]="'desktop-process-' + process.id">
                      <td colspan="7">
                        @if (detailLoading()) {
                          <app-view-state kind="loading" title="Abriendo proceso" message="Cargando equipos…" />
                        } @else if (detailError()) {
                          <app-view-state kind="error" title="No se pudo abrir" [message]="detailError()" (retry)="reloadDetail()" />
                        } @else if (detail(); as current) {
                          <app-offboarding-process-detail
                            [process]="current"
                            [closing]="closing()"
                            (resolve)="openResolution($event)"
                            (complete)="requestClose(current)"
                          />
                        }
                      </td>
                    </tr>
                  }
                }
              </tbody>
            </table>
          </div>

          <div class="mobile-record-list process-mobile-list">
            @for (process of openProcesses(); track process.id) {
              <article class="mobile-process-card" [class.mobile-process-card--open]="isExpanded(process.id, 'mobile')">
                <div class="mobile-process-card__summary">
                  <header><div><strong>{{ process.colaborador.nombre }}</strong><span>{{ process.colaborador.rut }}</span></div><app-status-badge code="ABIERTO" label="En proceso" /></header>
                  <dl>
                    <div><dt>Departamento</dt><dd>{{ process.colaborador.departamento?.nombre || 'Sin departamento' }}</dd></div>
                    <div><dt>Equipos por recuperar</dt><dd>{{ process.equiposPendientes }}</dd></div>
                    <div><dt>Valor pendiente</dt><dd>{{ clp(process.valorPendiente) }}</dd></div>
                  </dl>
                  <button
                    class="btn btn--primary"
                    type="button"
                    [attr.aria-expanded]="isExpanded(process.id, 'mobile')"
                    (click)="toggleProcess(process.id, 'mobile', 'mobile-process-' + process.id)"
                  >{{ isExpanded(process.id, 'mobile') ? 'Contraer' : 'Gestionar' }}</button>
                </div>
                @if (isExpanded(process.id, 'mobile')) {
                  <div class="inline-detail" [id]="'mobile-process-' + process.id">
                    @if (detailLoading()) {
                      <app-view-state kind="loading" title="Abriendo proceso" message="Cargando equipos…" />
                    } @else if (detailError()) {
                      <app-view-state kind="error" title="No se pudo abrir" [message]="detailError()" (retry)="reloadDetail()" />
                    } @else if (detail(); as current) {
                      <app-offboarding-process-detail
                        [process]="current"
                        [closing]="closing()"
                        (resolve)="openResolution($event)"
                        (complete)="requestClose(current)"
                      />
                    }
                  </div>
                }
              </article>
            }
          </div>
        }
      }
    </section>

    @if (startCandidate(); as candidate) {
      <div class="dialog-backdrop" role="presentation" (click)="closeStartBackdrop($event)">
        <form class="dialog confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="start-title" [formGroup]="startForm" (ngSubmit)="startProcess()">
          <header><span><svg lucideUserMinus></svg></span><div><small>INICIO EXPLÍCITO</small><h2 id="start-title">Iniciar proceso de salida</h2></div><button class="icon-button" type="button" aria-label="Cerrar" (click)="startCandidate.set(null)"><svg lucideX></svg></button></header>
          <p>Se iniciará el proceso de <strong>{{ candidate.colaborador.nombre }}</strong>. Esta acción no cambia equipos, estados ni datos de la persona.</p>
          <div class="field"><label for="start-observations">Observaciones</label><textarea id="start-observations" formControlName="observations" placeholder="Antecedentes del proceso (opcional)"></textarea></div>
          @if (startError()) { <div class="notice notice--error">{{ startError() }}</div> }
          <footer><button class="btn btn--secondary" type="button" (click)="startCandidate.set(null)">Cancelar</button><button class="btn btn--primary" type="submit" [disabled]="starting()">{{ starting() ? 'Iniciando…' : 'Confirmar e iniciar' }}</button></footer>
        </form>
      </div>
    }

    @if (resolvingAsset(); as asset) {
      <div class="dialog-backdrop" role="presentation" (click)="closeResolutionBackdrop($event)">
        <form class="dialog resolution-dialog" role="dialog" aria-modal="true" aria-labelledby="resolution-title" [formGroup]="resolutionForm" (ngSubmit)="resolveAsset()">
          <header><span><svg lucideCircleAlert></svg></span><div><small>RECUPERACIÓN</small><h2 id="resolution-title">Resolver activo</h2></div><button class="icon-button" type="button" aria-label="Cerrar" (click)="resolvingAsset.set(null)"><svg lucideX></svg></button></header>
          <div class="selected-asset"><strong>{{ asset.tipo.nombre }} {{ asset.marca || '' }} {{ asset.modelo || '' }}</strong><span>Código ITAM {{ asset.codigoInventario }}</span></div>
          <div class="field"><label for="outcome">Resultado *</label><select id="outcome" formControlName="resultado"><option value="DEVUELTO">Devuelto</option><option value="PENDIENTE">Pendiente</option><option value="DANADO">Dañado</option><option value="NO_ENTREGADO">No entregado</option><option value="EXTRAVIADO">Extraviado</option><option value="ROBADO_HURTADO">Robado o hurtado</option></select></div>
          <div class="field"><label for="physical-condition">Condición física</label><input id="physical-condition" formControlName="condicion" maxlength="120" /></div>
          <div class="field"><label for="resolution-observations">Observaciones</label><textarea id="resolution-observations" formControlName="observaciones" placeholder="Antecedentes objetivos de la recepción"></textarea></div>
          <p class="authenticated-user">Responsable TI: <strong>{{ authenticatedUser() }}</strong></p>
          @if (resolutionError()) { <div class="notice notice--error">{{ resolutionError() }}</div> }
          <footer><button class="btn btn--secondary" type="button" (click)="resolvingAsset.set(null)">Cancelar</button><button class="btn btn--primary" type="submit" [disabled]="resolving()">{{ resolving() ? 'Registrando…' : 'Confirmar resultado' }}</button></footer>
        </form>
      </div>
    }

    @if (closeCandidate(); as process) {
      <div class="dialog-backdrop" role="presentation" (click)="closeCompletionBackdrop($event)">
        <section class="dialog confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-title">
          <header><span><svg lucideCircleCheck></svg></span><div><small>CIERRE DEL PROCESO</small><h2 id="complete-title">Completar proceso</h2></div><button class="icon-button" type="button" aria-label="Cerrar" (click)="closeCandidate.set(null)"><svg lucideX></svg></button></header>
          <p>El proceso de <strong>{{ process.colaborador.nombre }}</strong> quedará completado y saldrá de la lista de procesos en curso.</p>
          @if (closeError()) { <div class="notice notice--error">{{ closeError() }}</div> }
          <footer><button class="btn btn--secondary" type="button" (click)="closeCandidate.set(null)">Cancelar</button><button class="btn btn--primary" type="button" [disabled]="closing()" (click)="completeProcess()">{{ closing() ? 'Completando…' : 'Confirmar cierre' }}</button></footer>
        </section>
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
  styleUrl: './offboarding-page.scss',
})
export class OffboardingPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly offboardingService = inject(OffboardingService);
  private readonly devicesService = inject(DispositivosService);
  private readonly auth = inject(AuthService);
  protected readonly proofService = inject(ComprobantesDevolucionService);
  private readonly toast = inject(ToastService);

  protected readonly searchForm = this.fb.nonNullable.group({
    query: ['', [Validators.required, Validators.minLength(2)]],
  });
  protected readonly startForm = this.fb.nonNullable.group({ observations: [''] });
  protected readonly resolutionForm = this.fb.nonNullable.group({
    resultado: ['DEVUELTO' as ResultadoOffboarding, Validators.required],
    condicion: ['', Validators.maxLength(120)],
    observaciones: [''],
  });

  protected readonly openProcesses = signal<OffboardingProcessSummary[]>([]);
  protected readonly loadingProcesses = signal(true);
  protected readonly processError = signal('');
  protected readonly results = signal<OffboardingSearchResult[]>([]);
  protected readonly searching = signal(false);
  protected readonly searched = signal(false);
  protected readonly searchError = signal('');
  protected readonly expandedProcessId = signal<string | null>(null);
  protected readonly expandedSource = signal<DetailSource | null>(null);
  protected readonly detail = signal<OffboardingProcessDetail | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal('');
  protected readonly startCandidate = signal<OffboardingSearchResult | null>(null);
  protected readonly starting = signal(false);
  protected readonly startError = signal('');
  protected readonly resolvingAsset = signal<OffboardingAsset | null>(null);
  protected readonly resolving = signal(false);
  protected readonly resolutionError = signal('');
  protected readonly closeCandidate = signal<OffboardingProcessDetail | null>(null);
  protected readonly closing = signal(false);
  protected readonly closeError = signal('');
  protected readonly receiptPreview = signal<ComprobanteDevolucion | null>(null);
  protected readonly pendingAssets = computed(() =>
    this.openProcesses().reduce((total, process) => total + process.equiposPendientes, 0),
  );
  protected readonly pendingValue = computed(() =>
    this.openProcesses().reduce((total, process) => total + process.valorPendiente, 0),
  );
  protected readonly authenticatedUser = computed(
    () => this.auth.user()?.nombre || 'Usuario autenticado',
  );
  protected readonly clp = formatClp;

  ngOnInit(): void {
    this.loadProcesses();
  }

  protected loadProcesses(): void {
    this.loadingProcesses.set(true);
    this.processError.set('');
    this.offboardingService.listarAbiertos().subscribe({
      next: (processes) => {
        this.openProcesses.set(processes);
        this.loadingProcesses.set(false);
      },
      error: (error) => {
        this.processError.set(errorMessage(error));
        this.loadingProcesses.set(false);
      },
    });
  }

  protected search(): void {
    if (this.searchForm.invalid) {
      this.searchForm.markAllAsTouched();
      return;
    }
    this.searching.set(true);
    this.searched.set(true);
    this.searchError.set('');
    this.collapseDetail();
    this.offboardingService.buscar(this.searchForm.controls.query.value.trim()).subscribe({
      next: (results) => {
        this.results.set(results);
        this.searching.set(false);
      },
      error: (error) => {
        this.results.set([]);
        this.searchError.set(errorMessage(error));
        this.searching.set(false);
      },
    });
  }

  protected requestStart(candidate: OffboardingSearchResult): void {
    this.startForm.reset({ observations: '' });
    this.startError.set('');
    this.startCandidate.set(candidate);
  }

  protected startProcess(): void {
    const candidate = this.startCandidate();
    if (!candidate || this.starting()) return;
    this.starting.set(true);
    this.startError.set('');
    const observations = this.startForm.controls.observations.value.trim() || null;
    this.offboardingService
      .iniciar({ colaboradorId: Number(candidate.colaborador.id), observaciones: observations })
      .subscribe({
        next: (process) => {
          this.results.update((items) =>
            items.map((item) =>
              item.colaborador.id === candidate.colaborador.id
                ? { ...item, procesoAbiertoId: process.id }
                : item,
            ),
          );
          this.startCandidate.set(null);
          this.starting.set(false);
          this.expandedProcessId.set(process.id);
          this.expandedSource.set('search');
          this.detail.set(process);
          this.loadProcesses();
          this.scrollAfterRender(`search-process-${process.id}`);
          this.toast.success('Proceso iniciado', 'La persona quedó en seguimiento de salida.');
        },
        error: (error) => {
          this.startError.set(errorMessage(error));
          this.starting.set(false);
        },
      });
  }

  protected toggleProcess(id: string, source: DetailSource, anchorId: string): void {
    if (this.isExpanded(id, source)) {
      this.collapseDetail();
      return;
    }
    this.expandedProcessId.set(id);
    this.expandedSource.set(source);
    this.detail.set(null);
    this.detailError.set('');
    this.detailLoading.set(true);
    this.offboardingService.obtener(id).subscribe({
      next: (process) => {
        this.detail.set(process);
        this.detailLoading.set(false);
        this.scrollAfterRender(anchorId);
      },
      error: (error) => {
        this.detailError.set(errorMessage(error));
        this.detailLoading.set(false);
        this.scrollAfterRender(anchorId);
      },
    });
  }

  protected isExpanded(id: string | null, source: DetailSource): boolean {
    return Boolean(id && this.expandedProcessId() === id && this.expandedSource() === source);
  }

  protected reloadDetail(): void {
    const id = this.expandedProcessId();
    if (!id) return;
    this.detailError.set('');
    this.detailLoading.set(true);
    this.offboardingService.obtener(id).subscribe({
      next: (process) => {
        this.detail.set(process);
        this.detailLoading.set(false);
      },
      error: (error) => {
        this.detailError.set(errorMessage(error));
        this.detailLoading.set(false);
      },
    });
  }

  protected openResolution(asset: OffboardingAsset): void {
    this.resolutionForm.reset({ resultado: 'DEVUELTO', condicion: '', observaciones: '' });
    this.resolutionError.set('');
    this.resolvingAsset.set(asset);
  }

  protected resolveAsset(): void {
    const asset = this.resolvingAsset();
    if (!asset || this.resolutionForm.invalid || this.resolving()) return;
    const value = this.resolutionForm.getRawValue();
    this.resolving.set(true);
    this.resolutionError.set('');
    this.devicesService
      .registrarResultadoOffboarding(asset.codigoInventario, {
        resultado: value.resultado,
        responsable: this.authenticatedUser(),
        condicion: value.condicion.trim() || null,
        observaciones: value.observaciones.trim() || null,
      })
      .subscribe({
        next: (result) => {
          this.resolvingAsset.set(null);
          this.resolving.set(false);
          this.reloadDetail();
          this.loadProcesses();
          this.refreshSearchResults();
          if ('comprobante' in result) {
            this.proofService.obtener(result.comprobante.id).subscribe({
              next: (proof) => this.receiptPreview.set(proof),
              error: (error) =>
                this.toast.warning(
                  'Resultado registrado',
                  `No fue posible abrir el comprobante: ${errorMessage(error)}`,
                ),
            });
          }
          this.toast.success('Resultado registrado', 'El seguimiento del equipo fue actualizado.');
        },
        error: (error) => {
          this.resolutionError.set(errorMessage(error));
          this.resolving.set(false);
        },
      });
  }

  protected requestClose(process: OffboardingProcessDetail): void {
    if (process.equiposPendientes > 0) return;
    this.closeError.set('');
    this.closeCandidate.set(process);
  }

  protected completeProcess(): void {
    const process = this.closeCandidate();
    if (!process || this.closing()) return;
    this.closing.set(true);
    this.closeError.set('');
    this.offboardingService.cerrar(process.id).subscribe({
      next: () => {
        this.results.update((items) =>
          items.map((item) =>
            item.colaborador.id === process.colaborador.id
              ? { ...item, procesoAbiertoId: null }
              : item,
          ),
        );
        this.closeCandidate.set(null);
        this.closing.set(false);
        this.collapseDetail();
        this.loadProcesses();
        this.toast.success('Proceso completado', 'El proceso salió de la lista de seguimiento.');
      },
      error: (error) => {
        this.closeError.set(errorMessage(error));
        this.closing.set(false);
      },
    });
  }

  protected closeStartBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.starting()) this.startCandidate.set(null);
  }

  protected closeResolutionBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.resolving()) this.resolvingAsset.set(null);
  }

  protected closeCompletionBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget && !this.closing()) this.closeCandidate.set(null);
  }

  private collapseDetail(): void {
    this.expandedProcessId.set(null);
    this.expandedSource.set(null);
    this.detail.set(null);
    this.detailError.set('');
    this.detailLoading.set(false);
  }

  private refreshSearchResults(): void {
    if (!this.searched() || this.searchForm.invalid) return;
    this.offboardingService.buscar(this.searchForm.controls.query.value.trim()).subscribe({
      next: (results) => this.results.set(results),
    });
  }

  private scrollAfterRender(anchorId: string): void {
    setTimeout(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
}
