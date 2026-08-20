import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideBuilding, LucideCircleAlert, LucideHistory, LucidePackageCheck, LucidePencil, LucideRotateCcw, LucideShieldAlert, LucideUserCheck, LucideUsers, LucideWrench, LucideX } from '@lucide/angular';
import { forkJoin, Observable } from 'rxjs';
import { ActaEntrega, Colaborador, ColaboradorResumen, Departamento, Dispositivo, Estado, HistorialEvento, OrdenServicio } from '../../core/models/itam.models';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { EstadosService } from '../../core/services/estados.service';
import { ToastService } from '../../core/services/toast.service';
import { ServicioTecnicoService } from '../../core/services/servicio-tecnico.service';
import { ActasEntregaService } from '../../core/services/actas-entrega.service';
import { DocumentPreview } from '../../shared/components/document-preview/document-preview';
import { AssetLabel } from '../../shared/components/asset-label/asset-label';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { ActaPreview } from '../../shared/components/acta-preview/acta-preview';
import { errorMessage } from '../../shared/utils/error-message';
import { formatClp } from '../../shared/utils/currency';

export const receiversForDepartment = (
  collaborators: readonly Colaborador[],
  departmentId: string
): Colaborador[] => departmentId
  ? collaborators.filter((person) => person.departamento?.id === departmentId)
  : [];

type DeviceAction = 'assign-person' | 'assign-department' | 'return' | 'state' | 'service' | 'retire';
type PreviewType = 'delivery' | 'receipt';

