import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideTriangleAlert } from '@lucide/angular';
import { EstadoOrdenServicio, OrdenServicio } from '../../core/models/itam.models';
import { ServicioTecnicoService } from '../../core/services/servicio-tecnico.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { formatClp } from '../../shared/utils/currency';
import { errorMessage } from '../../shared/utils/error-message';

export const technicalStage = (
  state: OrdenServicio['estado'],
): 'QUOTE' | 'DECISION' | 'CLOSE' | 'READ_ONLY' => {
  if (state === 'PENDIENTE_DIAGNOSTICO') return 'QUOTE';
  if (state === 'COTIZACION_RECIBIDA') return 'DECISION';
  if (
    state === 'REPARACION_APROBADA' ||
    state === 'EN_REPARACION' ||
    state === 'REPARACION_TERMINADA'
  )
    return 'CLOSE';
  return 'READ_ONLY';
};

export const repairImpactPercentage = (
  commercialValue: number,
  accumulatedCost: number,
  quotation: number,
): number => {
  if (commercialValue <= 0) return 0;
  return Math.round(((accumulatedCost + quotation) / commercialValue) * 100);
};

interface FlowStage {
  label: string;
  tone: 'complete' | 'current' | 'pending' | 'terminal';
}
@Component({
  selector: 'app-servicio-tecnico',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, PageHeader, ViewState, LucideTriangleAlert],
  template: `<app-page-header
      title="Servicio Técnico"
      subtitle="Diagnóstico, cotización, decisión y recepción de reparaciones."
      eyebrow="Ciclo de vida técnico"
      ><a class="btn btn--secondary" routerLink="/actas">Ver actas</a></app-page-header
    >
    @if (loading()) {
      <section class="card"><app-view-state kind="loading" title="Cargando órdenes" /></section>
    } @else if (error()) {
      <section class="card">
        <app-view-state
          kind="error"
          title="No se pudieron cargar las órdenes"
          [message]="error()"
          (retry)="load()"
        />
      </section>
    } @else {
      <section class="technical-layout">
        <article class="card order-list">
          <header>
            <div>
              <span>SEGUIMIENTO</span>
              <h2>Órdenes de servicio</h2>
            </div>
            <strong>{{ orders().length }}</strong>
          </header>
          @if (!orders().length) {
            <app-view-state
              kind="empty"
              title="Sin órdenes técnicas"
              message="Las órdenes se crean desde la ficha del equipo."
            />
          }
          @for (order of orders(); track order.id) {
            <button
              type="button"
              [class.active]="selected()?.id === order.id"
              (click)="select(order)"
            >
              <span
                ><strong>#{{ order.id }} · {{ order.dispositivo.codigoInventario }}</strong
                ><small
                  >{{ order.dispositivo.tipo }} · {{ order.dispositivo.marca || '—' }}
                  {{ order.dispositivo.modelo || '' }}</small
                ></span
              ><b [class]="'state-pill state-pill--' + statusTone(order.estado)">{{
                statusLabel(order.estado)
              }}</b>
            </button>
          }
        </article>
        @if (selected(); as order) {
          <article class="card order-detail">
            <header>
              <div>
                <span>ORDEN #{{ order.id }}</span>
                <h2>{{ order.dispositivo.tipo }} {{ order.dispositivo.codigoInventario }}</h2>
              </div>
              <b [class]="'state-pill state-pill--' + statusTone(order.estado)">{{
                statusLabel(order.estado)
              }}</b>
            </header>
            <ol class="stage-flow" aria-label="Progreso de la orden técnica">
              @for (stage of stages(order.estado); track stage.label) {
                <li [class]="'service-stage service-stage--' + stage.tone">
                  <span aria-hidden="true"></span>
                  <small>{{ stage.label }}</small>
                </li>
              }
            </ol>
            <dl class="order-data">
              <div>
                <dt>Falla reportada</dt>
                <dd>{{ order.fallaReportada }}</dd>
              </div>
              <div>
                <dt>Proveedor</dt>
                <dd>{{ order.proveedor || '—' }}</dd>
              </div>
              <div>
                <dt>Fecha envío</dt>
                <dd>{{ order.fechaEnvio | date: 'dd/MM/yyyy HH:mm' }}</dd>
              </div>
              <div>
                <dt>Valor comercial</dt>
                <dd>{{ clp(order.dispositivo.valorComercial) }}</dd>
              </div>
              <div>
                <dt>Reparaciones anteriores</dt>
                <dd>{{ order.reparacionesAnteriores }}</dd>
              </div>
              <div>
                <dt>Costo acumulado</dt>
                <dd>{{ clp(order.costoAcumulado) }}</dd>
              </div>
            </dl>
            <section
              class="economic-impact"
              [class.economic-impact--warning]="highRepairImpact(order)"
              aria-labelledby="economic-impact-title"
            >
              <header>
                <div>
                  <span>REFERENCIA ECONÓMICA</span>
                  <h3 id="economic-impact-title">Impacto de reparación</h3>
                </div>
                <strong>{{ impactPercentage(order) }}%</strong>
              </header>
              <dl>
                <div>
                  <dt>Costos anteriores</dt>
                  <dd>{{ clp(order.costoAcumulado) }}</dd>
                </div>
                <div>
                  <dt>Cotización considerada</dt>
                  <dd>{{ clp(quotationValue(order)) }}</dd>
                </div>
                <div>
                  <dt>Total proyectado</dt>
                  <dd>{{ clp(projectedRepairCost(order)) }}</dd>
                </div>
              </dl>
              <div class="impact-meter" aria-hidden="true">
                <span [style.width.%]="impactBarWidth(order)"></span>
              </div>
              @if (order.dispositivo.valorComercial <= 0) {
                <p>No es posible comparar porque el activo no tiene valor comercial informado.</p>
              } @else if (highRepairImpact(order)) {
                <p class="impact-warning" role="status">
                  <svg lucideTriangleAlert></svg>
                  El costo proyectado alcanza al menos el 50% del valor comercial. Esta alerta es
                  informativa y no toma decisiones automáticamente.
                </p>
              } @else {
                <p>Comparación informativa; la decisión continúa bajo responsabilidad de TI.</p>
              }
            </section>
            <section class="temporary-panel">
              <header><div><span>CUSTODIA Y CONTINUIDAD</span><h3>Equipo temporal</h3></div></header>
              <p>Custodio al ingreso: <strong>{{ order.custodiaAlIngreso?.colaborador?.nombre || order.custodiaAlIngreso?.departamento?.nombre || 'Sin custodia' }}</strong>. La recepción física por TI no crea una segunda custodia.</p>
              @if(order.entregasTemporales.length){@for(delivery of order.entregasTemporales;track delivery.id){<article class="temporary-item"><div><strong>{{delivery.dispositivo.tipo}} {{delivery.dispositivo.codigoInventario}}</strong><small>{{delivery.colaborador.nombre}} · {{delivery.fechaEntrega|date:'dd/MM/yyyy HH:mm'}}</small></div><span class="state-pill">{{delivery.estado==='ABIERTA'?'En uso':'Devuelto'}}</span></article>@if(delivery.estado==='ABIERTA'){<form [formGroup]="temporaryCloseForm" (ngSubmit)="closeTemporary(order,delivery.id)"><div class="field"><label>Responsable TI *</label><input formControlName="responsable" readonly /></div><div class="field"><label>Observaciones de devolución</label><textarea formControlName="observaciones"></textarea></div><button class="btn btn--secondary" [disabled]="submitting()">Registrar devolución temporal</button></form>}}}
              @if(!openTemporary(order) && order.custodiaAlIngreso?.colaborador && technicalStage(order.estado)!=='READ_ONLY'){
                <form [formGroup]="temporaryForm" (ngSubmit)="deliverTemporary(order)"><div class="notice notice--info">Acción contextual: el activo temporal conserva su propio código y debe estar Disponible.</div><div class="field"><label>Código ITAM del equipo temporal *</label><input type="number" min="1" formControlName="dispositivoCodigo" /></div><div class="field"><label>Responsable TI *</label><input formControlName="responsable" readonly /></div><div class="field"><label>Observaciones</label><textarea formControlName="observaciones"></textarea></div><button class="btn btn--secondary" [disabled]="submitting()">Entregar equipo temporal</button></form>
              }
            </section>
            @if (order.estado === 'PENDIENTE_DIAGNOSTICO') {
              <form [formGroup]="quoteForm" (ngSubmit)="quote(order)">
                <h3>Registrar cotización</h3>
                <div class="field">
                  <label>Proveedor</label><input formControlName="proveedor" />
                </div>
                <div class="field">
                  <label>Diagnóstico *</label><textarea formControlName="diagnostico"></textarea>
                </div>
                <div class="field">
                  <label>Descripción reparación *</label
                  ><textarea formControlName="descripcionReparacion"></textarea>
                </div>
                <div class="field">
                  <label>Monto cotizado CLP *</label
                  ><input type="number" min="0" formControlName="montoCotizacion" />
                </div>
                <div class="field">
                  <label>Responsable TI *</label><input formControlName="responsable" readonly />
                </div>
                <button class="btn btn--primary" [disabled]="submitting()">
                  Guardar cotización
                </button>
              </form>
            }
            @if (order.estado === 'COTIZACION_RECIBIDA') {
              <section class="quote-summary">
                <span>Cotización recibida</span><strong>{{ clp(order.montoCotizacion) }}</strong>
                <p>{{ order.diagnostico }}</p>
              </section>
              <form [formGroup]="decisionForm" (ngSubmit)="decide(order)">
                <h3>Decisión responsable</h3>
                <div class="field">
                  <label>Decisión *</label
                  ><select formControlName="decision" (change)="decisionChanged()">
                    <option value="APROBAR">Aprobar reparación</option>
                    <option value="RECHAZAR">Rechazar reparación</option>
                    <option value="DAR_BAJA">Dar de baja</option>
                  </select>
                </div>
                @if (decisionForm.controls.decision.value !== 'APROBAR') {
                  <div class="field">
                    <label>Motivo *</label
                    ><select formControlName="motivo">
                      <option value="">Seleccionar</option>
                      @if (decisionForm.controls.decision.value === 'DAR_BAJA') {
                        <option value="IRREPARABLE">Irreparable</option>
                        <option value="REPARACION_NO_CONVENIENTE">Reparación no conveniente</option>
                        <option value="MULTIPLES_REPARACIONES">Múltiples reparaciones</option>
                        <option value="OBSOLESCENCIA">Obsolescencia</option>
                        <option value="DANO_FISICO">Daño físico</option>
                        <option value="SIN_REPUESTOS">Sin repuestos</option>
                        <option value="OTRO">Otro</option>
                      } @else {
                        <option value="REPARACION_DEMASIADO_COSTOSA">
                          Reparación demasiado costosa
                        </option>
                        <option value="MULTIPLES_REPARACIONES">Múltiples reparaciones</option>
                        <option value="EQUIPO_OBSOLETO">Equipo obsoleto</option>
                        <option value="SIN_REPUESTOS">Sin repuestos</option>
                        <option value="OTRO">Otro</option>
                      }
                    </select>
                  </div>
                }
                <div class="field">
                  <label>Observaciones</label><textarea formControlName="observaciones"></textarea>
                </div>
                <div class="field">
                  <label>Responsable TI *</label><input formControlName="responsable" readonly />
                </div>
                <button class="btn btn--primary" [disabled]="submitting()">
                  Registrar decisión
                </button>
              </form>
            }
            @if (
              order.estado === 'REPARACION_APROBADA' ||
              order.estado === 'EN_REPARACION' ||
              order.estado === 'REPARACION_TERMINADA'
            ) {
              <form [formGroup]="closeForm" (ngSubmit)="close(order)">
                <h3>Recepción y cierre</h3>
                <div class="field">
                  <label>Costo final CLP *</label
                  ><input type="number" min="0" formControlName="costoFinal" />
                </div>
                <div class="field">
                  <label>Fecha retorno</label
                  ><input type="datetime-local" formControlName="fechaRetorno" />
                </div>
                <div class="field">
                  <label>Resultado *</label><textarea formControlName="resultado"></textarea>
                </div>
                <div class="field">
                  <label>Responsable TI *</label><input formControlName="responsable" readonly />
                </div>
                <button class="btn btn--primary" [disabled]="submitting()">Cerrar y recibir</button>
              </form>
            }
            @if (technicalStage(order.estado) === 'READ_ONLY') {
              <section class="closed-summary">
                <strong>{{ statusLabel(order.estado) }}</strong>
                <p>
                  {{
                    order.resultado ||
                      order.observacionDecision ||
                      'La orden no requiere acciones pendientes.'
                  }}
                </p>
              </section>
            }
            @if (actionError()) {
              <div class="notice notice--error">{{ actionError() }}</div>
            }
          </article>
        }
      </section>
    }`,
  styles: [
    `
      .technical-layout {
        display: grid;
        gap: 1rem;
        grid-template-columns: minmax(18rem, 0.8fr) minmax(26rem, 1.2fr);
      }
      .order-list,
      .order-detail {
        overflow: hidden;
      }
      .order-list > header,
      .order-detail > header {
        align-items: center;
        border-bottom: 1px solid var(--gray-200);
        display: flex;
        justify-content: space-between;
        padding: 1rem 1.2rem;
      }
      .order-list button {
        align-items: center;
        background: #fff;
        border: 0;
        border-bottom: 1px solid var(--gray-200);
        display: flex;
        justify-content: space-between;
        padding: 0.9rem 1.1rem;
        text-align: left;
        width: 100%;
      }
      .order-list button:hover {
        background: var(--cyan-soft);
      }
      .order-list button.active {
        background: var(--cyan-soft);
        box-shadow: inset 3px 0 var(--cyan);
      }
      .order-list button span,
      .order-list button small {
        display: block;
      }
      .order-list button small {
        color: var(--slate-500);
        margin-top: 0.2rem;
      }
      .order-list button b,
      .order-detail > header b {
        background: var(--gray-100);
        border-radius: 999px;
        font-size: 0.65rem;
        padding: 0.3rem 0.5rem;
      }
      .order-list > header span,
      .order-detail > header span,
      .economic-impact header span {
        color: var(--blue);
        font-size: 0.6rem;
        font-weight: 850;
        letter-spacing: 0.1em;
      }
      .order-list > header h2 {
        margin: 0.2rem 0 0;
      }
      .state-pill--warning {
        background: #fef3c7 !important;
        color: #92400e;
      }
      .state-pill--active {
        background: #dbeafe !important;
        color: #1e40af;
      }
      .state-pill--success {
        background: #dcfce7 !important;
        color: #166534;
      }
      .state-pill--danger {
        background: #fee2e2 !important;
        color: #991b1b;
      }
      .order-detail {
        padding-bottom: 1.2rem;
      }
      .order-detail > dl,
      .order-detail > form,
      .quote-summary,
      .economic-impact,
      .closed-summary {
        margin: 1rem 1.2rem;
      }
      .order-detail > dl {
        display: grid;
        grid-template-columns: 1fr 1fr;
      }
      .order-detail > dl div {
        border: 1px solid var(--gray-200);
        padding: 0.6rem;
      }
      .order-detail dt {
        color: var(--slate-500);
        font-size: 0.65rem;
      }
      .order-detail dd {
        font-weight: 700;
        margin: 0.2rem 0;
      }
      .order-detail form {
        border-top: 1px solid var(--gray-200);
        padding-top: 1rem;
      }
      .quote-summary {
        background: var(--cyan-soft);
        border-radius: 0.8rem;
        padding: 1rem;
      }
      .quote-summary span,
      .quote-summary strong {
        display: block;
      }
      .stage-flow {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        list-style: none;
        margin: 1rem 1.2rem;
        padding: 0;
      }
      .service-stage {
        color: var(--slate-400);
        position: relative;
        text-align: center;
      }
      .service-stage::before {
        background: var(--gray-200);
        content: '';
        height: 2px;
        left: 0;
        position: absolute;
        right: 0;
        top: 0.4rem;
      }
      .service-stage:first-child::before {
        left: 50%;
      }
      .service-stage:last-child::before {
        right: 50%;
      }
      .service-stage > span {
        background: var(--gray-200);
        border: 3px solid #fff;
        border-radius: 50%;
        display: block;
        height: 0.8rem;
        margin: 0 auto 0.35rem;
        position: relative;
        width: 0.8rem;
        z-index: 1;
      }
      .service-stage small {
        font-size: 0.58rem;
        font-weight: 750;
      }
      .service-stage--complete,
      .service-stage--current {
        color: var(--blue);
      }
      .service-stage--complete::before,
      .service-stage--complete > span {
        background: var(--cyan);
      }
      .service-stage--current > span {
        background: var(--blue);
        box-shadow: 0 0 0 4px var(--cyan-soft);
      }
      .service-stage--terminal {
        color: #b91c1c;
      }
      .service-stage--terminal > span {
        background: #dc2626;
        box-shadow: 0 0 0 4px #fee2e2;
      }
      .economic-impact {
        background: var(--gray-50);
        border: 1px solid var(--gray-200);
        border-radius: 0.9rem;
        padding: 1rem;
      }
      .economic-impact > header {
        align-items: center;
        display: flex;
        justify-content: space-between;
      }
      .economic-impact > header h3 {
        margin: 0.2rem 0 0;
      }
      .economic-impact > header > strong {
        color: var(--navy);
        font-size: 1.25rem;
      }
      .economic-impact dl {
        display: grid;
        gap: 0.5rem;
        grid-template-columns: repeat(3, 1fr);
        margin: 0.9rem 0;
      }
      .economic-impact dl div {
        background: #fff;
        border-radius: 0.55rem;
        padding: 0.55rem;
      }
      .economic-impact dt {
        color: var(--slate-500);
        font-size: 0.62rem;
      }
      .economic-impact dd {
        font-weight: 750;
        margin: 0.2rem 0 0;
      }
      .impact-meter {
        background: var(--gray-200);
        border-radius: 999px;
        height: 0.45rem;
        overflow: hidden;
      }
      .impact-meter span {
        background: var(--blue);
        display: block;
        height: 100%;
        transition: width 200ms ease;
      }
      .economic-impact > p {
        color: var(--slate-500);
        font-size: 0.67rem;
        margin: 0.7rem 0 0;
      }
      .economic-impact--warning {
        background: #fffbeb;
        border-color: #fbbf24;
      }
      .economic-impact--warning .impact-meter span {
        background: #d97706;
      }
      .impact-warning {
        align-items: flex-start;
        color: #92400e !important;
        display: flex;
        font-weight: 700;
        gap: 0.4rem;
      }
      .impact-warning svg {
        flex: none;
        height: 1rem;
        width: 1rem;
      }
      .closed-summary {
        background: var(--gray-50);
        border-radius: 0.8rem;
        padding: 1rem;
      }
      .closed-summary p {
        color: var(--slate-500);
        margin: 0.35rem 0 0;
      }
      .temporary-panel{background:var(--gray-50);border:1px solid var(--gray-200);border-radius:.9rem;margin:1rem 1.2rem;padding:1rem}.temporary-panel>header span{color:var(--blue);font-size:.6rem;font-weight:850;letter-spacing:.1em}.temporary-panel h3{margin:.2rem 0}.temporary-panel>p{color:var(--slate-600);font-size:.75rem}.temporary-item{align-items:center;background:#fff;border:1px solid var(--gray-200);border-radius:.7rem;display:flex;justify-content:space-between;margin:.7rem 0;padding:.75rem}.temporary-item small{color:var(--slate-500);display:block;margin-top:.2rem}.temporary-panel form{border-top:1px solid var(--gray-200);margin-top:.8rem;padding-top:.8rem}
      @media (max-width: 900px) {
        .technical-layout {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 620px) {
        .order-detail > dl,
        .economic-impact dl {
          grid-template-columns: 1fr;
        }
        .stage-flow {
          overflow-x: auto;
        }
        .service-stage {
          min-width: 4.5rem;
        }
      }
    `,
  ],
})
export class ServicioTecnico implements OnInit {
  private readonly service = inject(ServicioTecnicoService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  protected readonly orders = signal<OrdenServicio[]>([]);
  protected readonly selected = signal<OrdenServicio | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly submitting = signal(false);
  protected readonly clp = formatClp;
  protected readonly technicalStage = technicalStage;
  protected readonly quoteForm = this.fb.nonNullable.group({
    proveedor: [''],
    diagnostico: ['', Validators.required],
    descripcionReparacion: ['', Validators.required],
    montoCotizacion: [0, [Validators.required, Validators.min(0)]],
    responsable: ['', Validators.required],
  });
  protected readonly decisionForm = this.fb.nonNullable.group({
    decision: ['APROBAR' as 'APROBAR' | 'RECHAZAR' | 'DAR_BAJA'],
    motivo: [''],
    observaciones: [''],
    responsable: ['', Validators.required],
  });
  protected readonly closeForm = this.fb.nonNullable.group({
    costoFinal: [0, [Validators.required, Validators.min(0)]],
    fechaRetorno: [''],
    resultado: ['', Validators.required],
    responsable: ['', Validators.required],
  });
  protected readonly temporaryForm=this.fb.nonNullable.group({dispositivoCodigo:[0,[Validators.required,Validators.min(1)]],responsable:['',Validators.required],observaciones:['']});
  protected readonly temporaryCloseForm=this.fb.nonNullable.group({responsable:['',Validators.required],observaciones:['']});
  ngOnInit(): void {
    this.load();
  }
  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.listar().subscribe({
      next: (items) => {
        this.orders.set(items);
        if (this.selected())
          this.selected.set(items.find((x) => x.id === this.selected()!.id) ?? null);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
  protected select(order: OrdenServicio): void {
    const actor = this.auth.user()?.nombre || '';
    this.selected.set(order);
    this.actionError.set('');
    this.quoteForm.reset({
      proveedor: order.proveedor || '',
      diagnostico: '',
      descripcionReparacion: '',
      montoCotizacion: order.montoCotizacion ?? 0,
      responsable: actor,
    });
    this.decisionForm.reset({
      decision: 'APROBAR',
      motivo: '',
      observaciones: '',
      responsable: actor,
    });
    this.closeForm.reset({ costoFinal: 0, fechaRetorno: '', resultado: '', responsable: actor });
    this.temporaryForm.reset({dispositivoCodigo:0,responsable:actor,observaciones:''});
    this.temporaryCloseForm.reset({responsable:actor,observaciones:''});
  }

  protected openTemporary(order:OrdenServicio){return order.entregasTemporales.find(item=>item.estado==='ABIERTA')??null;}
  protected deliverTemporary(order:OrdenServicio){if(this.temporaryForm.invalid){this.temporaryForm.markAllAsTouched();return;}const value=this.temporaryForm.getRawValue();this.perform(this.service.entregarTemporal(order.id,{...value,observaciones:value.observaciones.trim()||null}));}
  protected closeTemporary(order:OrdenServicio,deliveryId:string){if(this.temporaryCloseForm.invalid){this.temporaryCloseForm.markAllAsTouched();return;}const value=this.temporaryCloseForm.getRawValue();this.perform(this.service.cerrarTemporal(order.id,deliveryId,{...value,observaciones:value.observaciones.trim()||null}));}

  protected statusLabel(state: EstadoOrdenServicio): string {
    const labels: Record<EstadoOrdenServicio, string> = {
      PENDIENTE_DIAGNOSTICO: 'Pendiente de diagnóstico',
      COTIZACION_RECIBIDA: 'Cotización recibida',
      REPARACION_APROBADA: 'Reparación aprobada',
      REPARACION_RECHAZADA: 'Reparación rechazada',
      EN_REPARACION: 'En reparación',
      REPARACION_TERMINADA: 'Reparación finalizada',
      CERRADA: 'Cerrada',
      BAJA: 'Dada de baja',
    };
    return labels[state];
  }

  protected statusTone(state: EstadoOrdenServicio): string {
    if (state === 'CERRADA' || state === 'REPARACION_TERMINADA') return 'success';
    if (state === 'REPARACION_RECHAZADA' || state === 'BAJA') return 'danger';
    if (state === 'PENDIENTE_DIAGNOSTICO' || state === 'COTIZACION_RECIBIDA') return 'warning';
    return 'active';
  }

  protected stages(state: EstadoOrdenServicio): FlowStage[] {
    const labels = ['Ingreso', 'Cotización', 'Decisión', 'Reparación', 'Finalización'];
    const terminal = state === 'REPARACION_RECHAZADA' || state === 'BAJA';
    const currentIndex: Record<EstadoOrdenServicio, number> = {
      PENDIENTE_DIAGNOSTICO: 1,
      COTIZACION_RECIBIDA: 2,
      REPARACION_APROBADA: 3,
      REPARACION_RECHAZADA: 2,
      EN_REPARACION: 3,
      REPARACION_TERMINADA: 4,
      CERRADA: 5,
      BAJA: 2,
    };
    const current = currentIndex[state];
    return labels.map((label, index) => ({
      label,
      tone:
        index < current
          ? 'complete'
          : index === current
            ? terminal
              ? 'terminal'
              : 'current'
            : 'pending',
    }));
  }

  protected quotationValue(order: OrdenServicio): number {
    if (order.estado === 'PENDIENTE_DIAGNOSTICO') {
      return Number(this.quoteForm.controls.montoCotizacion.value) || 0;
    }
    return order.montoCotizacion ?? 0;
  }

  protected projectedRepairCost(order: OrdenServicio): number {
    return order.costoAcumulado + this.quotationValue(order);
  }

  protected impactPercentage(order: OrdenServicio): number {
    return repairImpactPercentage(
      order.dispositivo.valorComercial,
      order.costoAcumulado,
      this.quotationValue(order),
    );
  }

  protected impactBarWidth(order: OrdenServicio): number {
    return Math.min(this.impactPercentage(order), 100);
  }

  protected highRepairImpact(order: OrdenServicio): boolean {
    return order.dispositivo.valorComercial > 0 && this.impactPercentage(order) >= 50;
  }

  protected decisionChanged(): void {
    this.decisionForm.controls.motivo.setValue('');
    this.actionError.set('');
  }

  private perform(request: ReturnType<ServicioTecnicoService['obtener']>): void {
    this.submitting.set(true);
    this.actionError.set('');
    request.subscribe({
      next: (order) => {
        this.selected.set(order);
        this.submitting.set(false);
        this.toast.success('Orden actualizada');
        this.load();
      },
      error: (e) => {
        this.actionError.set(errorMessage(e));
        this.submitting.set(false);
      },
    });
  }
  protected quote(order: OrdenServicio): void {
    if (this.quoteForm.invalid) {
      this.quoteForm.markAllAsTouched();
      return;
    }
    const v = this.quoteForm.getRawValue();
    this.perform(this.service.cotizar(order.id, { ...v, proveedor: v.proveedor.trim() || null }));
  }
  protected decide(order: OrdenServicio): void {
    const v = this.decisionForm.getRawValue();
    if (this.decisionForm.invalid || (v.decision !== 'APROBAR' && !v.motivo)) {
      this.decisionForm.markAllAsTouched();
      this.actionError.set('El motivo es obligatorio para rechazar o dar de baja.');
      return;
    }
    this.perform(
      this.service.decidir(order.id, {
        ...v,
        motivo: v.motivo || null,
        observaciones: v.observaciones || null,
      }),
    );
  }
  protected close(order: OrdenServicio): void {
    if (this.closeForm.invalid) {
      this.closeForm.markAllAsTouched();
      return;
    }
    const v = this.closeForm.getRawValue();
    this.perform(this.service.cerrar(order.id, { ...v, fechaRetorno: v.fechaRetorno || null }));
  }
}
