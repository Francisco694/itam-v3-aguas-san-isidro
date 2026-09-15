import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { EstadoOrdenServicio, OrdenServicio } from '../../core/models/itam.models';
import { ServicioTecnicoService } from '../../core/services/servicio-tecnico.service';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { formatClp } from '../../shared/utils/currency';
import { errorMessage } from '../../shared/utils/error-message';

export const technicalStage = (state: OrdenServicio['estado']): 'QUOTE' | 'DECISION' | 'CLOSE' | 'READ_ONLY' => {
  if (state === 'PENDIENTE_DIAGNOSTICO') return 'QUOTE';
  if (state === 'COTIZACION_RECIBIDA') return 'DECISION';
  if (state === 'REPARACION_APROBADA' || state === 'EN_REPARACION' || state === 'REPARACION_TERMINADA') return 'CLOSE';
  return 'READ_ONLY';
};

export const repairImpactPercentage = (commercialValue: number, accumulatedCost: number, quotation: number): number => {
  if (commercialValue <= 0) return 0;
  return Math.round(((accumulatedCost + quotation) / commercialValue) * 100);
};

@Component({
  selector: 'app-servicio-tecnico',
  imports: [ReactiveFormsModule, PageHeader, ViewState],
  template: `<app-page-header title="Revisión técnica" subtitle="Seguimiento de equipos enviados a servicio técnico." eyebrow="Servicio técnico" />
    @if (loading()) {
      <section class="card"><app-view-state kind="loading" title="Cargando revisiones" /></section>
    } @else if (error()) {
      <section class="card"><app-view-state kind="error" title="No se pudieron cargar las revisiones" [message]="error()" (retry)="load()" /></section>
    } @else {
      <section class="technical-layout">
        <article class="card order-list">
          <header><div><span>SEGUIMIENTO</span><h2>Revisiones técnicas</h2></div><strong>{{ orders().length }}</strong></header>
          @if (!orders().length) { <app-view-state kind="empty" title="Sin revisiones técnicas" message="Los envíos se registran desde la ficha del equipo." /> }
          @for (order of orders(); track order.id) {
            <button type="button" [class.active]="selected()?.id === order.id" (click)="select(order)">
              <span><strong>#{{ order.id }} · {{ order.dispositivo.codigoInventario }}</strong><small>{{ order.dispositivo.tipo }} · {{ order.dispositivo.marca || '—' }} {{ order.dispositivo.modelo || '' }}</small></span>
              <b [class]="'state-pill state-pill--' + statusTone(order.estado)">{{ statusLabel(order.estado) }}</b>
            </button>
          }
        </article>
        @if (selected(); as order) {
          <article class="card order-detail">
            <header><div><span>REVISIÓN #{{ order.id }}</span><h2>{{ order.dispositivo.tipo }} · {{ order.dispositivo.codigoInventario }}</h2></div><b [class]="'state-pill state-pill--' + statusTone(order.estado)">{{ statusLabel(order.estado) }}</b></header>
            <div class="stage-strip" aria-label="Etapa actual"><span class="complete">1. Envío</span><span [class.current]="order.estado === 'PENDIENTE_DIAGNOSTICO'">2. Diagnóstico / cotización</span><span [class.current]="order.estado === 'COTIZACION_RECIBIDA' || order.estado === 'REPARACION_APROBADA' || order.estado === 'EN_REPARACION' || order.estado === 'REPARACION_TERMINADA' || order.estado === 'CERRADA' || order.estado === 'BAJA'">3. Retorno o cierre</span></div>
            @if (order.estado !== 'CERRADA' && order.estado !== 'BAJA') { <section class="active-review-banner" role="status"><strong>Equipo apartado del inventario operativo</strong><span>Este equipo está en servicio técnico hasta finalizar esta revisión.</span></section> }
            <dl class="order-data">
              <div><dt>Equipo</dt><dd>{{ order.dispositivo.tipo }} · {{ order.dispositivo.marca || 'Sin marca' }} {{ order.dispositivo.modelo || '' }} · código {{ order.dispositivo.codigoInventario }}</dd></div>
              <div><dt>Estado</dt><dd>{{ statusLabel(order.estado) }}</dd></div><div><dt>Fecha de envío</dt><dd>{{ dateLabel(order.fechaEnvio) }}</dd></div>
              <div><dt>Proveedor / técnico / destino</dt><dd>{{ order.proveedor || 'No informado' }}</dd></div><div><dt>Tipo de servicio</dt><dd>{{ serviceTypeLabel(order.tipoServicio) }}</dd></div><div><dt>Falla reportada</dt><dd>{{ order.fallaReportada }}</dd></div>
            </dl>
            @if (order.estado === 'PENDIENTE_DIAGNOSTICO') {
              <form [formGroup]="diagnosisForm" (ngSubmit)="saveDiagnosis(order)"><h3>Registrar diagnóstico</h3><div class="field"><label>Diagnóstico *</label><textarea formControlName="diagnostico"></textarea></div><div class="field"><label>Resultado o reparación propuesta *</label><textarea formControlName="descripcionReparacion"></textarea></div><div class="form-grid"><div class="field"><label>Costo estimado de reparación CLP *</label><input type="number" min="0" formControlName="montoCotizacion" /></div><div class="field"><label>Plazo informado</label><input formControlName="plazoInformado" /></div></div><div class="field"><label>Responsable TI *</label><input formControlName="responsable" readonly /></div><button class="btn btn--primary" [disabled]="submitting()">Guardar diagnóstico</button></form>
            }
            @if (order.estado === 'COTIZACION_RECIBIDA' || order.estado === 'REPARACION_APROBADA' || order.estado === 'EN_REPARACION' || order.estado === 'REPARACION_TERMINADA') {
              <section class="diagnosis-summary"><span>DIAGNÓSTICO REGISTRADO</span><strong>{{ order.diagnostico }}</strong><p>{{ order.descripcionReparacion }}</p><dl><div><dt>Costo estimado</dt><dd>{{ clp(order.montoCotizacion || 0) }}</dd></div><div><dt>Plazo informado</dt><dd>{{ order.plazoInformado || 'No informado' }}</dd></div></dl></section>
              <form [formGroup]="closeForm" (ngSubmit)="close(order)"><h3>Finalizar revisión</h3><div class="form-grid"><div class="field"><label>Fecha de retorno *</label><input type="date" formControlName="fechaRetorno" /></div><div class="field"><label>Costo final de reparación CLP *</label><input type="number" min="0" formControlName="costoFinal" /></div></div><div class="field"><label>Resultado final *</label><textarea formControlName="resultado"></textarea></div><div class="field"><label>Estado final *</label><select formControlName="estadoFinal"><option value="">Seleccionar</option><option value="OPERATIVO">Operativo</option><option value="SIN_REPARACION">Sin reparación</option><option value="BAJA">Baja</option></select></div><div class="field"><label>Observaciones de retorno</label><textarea formControlName="observacionesRetorno"></textarea></div><div class="field"><label>Responsable TI *</label><input formControlName="responsable" readonly /></div><button class="btn btn--primary" [disabled]="submitting()">Finalizar revisión</button></form>
            }
            @if (order.estado === 'CERRADA' || order.estado === 'BAJA') { <section class="closed-summary"><strong>Revisión finalizada</strong><dl><div><dt>Fecha de retorno</dt><dd>{{ order.fechaRetorno ? dateLabel(order.fechaRetorno) : 'No informada' }}</dd></div><div><dt>Estado final</dt><dd>{{ finalStatusLabel(order.estadoFinal) }}</dd></div><div><dt>Costo final</dt><dd>{{ clp(order.costoFinal || 0) }}</dd></div></dl><p>{{ order.resultado || 'Sin observaciones registradas.' }}</p></section> }
            @if (actionError()) { <div class="notice notice--error" role="alert">{{ actionError() }}</div> }
          </article>
        } @else { <article class="card empty-selection"><h2>Selecciona una revisión</h2><p>El detalle mostrará únicamente la etapa que corresponde al estado actual.</p></article> }
      </section>
    }`,
  styles: [`
    .technical-layout{display:grid;gap:1rem;grid-template-columns:minmax(18rem,.8fr) minmax(26rem,1.2fr)}.order-list,.order-detail{overflow:hidden}.order-list>header,.order-detail>header{align-items:center;border-bottom:1px solid var(--gray-200);display:flex;justify-content:space-between;padding:1rem 1.2rem}.order-list>header span,.order-detail>header span{color:var(--blue);font-size:.6rem;font-weight:850;letter-spacing:.1em}.order-list h2,.order-detail h2{margin:.2rem 0 0}.order-list button{align-items:center;background:#fff;border:0;border-bottom:1px solid var(--gray-200);display:flex;justify-content:space-between;padding:.9rem 1.1rem;text-align:left;width:100%}.order-list button:hover,.order-list button.active{background:var(--cyan-soft)}.order-list button.active{box-shadow:inset 3px 0 var(--cyan)}.order-list button span,.order-list button small{display:block}.order-list button small{color:var(--slate-500);margin-top:.2rem}.order-list button b,.order-detail>header b{background:var(--gray-100);border-radius:999px;font-size:.65rem;padding:.3rem .5rem}.state-pill--warning{background:#fef3c7!important;color:#92400e}.state-pill--active{background:#dbeafe!important;color:#1e40af}.state-pill--success{background:#dcfce7!important;color:#166534}.state-pill--danger{background:#fee2e2!important;color:#991b1b}.order-detail{padding-bottom:1.2rem}.stage-strip{display:grid;gap:.35rem;grid-template-columns:repeat(3,1fr);margin:1rem 1.2rem}.stage-strip span{background:var(--gray-100);border-radius:.5rem;color:var(--slate-500);font-size:.7rem;font-weight:750;padding:.65rem;text-align:center}.stage-strip span.current{background:var(--cyan-soft);color:var(--blue)}.active-review-banner{background:#eff6ff;border:1px solid #bfdbfe;border-radius:.85rem;color:#1e40af;display:grid;gap:.2rem;margin:1rem 1.2rem;padding:.8rem 1rem}.active-review-banner span{font-size:.72rem}.order-data,.diagnosis-summary,.closed-summary,.order-detail>form{margin:1rem 1.2rem}.order-data{display:grid;grid-template-columns:1fr 1fr}.order-data div{border:1px solid var(--gray-200);padding:.6rem}.order-data dt,.diagnosis-summary dt,.closed-summary dt{color:var(--slate-500);font-size:.65rem}.order-data dd,.diagnosis-summary dd,.closed-summary dd{font-weight:700;margin:.2rem 0}.order-detail form{border-top:1px solid var(--gray-200);padding-top:1rem}.form-grid{display:grid;gap:.75rem;grid-template-columns:1fr 1fr}.diagnosis-summary{background:var(--cyan-soft);border-radius:.8rem;padding:1rem}.diagnosis-summary>span{color:var(--blue);font-size:.6rem;font-weight:850;letter-spacing:.1em}.diagnosis-summary>strong{display:block;margin-top:.25rem}.diagnosis-summary p{color:var(--slate-600);margin:.45rem 0}.diagnosis-summary dl,.closed-summary dl{display:grid;gap:.6rem;grid-template-columns:1fr 1fr}.diagnosis-summary dl div,.closed-summary dl div{background:#fff;border-radius:.5rem;padding:.55rem}.closed-summary{background:var(--gray-50);border-radius:.8rem;padding:1rem}.closed-summary p{color:var(--slate-600);margin:.5rem 0 0}.empty-selection{padding:2rem}.empty-selection p{color:var(--slate-500)}@media(max-width:900px){.technical-layout{grid-template-columns:1fr}}@media(max-width:620px){.order-data,.form-grid,.diagnosis-summary dl,.closed-summary dl,.stage-strip{grid-template-columns:1fr}}
  `],
})
export class ServicioTecnico implements OnInit {
  private readonly service = inject(ServicioTecnicoService);private readonly auth = inject(AuthService);private readonly toast = inject(ToastService);private readonly fb = inject(FormBuilder);
  protected readonly orders = signal<OrdenServicio[]>([]);protected readonly selected = signal<OrdenServicio | null>(null);protected readonly loading = signal(true);protected readonly error = signal('');protected readonly actionError = signal('');protected readonly submitting = signal(false);protected readonly clp = formatClp;
  protected readonly diagnosisForm = this.fb.nonNullable.group({diagnostico:['',Validators.required],descripcionReparacion:['',Validators.required],montoCotizacion:[0,[Validators.required,Validators.min(0)]],plazoInformado:[''],responsable:['',Validators.required]});
  protected readonly closeForm = this.fb.nonNullable.group({fechaRetorno:['',Validators.required],costoFinal:[0,[Validators.required,Validators.min(0)]],resultado:['',Validators.required],estadoFinal:['' as 'OPERATIVO'|'SIN_REPARACION'|'BAJA'|'',Validators.required],observacionesRetorno:[''],responsable:['',Validators.required]});
  ngOnInit(): void { this.load(); }
  protected load(): void { this.loading.set(true);this.error.set('');this.service.listar().subscribe({next:items=>{this.orders.set(items);const current=this.selected();if(current)this.selected.set(items.find(item=>item.id===current.id)||null);if(!this.selected()&&items[0])this.select(items[0]);this.loading.set(false)},error:e=>{this.error.set(errorMessage(e));this.loading.set(false)}}); }
  protected select(order: OrdenServicio): void { const responsible=this.auth.user()?.nombre||'';this.selected.set(order);this.actionError.set('');this.diagnosisForm.reset({diagnostico:'',descripcionReparacion:'',montoCotizacion:0,plazoInformado:'',responsable: responsible});this.closeForm.reset({fechaRetorno:'',costoFinal:0,resultado:'',estadoFinal:'',observacionesRetorno:'',responsable: responsible}); }
  protected statusLabel(state: EstadoOrdenServicio): string { return ({PENDIENTE_DIAGNOSTICO:'Pendiente de diagnóstico',COTIZACION_RECIBIDA:'Diagnóstico registrado',REPARACION_APROBADA:'Diagnóstico registrado',REPARACION_RECHAZADA:'Finalizado',EN_REPARACION:'Diagnóstico registrado',REPARACION_TERMINADA:'Diagnóstico registrado',CERRADA:'Finalizado',BAJA:'Finalizado'} as Record<EstadoOrdenServicio,string>)[state]; }
  protected statusTone(state: EstadoOrdenServicio): string { if(state==='CERRADA')return 'success';if(state==='BAJA'||state==='REPARACION_RECHAZADA')return 'danger';if(state==='PENDIENTE_DIAGNOSTICO'||state==='COTIZACION_RECIBIDA')return 'warning';return 'active'; }
  protected serviceTypeLabel(type: OrdenServicio['tipoServicio']): string { return ({GARANTIA:'Garantía',REPARACION:'Reparación',MANTENCION:'Mantención',DIAGNOSTICO:'Diagnóstico'} as Record<OrdenServicio['tipoServicio'],string>)[type]||'Diagnóstico'; }
  protected dateLabel(value: string): string { const [year,month,day]=value.slice(0,10).split('-');return `${day}/${month}/${year}`; }
  protected finalStatusLabel(state: OrdenServicio['estadoFinal']): string { return ({OPERATIVO:'Operativo',SIN_REPARACION:'Sin reparación',BAJA:'Baja'} as Record<string,string>)[state||'']||'No informado'; }
  private perform(request: Observable<OrdenServicio>,success:string): void { this.submitting.set(true);this.actionError.set('');request.subscribe({next:order=>{this.selected.set(order);this.submitting.set(false);this.toast.success(success);this.load()},error:e=>{this.actionError.set(errorMessage(e));this.submitting.set(false)}}); }
  protected saveDiagnosis(order: OrdenServicio): void { if(this.diagnosisForm.invalid){this.diagnosisForm.markAllAsTouched();return}const value=this.diagnosisForm.getRawValue();this.perform(this.service.cotizar(order.id,{...value,plazoInformado:value.plazoInformado.trim()||null,proveedor:null}),'Diagnóstico guardado'); }
  protected close(order: OrdenServicio): void { if(this.closeForm.invalid){this.closeForm.markAllAsTouched();return}const value=this.closeForm.getRawValue();this.perform(this.service.cerrar(order.id,{...value,fechaRetorno:value.fechaRetorno,estadoFinal:value.estadoFinal as 'OPERATIVO'|'SIN_REPARACION'|'BAJA',observacionesRetorno:value.observacionesRetorno.trim()||null}),'Revisión finalizada'); }
}