@Component({
  selector: 'app-dispositivo-detail',
  imports: [DatePipe, ReactiveFormsModule, RouterLink, PageHeader, StatusBadge, ViewState, DocumentPreview, ActaPreview, AssetLabel, LucideBuilding, LucideCircleAlert, LucideHistory, LucidePackageCheck, LucidePencil, LucideRotateCcw, LucideShieldAlert, LucideUserCheck, LucideUsers, LucideWrench, LucideX],
  template: `
    <app-page-header title="Ficha de Equipo" subtitle="Detalle patrimonial, log de auditoría y acciones operativas.">
      <a class="btn btn--secondary" [routerLink]="['/dispositivos']">Volver al inventario</a>
    </app-page-header>
    @if (loading()) { <section class="card"><app-view-state kind="loading" title="Cargando ficha del equipo" /></section> }
    @else if (error()) { <section class="card"><app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" /></section> }
    @else if (item(); as device) {
      <section class="device-banner">
        <div><span>ACTIVO TECNOLÓGICO</span><h2>{{ device.tipo.nombre }} · {{ device.marca || 'Sin marca' }} {{ device.modelo || '' }}</h2><p>{{ device.numeroSerie ? 'S/N: ' + device.numeroSerie : 'Sin número de serie registrado' }}</p></div>
        <div><app-status-badge [code]="device.estado.codigo" [label]="device.estado.nombre" /><a class="btn btn--secondary btn--small" [routerLink]="['editar']"><svg lucidePencil></svg>Editar ficha</a></div>
      </section>
      @if (terminal()) { <div class="notice notice--error"><svg lucideCircleAlert></svg>El dispositivo está en un estado terminal. Las asignaciones quedan deshabilitadas; la API continúa siendo la autoridad sobre transiciones permitidas.</div> }
      <section class="panoramic-card">
        <article class="panoramic-column details-column">
          <div class="column-title"><span>01</span><div><small>IDENTIFICACIÓN</small><h3>Detalles</h3></div></div>
          <div class="equipment-identity"><span>{{ device.tipo.nombre }}</span><strong>{{ device.marca || 'Sin marca' }}</strong><h4>{{ device.modelo || 'Modelo no registrado' }}</h4></div>
          <dl class="technical-list"><div><dt>S/N</dt><dd class="code">{{ device.numeroSerie || '—' }}</dd></div><div><dt>Ubicación</dt><dd>{{ device.localidad || '—' }} {{ device.ubicacionDetalle || '' }}</dd></div><div><dt>Código</dt><dd class="code">{{ device.codigoInventario }}</dd></div><div><dt>Tipo</dt><dd>{{ device.tipo.nombre }}</dd></div><div><dt>IMEI</dt><dd class="code">{{ device.imei || '—' }}</dd></div><div><dt>Valor comercial</dt><dd>{{clp(device.valorComercial)}}</dd></div>@for (field of device.tipo.configuracionFormulario.camposEspecificos; track field.clave) { @if (device.atributosEspecificos[field.clave] !== undefined) { <div><dt>{{ field.etiqueta }}</dt><dd>{{ device.atributosEspecificos[field.clave] }}</dd></div> } }<div><dt>Registro</dt><dd>{{ device.fechaRegistro | date:'dd/MM/yyyy' }}</dd></div></dl>
          <section class="physical-label"><span>ETIQUETA FÍSICA</span><app-asset-label [code]="device.codigoInventario" [assetType]="device.tipo.nombre" printLabel="Reimprimir etiqueta" /></section>
          <section class="custody-panel"><span>CUSTODIA ACTUAL</span>@if(device.tipoCustodia==='COLABORADOR'&&device.colaborador){<div><svg lucideUsers></svg><p><strong>{{device.colaborador.nombre}}</strong><small>RUT {{device.colaborador.rut}}</small><small>Departamento: {{device.colaborador.departamento?.nombre||'Sin departamento'}}</small></p></div>}@else if(device.tipoCustodia==='DEPARTAMENTO'&&device.departamento){<div><svg lucideBuilding></svg><p><strong>{{device.departamento.nombre}}</strong><small>Asignación directa al departamento</small></p></div>}@else{<div><svg lucidePackageCheck></svg><p><strong>Sin custodia vigente</strong><small>Disponible para gestión según su estado</small></p></div>}</section>
          @if(device.simAsociada){<section class="associated-sim"><strong>SIM asociada #{{ device.simAsociada.codigoInventario }}</strong><span>{{ device.simAsociada.numeroAsociado || 'Sin número' }} · {{ device.simAsociada.compania || 'Sin operador' }}</span></section>}
        </article>
        <article class="panoramic-column audit-column">
          <div class="column-title"><span>02</span><div><small>TRAZABILIDAD</small><h3>Log de Auditoría</h3></div><svg lucideHistory></svg></div>
          @if (!history().length) { <app-view-state kind="empty" title="Sin movimientos" message="Este activo aún no registra eventos de historial." /> }
          @else { <div class="audit-timeline">@for(event of history(); track event.id){<article class="audit-event"><span class="audit-event__node"></span><div><strong>{{ event.tipoEvento.replaceAll('_',' ') }}</strong><p><span>{{ event.estadoAnterior?.nombre || 'Sin estado' }}</span><b>→</b><span>{{ event.estadoNuevo?.nombre || 'Sin cambio' }}</span></p>@if(custodyText(event,'custodiaAnterior');as before){<p><span>{{before}}</span><b>→</b><span>{{custodyText(event,'custodiaNueva')||'Sin custodia'}}</span></p>}@if(event.observaciones){<blockquote>{{ event.observaciones }}</blockquote>}<footer><time>{{ event.fechaEvento | date:'dd/MM/yyyy HH:mm' }}</time><span>{{ event.responsable }}</span></footer></div></article>}</div> }
        </article>
        <aside class="panoramic-column actions-column">
          <div class="column-title"><span>03</span><div><small>GESTIÓN</small><h3>Acciones Operativas</h3></div></div>
          @if (!action()) {
            <div class="operation-list">
              <button type="button" [disabled]="terminal()" (click)="open('assign-person')"><svg lucideUserCheck></svg><span>Asignar Equipo<small>A colaborador activo</small></span></button>
              @if((device.colaborador || device.departamento) && !terminal()){<button type="button" class="operation-return" (click)="open('return')"><svg lucideRotateCcw></svg><span>Devolver a Bodega<small>Registra recepción y revisión</small></span></button>}
              <button type="button" [disabled]="terminal()" (click)="open('service')"><svg lucideWrench></svg><span>Servicio Técnico<small>Crear orden y bloquear movimientos</small></span></button>
              <button type="button" [disabled]="!stateExists('EXTRAVIADO')" (click)="openState('EXTRAVIADO')"><svg lucideShieldAlert></svg><span>Reportar Extravío<small>Requiere confirmación</small></span></button>
              <button type="button" (click)="open('assign-department')" [disabled]="terminal()"><svg lucideBuilding></svg><span>Asignar Departamento<small>Custodia institucional</small></span></button>
              <button type="button" (click)="open('state')"><svg lucidePackageCheck></svg><span>Cambiar Estado<small>Ver catálogo completo</small></span></button>
              <button type="button" class="operation-danger" [disabled]="!stateExists('DADO_BAJA')" (click)="open('retire')"><svg lucideCircleAlert></svg><span>Dar de Baja<small>Motivo obligatorio</small></span></button>
            </div>
          } @else {
            <form class="action-form" [formGroup]="actionForm" (ngSubmit)="execute()">
              <header><div><small>OPERACIÓN EN CURSO</small><h4>{{ actionTitle() }}</h4></div><button class="icon-button" type="button" aria-label="Cancelar operación" (click)="action.set(null)"><svg lucideX></svg></button></header>
              @if(actionError()){<div class="notice notice--error">{{ actionError() }}</div>}
              @if(action()==='assign-person'){<div class="field"><label for="colaborador">Colaborador *</label><select id="colaborador" formControlName="colaboradorId"><option value="">Seleccionar colaborador</option>@for(person of collaborators(); track person.id){<option [value]="person.id">{{ person.nombre }} · {{ person.rut }}</option>}</select></div>}
              @if(action()==='assign-department'){<div class="notice notice--info">La custodia será institucional; el recepcionante identifica a quien recibe físicamente.</div><div class="field"><label for="dept">Departamento *</label><select id="dept" formControlName="departamentoId"><option value="">Seleccionar</option>@for(department of departments(); track department.id){<option [value]="department.id">{{department.nombre}}</option>}</select></div><div class="field"><label for="receiver">Persona que recepciona *</label><select id="receiver" formControlName="recibidoPorId"><option value="">Seleccionar colaborador del departamento</option>@for(person of departmentReceivers();track person.id){<option [value]="person.id">{{person.nombre}} · {{person.rut}} · {{person.cargo||'Sin cargo'}}</option>}</select></div><div class="field"><label for="location">Localidad</label><input id="location" formControlName="localidad" maxlength="120" /></div><div class="field"><label for="position">Ubicación</label><input id="position" formControlName="ubicacionDetalle" maxlength="250" /></div>}
              @if(action()==='state'){<div class="field"><label for="new-state">Nuevo estado *</label><select id="new-state" formControlName="estadoId"><option value="">Seleccionar</option>@for(state of states(); track state.id){<option [value]="state.id">{{ state.nombre }}{{ state.esTerminal ? ' · terminal' : '' }}</option>}</select></div>}
              @if(action()==='service'){<div class="field"><label for="provider">Proveedor</label><input id="provider" formControlName="proveedor" maxlength="180" /></div><div class="field"><label for="failure">Falla reportada *</label><textarea id="failure" formControlName="fallaReportada"></textarea></div>}
              @if(action()==='retire'){<div class="notice notice--info">La baja conservará el motivo, el valor comercial vigente y el responsable TI en la trazabilidad.</div><div class="field"><label for="retire-reason">Motivo *</label><select id="retire-reason" formControlName="motivoBaja"><option value="">Seleccionar</option><option value="IRREPARABLE">Irreparable</option><option value="REPARACION_NO_CONVENIENTE">Reparación no conveniente</option><option value="MULTIPLES_REPARACIONES">Múltiples reparaciones</option><option value="OBSOLESCENCIA">Obsolescencia</option><option value="DANO_FISICO">Daño físico</option><option value="SIN_REPUESTOS">Sin repuestos</option><option value="OTRO">Otro</option></select></div>}
              <div class="field"><label for="responsible">Responsable TI *</label><input id="responsible" formControlName="responsable" maxlength="150" /></div>
              <div class="field"><label for="action-notes">Observaciones</label><textarea id="action-notes" formControlName="observaciones" placeholder="Motivo, condición o antecedentes relevantes"></textarea></div>
              <div class="action-form__buttons"><button class="btn btn--ghost" type="button" (click)="action.set(null)">Cancelar</button><button class="btn btn--primary" type="submit" [disabled]="submitting()">{{ submitting() ? 'Procesando…' : 'Confirmar operación' }}</button></div>
            </form>
          }
        </aside>
      </section>
      @if (device.observaciones) { <section class="card device-notes"><strong>Observaciones de la ficha</strong><p>{{ device.observaciones }}</p></section> }
    }
    @if(previewDevice(); as preview){<app-document-preview [documentType]="previewType()" [device]="preview" [collaborator]="previewPerson()" [observations]="previewNotes()" (close)="previewDevice.set(null)" />}
    @if(createdActa();as acta){<app-acta-preview [acta]="acta" [pdfUrl]="actasService.pdfUrl(acta.id)" (close)="createdActa.set(null)" />}
  `,
  styleUrl: './dispositivo-detail.scss'
})
export class DispositivoDetail implements OnInit {
  private readonly service = inject(DispositivosService);
  private readonly estadosService = inject(EstadosService);
  private readonly colaboradoresService = inject(ColaboradoresService);
  private readonly departamentosService = inject(DepartamentosService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(ToastService);
  private readonly technicalService=inject(ServicioTecnicoService);
  protected readonly actasService=inject(ActasEntregaService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  protected readonly item = signal<Dispositivo | null>(null);
  protected readonly history = signal<HistorialEvento[]>([]);
  protected readonly states = signal<Estado[]>([]);
  protected readonly collaborators = signal<Colaborador[]>([]);
  protected readonly departments = signal<Departamento[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly submitting = signal(false);
  protected readonly action = signal<DeviceAction | null>(null);
  protected readonly previewDevice = signal<Dispositivo | null>(null);
  protected readonly previewPerson = signal<ColaboradorResumen | null>(null);
  protected readonly previewType = signal<PreviewType>('delivery');
  protected readonly previewNotes = signal('');
  protected readonly createdActa=signal<ActaEntrega|null>(null);
  protected readonly clp=formatClp;
  private codigo = 0;
  protected readonly actionForm = this.fb.nonNullable.group({ colaboradorId: [''], departamentoId: [''], recibidoPorId:[''], localidad: [''], ubicacionDetalle: [''], estadoId: [''], proveedor:[''], fallaReportada:[''], motivoBaja:[''], responsable: ['', [Validators.required, Validators.maxLength(150)]], observaciones: [''] });

  ngOnInit(): void { this.codigo = Number(this.route.snapshot.paramMap.get('codigo')); this.load(); }
  protected load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({ item: this.service.obtener(this.codigo), history: this.service.historial(this.codigo), states: this.estadosService.listar('DISPOSITIVO'), collaborators: this.colaboradoresService.listar({ activo: true }), departments: this.departamentosService.listar() }).subscribe({ next: (result) => { this.item.set(result.item); this.history.set(result.history); this.states.set(result.states.filter((state) => state.activo)); this.collaborators.set(result.collaborators); this.departments.set(result.departments.filter((department) => department.activo)); this.loading.set(false); if (this.route.snapshot.queryParamMap.get('action') === 'assign' && !this.terminal()) this.open('assign-person'); }, error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); } });
  }
  protected terminal(): boolean { return this.states().find((state) => state.id === this.item()?.estado.id)?.esTerminal ?? false; }
  protected stateExists(code: string): boolean { return this.states().some((state) => state.codigo === code); }
  protected open(action: DeviceAction): void { this.actionForm.reset({ colaboradorId: '', departamentoId: '',recibidoPorId:'', localidad: this.item()?.localidad || '', ubicacionDetalle: this.item()?.ubicacionDetalle || '', estadoId: '',proveedor:'',fallaReportada:'',motivoBaja:'', responsable: '', observaciones: '' }); this.actionError.set(''); this.action.set(action); }
  protected openState(code: string): void { const state = this.states().find((item) => item.codigo === code); if (!state) return; this.open('state'); this.actionForm.controls.estadoId.setValue(state.id); }
  protected actionTitle(): string { return { 'assign-person': 'Generar Asignación', 'assign-department': 'Asignar a Departamento', return: 'Registrar Devolución', state: 'Cambiar Estado',service:'Enviar a Servicio Técnico',retire:'Dar de Baja' }[this.action() || 'return']; }
  protected departmentReceivers():Colaborador[]{return receiversForDepartment(this.collaborators(),this.actionForm.controls.departamentoId.value);}
  protected custodyText(event: HistorialEvento, key: 'custodiaAnterior'|'custodiaNueva'): string {
    const value = event.detalle[key];
    if (!value || typeof value !== 'object') return '';
    const custody = value as { tipo?: string; nombre?: string };
    if (custody.tipo === 'COLABORADOR') return `Colaborador: ${custody.nombre || 'sin nombre'}`;
    if (custody.tipo === 'DEPARTAMENTO') return `Departamento: ${custody.nombre || 'sin nombre'}`;
    return 'Sin custodia';
  }

  protected async execute(): Promise<void> {
    const action = this.action(); if (!action) return;
    const value = this.actionForm.getRawValue();
    if (!value.responsable.trim()) { this.actionForm.controls.responsable.markAsTouched(); return; }
    if (action === 'assign-person' && !value.colaboradorId) { this.actionError.set('Selecciona un colaborador.'); return; }
    if (action === 'assign-department' && (!value.departamentoId||!value.recibidoPorId)) { this.actionError.set('Selecciona el departamento y la persona que recepciona.'); return; }
    if (action === 'state' && !value.estadoId) { this.actionError.set('Selecciona un estado.'); return; }
    if (action === 'service' && !value.fallaReportada.trim()) { this.actionError.set('Describe la falla reportada.'); return; }
    if (action === 'retire' && !value.motivoBaja) { this.actionError.set('Selecciona el motivo de baja.'); return; }
    if (action === 'return' && !await this.confirmation.confirm('Se registrará la devolución, se limpiará la custodia y el equipo quedará retenido para revisión.', { title: 'Confirmar devolución', confirmLabel: 'Confirmar recepción' })) return;
    if (action === 'retire' && !await this.confirmation.confirm('El activo quedará dado de baja y el motivo se conservará para auditoría.', { title: 'Confirmar baja', confirmLabel: 'Dar de baja', tone: 'danger' })) return;
    const target = this.states().find((state) => state.id === value.estadoId);
    if (action === 'state' && target?.esTerminal && !await this.confirmation.confirm(`El activo cambiará al estado terminal “${target.nombre}”.`, { title: 'Confirmar estado terminal', confirmLabel: 'Cambiar estado', tone: 'danger' })) return;
    if (action === 'state' && target?.codigo === 'EXTRAVIADO' && !await this.confirmation.confirm('Esta acción marcará el activo como extraviado y quedará registrada en su historial.', { title: 'Reportar extravío', confirmLabel: 'Reportar', tone: 'danger' })) return;
    const previous = this.item();
    const common = { responsable: value.responsable.trim(), observaciones: value.observaciones.trim() || null };
    let request: Observable<Dispositivo|OrdenServicio>;
    if (action === 'assign-person') request = this.service.asignarColaborador(this.codigo, { ...common, colaboradorId: Number(value.colaboradorId) });
    else if (action === 'assign-department') request = this.service.asignarDepartamento(this.codigo, { ...common, departamentoId: Number(value.departamentoId),recibidoPorId:Number(value.recibidoPorId), localidad: value.localidad.trim() || null, ubicacionDetalle: value.ubicacionDetalle.trim() || null });
    else if (action === 'return') request = this.service.devolver(this.codigo, common);
    else if(action==='service')request=this.technicalService.crear({dispositivoCodigo:this.codigo,proveedor:value.proveedor.trim()||null,fallaReportada:value.fallaReportada.trim(),responsable:value.responsable.trim()});
    else if(action==='retire')request=this.service.darBaja(this.codigo,{...common,motivo:value.motivoBaja as import('../../core/models/itam.models').MotivoBaja});
    else request = this.service.cambiarEstado(this.codigo, { ...common, estadoId: Number(value.estadoId) });
    this.submitting.set(true); this.actionError.set('');
    request.subscribe({ next: (result) => { this.action.set(null); this.submitting.set(false); this.toast.success('Operación registrada', 'La ficha y el historial fueron actualizados.'); if('codigoInventario' in result){const updated=result;if(action==='assign-person'||action==='assign-department'){this.actasService.crear({colaboradorId:action==='assign-person'?Number(value.colaboradorId):null,departamentoId:action==='assign-department'?Number(value.departamentoId):null,recepcionanteId:action==='assign-department'?Number(value.recibidoPorId):null,localidad:value.localidad.trim()||updated.localidad,responsableTi:value.responsable.trim(),observaciones:value.observaciones.trim()||null,dispositivosCodigos:[updated.codigoInventario]}).subscribe({next:acta=>this.createdActa.set(acta),error:error=>this.toast.warning('Asignación registrada',`No fue posible generar el acta: ${errorMessage(error)}`)});}else if(action==='return'){this.previewType.set('receipt');this.previewPerson.set(previous?.colaborador||previous?.recibidoPor||null);this.previewNotes.set(value.observaciones);this.previewDevice.set(updated);}}this.load(); }, error: (error) => { this.actionError.set(errorMessage(error)); this.submitting.set(false); } });
  }
}
