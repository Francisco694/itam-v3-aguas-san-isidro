import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideBuilding, LucideCircleAlert, LucideDownload, LucideExternalLink, LucideFileText, LucideHistory, LucidePackageCheck, LucidePencil, LucidePlus, LucideRotateCcw, LucideShieldAlert, LucideUserCheck, LucideWrench, LucideX } from '@lucide/angular';
import { catchError, combineLatest, forkJoin, Observable, of } from 'rxjs';
import { ActaEntrega, Colaborador, ComprobanteDevolucion, Departamento, Dispositivo, Estado, HistorialEvento, LineaMovilResumen, OrdenServicio, ResultadoDevolucion, Sim, TrazabilidadDispositivo } from '../../core/models/itam.models';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { AuthService } from '../../core/services/auth.service';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { EstadosService } from '../../core/services/estados.service';
import { SimService } from '../../core/services/sim.service';
import { ToastService } from '../../core/services/toast.service';
import { ServicioTecnicoService } from '../../core/services/servicio-tecnico.service';
import { ActasEntregaService } from '../../core/services/actas-entrega.service';
import { ComprobantesDevolucionService } from '../../core/services/comprobantes-devolucion.service';
import { FacturasAdquisicionService } from '../../core/services/facturas-adquisicion.service';
import { ComprobanteDevolucionPreview } from '../../shared/components/document-preview/comprobante-devolucion-preview';
import { AssetLabel, assetLabelResponsible } from '../../shared/components/asset-label/asset-label';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { ActaPreview } from '../../shared/components/acta-preview/acta-preview';
import { ApiError } from '../../core/models/api.models';
import { errorMessage } from '../../shared/utils/error-message';
import { formatClp } from '../../shared/utils/currency';


export const receiversForDepartment = (
  collaborators: readonly Colaborador[],
  departmentId: string
): Colaborador[] => departmentId
  ? collaborators.filter((person) => person.departamento?.id === departmentId)
  : [];

export const isSmartphoneDevice = (device: Dispositivo): boolean =>
  device.tipo.nombre.trim().toLocaleLowerCase('es') === 'smartphone';

export const isChileanPhoneInputValid = (value: string): boolean => {
  const clean = value.trim().replace(/\D/g, '');
  return !/[^\d.\-()\s+]/.test(value) && /^(?:\d{9}|56\d{9})$/.test(clean);
};

export const normalizeChileanPhoneInput = (value: string): string => {
  const clean = value.trim().replace(/\D/g, '');
  return clean.length === 9 ? `56${clean}` : clean;
};

export const smartphonePhoneValue = (device: Dispositivo): string | null =>
  device.lineaMovil?.numeroTelefonico?.trim()
    || device.numeroTelefonico?.trim()
    || device.labelPhone?.trim()
    || device.simAsociada?.lineaMovil?.numeroTelefonico?.trim()
    || device.simAsociada?.numeroAsociado?.trim()
    || null;

export const smartphonePhoneText = (device: Dispositivo): string => {
  return smartphonePhoneValue(device)
    || (device.simAsociada
      ? 'Número telefónico pendiente de registrar'
      : 'Sin número telefónico asociado');
};

export const smartphonePhonePending = (device: Dispositivo): boolean =>
  !!device.simAsociada
  && !smartphonePhoneValue(device);

export const smartphoneLineActionCopy = (device: Dispositivo): { title: string; description: string } => {
  const hasLine = !!smartphonePhoneValue(device);
  if (!hasLine && !device.simAsociada) {
    return { title: 'Agregar línea / SIM', description: 'Registrar número o asociar SIM' };
  }
  if (!device.simAsociada) {
    return { title: 'Gestionar línea / SIM', description: 'Editar número o asociar SIM' };
  }
  return { title: 'Gestionar línea / SIM', description: 'Editar línea o reemplazar SIM' };
};

export const isActiveTechnicalServiceOrder = (order: OrdenServicio): boolean =>
  !['CERRADA', 'BAJA', 'REPARACION_RECHAZADA'].includes(order.estado);

export const activeTechnicalServiceOrderForDevice = (
  orders: readonly OrdenServicio[],
  codigoInventario: number,
): OrdenServicio | null =>
  orders.find((order) => order.dispositivo.codigoInventario === codigoInventario && isActiveTechnicalServiceOrder(order)) ?? null;

export const technicalServiceOrderStatusLabel = (state: OrdenServicio['estado']): string => ({
  PENDIENTE_DIAGNOSTICO: 'Pendiente de diagnóstico',
  COTIZACION_RECIBIDA: 'Diagnóstico registrado',
  REPARACION_APROBADA: 'Resultado registrado',
  REPARACION_RECHAZADA: 'Resultado registrado',
  EN_REPARACION: 'Resultado registrado',
  REPARACION_TERMINADA: 'Resultado registrado',
  CERRADA: 'Finalizado',
  BAJA: 'Finalizado',
})[state];

const todayDateInputValue = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

const isDateInputValue = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime());

export const isSavedMobileLine = (value: unknown): value is LineaMovilResumen =>
  !!value
  && typeof value === 'object'
  && typeof (value as LineaMovilResumen).id === 'string'
  && !!(value as LineaMovilResumen).id.trim()
  && typeof (value as LineaMovilResumen).numeroTelefonico === 'string'
  && !!(value as LineaMovilResumen).numeroTelefonico.trim()
  && typeof (value as LineaMovilResumen).estado === 'string'
  && !!(value as LineaMovilResumen).estado.trim()
  && typeof (value as LineaMovilResumen).dispositivoId === 'string'
  && !!((value as LineaMovilResumen).dispositivoId || '').trim();

const mobileLineErrorDetail = (error: unknown): string => {
  if (!(error instanceof ApiError)) return errorMessage(error);
  if (error.status === 401 || error.status === 403) {
    return 'Sesión no válida o sin autorización para guardar la línea móvil.';
  }
  if (error.status === 409) {
    return 'El número telefónico ya está asociado a otro equipo.';
  }
  if (error.status >= 500) return 'Error interno al guardar la línea móvil.';
  return error.message;
};

interface FeedbackMessage {
  type: 'success' | 'error' | 'warning';
  title: string;
  detail: string;
}

interface ModalErrorMessage {
  title: string;
  detail: string;
}

export const collaboratorMatchesQuery = (person: Colaborador, query: string): boolean => {
  const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
  const value = normalize(query);
  if (!value || !person.activo) return false;
  const rut = value.replace(/[.\s-]/g, '');
  return normalize(person.nombre).includes(value)
    || (!!rut && /^[0-9k]+$/.test(rut) && person.rut.replace(/[.\s-]/g, '').toLowerCase().includes(rut));
};

export const isSimAvailableForJointDelivery = (sim: Sim): boolean =>
  sim.estado.codigo === 'DISPONIBLE'
  && !sim.dispositivo
  && !sim.colaborador;

export const isSimAvailableForDeviceAssociation = (sim: Sim): boolean =>
  !sim.dispositivo && ['DISPONIBLE', 'ASIGNADA'].includes(sim.estado.codigo);

export const simMatchesQuery = (sim: Sim, query: string): boolean => {
  const value = query.trim().toLocaleLowerCase('es');
  if (!value) return false;
  return String(sim.codigoInventario).includes(value)
    || (sim.numeroAsociado ?? '').toLocaleLowerCase('es').includes(value)
    || (sim.iccidCodigoFabrica ?? '').toLocaleLowerCase('es').includes(value);
};

export const deviceActionErrorMessage = (error: unknown): string =>
  errorMessage(error);

export interface LastKnownResponsible {
  id: string;
  nombre: string;
  rut: string;
  fechaAsignacion: string;
}

export const lastKnownPersonalResponsible = (events: readonly HistorialEvento[]): LastKnownResponsible | null => {
  const ordered = [...events].sort((left, right) => Date.parse(right.fechaEvento) - Date.parse(left.fechaEvento));
  for (const event of ordered) {
    if (event.tipoEvento !== 'ASIGNAR_COLABORADOR') continue;
    const collaborator = event.colaboradorHistorico;
    if (collaborator) return { ...collaborator, fechaAsignacion: event.fechaEvento };
    const custody = event.detalle['custodiaNueva'];
    if (!custody || typeof custody !== 'object') continue;
    const value = custody as { tipo?: unknown; id?: unknown; nombre?: unknown; rut?: unknown };
    if (value.tipo !== 'COLABORADOR' || typeof value.id !== 'string' || typeof value.nombre !== 'string') continue;
    return { id: value.id, nombre: value.nombre, rut: typeof value.rut === 'string' ? value.rut : '', fechaAsignacion: event.fechaEvento };
  }
  return null;
};

type DeviceAction = 'assign-person' | 'assign-department' | 'return' | 'state' | 'recover' | 'service' | 'retire';

@Component({
  selector: 'app-dispositivo-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, ReactiveFormsModule, RouterLink, PageHeader, StatusBadge, ViewState, ComprobanteDevolucionPreview, ActaPreview, AssetLabel, LucideBuilding, LucideCircleAlert, LucideDownload, LucideExternalLink, LucideFileText, LucideHistory, LucidePackageCheck, LucidePencil, LucidePlus, LucideRotateCcw, LucideShieldAlert, LucideUserCheck, LucideWrench, LucideX],
  template: `
    <app-page-header title="Ficha de Equipo" subtitle="Información del equipo y acciones disponibles.">
      <a class="btn btn--secondary" [routerLink]="['/dispositivos']">Volver al inventario</a>
    </app-page-header>
    @if (loading()) { <section class="card"><app-view-state kind="loading" title="Cargando ficha del equipo" /></section> }
    @else if (error()) { <section class="card"><app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" /></section> }
    @else if (item(); as device) {
      @if (feedback(); as message) {
        <section class="notice device-feedback" [class.notice--success]="message.type==='success'" [class.notice--error]="message.type==='error'" [class.notice--warning]="message.type==='warning'" role="status" aria-live="polite">
          <div><strong>{{ message.title }}</strong><span>{{ message.detail }}</span></div>
          <button type="button" class="icon-button" aria-label="Cerrar mensaje" (click)="clearFeedback()"><svg lucideX></svg></button>
        </section>
      }
      <section class="device-banner">
        <div><span>EQUIPO TECNOLÓGICO</span><h2>{{ device.tipo.nombre }} · {{ device.marca || 'Sin marca' }} {{ device.modelo || '' }}</h2>@if (!isSmartphone(device)) { <p>{{ device.numeroSerie ? 'S/N: ' + device.numeroSerie : 'Sin número de serie registrado' }}</p> }</div>
        <div><app-status-badge [code]="device.estado.codigo" [label]="device.estado.nombre" /><a class="btn btn--secondary btn--small" [routerLink]="['editar']"><svg lucidePencil></svg>Editar ficha</a></div>
      </section>
      <section class="traceability-overview" aria-label="Resumen de trazabilidad">
        <article><small>ESTADO DEL EQUIPO</small><strong>{{ device.estado.nombre }}</strong><span>{{ terminal() ? 'Fuera de la operación normal' : 'Estado registrado actualmente' }}</span></article>
        <article><small>VERIFICACIÓN FÍSICA</small><strong>{{ device.origenRegistro === 'MANUAL' || device.verificacionFisica?.resultado === 'VERIFICADO' ? 'Verificado' : 'No verificado' }}</strong><span>{{ device.origenRegistro === 'MANUAL' ? 'Acreditada por registro manual' : 'Auditoría física del inventario' }}</span></article>
        <article><small>RESPONSABLE ACTUAL</small>@if(traceability()?.responsableActual;as current){<strong>En poder de {{current.nombre}}</strong><span>{{current.tipo==='COLABORADOR' ? ('RUT '+(current.rut||'no informado')) : 'Departamento responsable'}}</span>}@else{<strong>Sin responsable actual</strong><span>{{device.estado.codigo==='DISPONIBLE' ? 'Disponible para entregar' : 'No registra una entrega vigente'}}</span>}</article>
        <article><small>ÚLTIMO RESPONSABLE CONOCIDO</small>@if(traceability()?.ultimoResponsableConocido;as previous){<strong>{{previous.nombre}}</strong><span>{{previous.tipo==='COLABORADOR' ? ('RUT '+(previous.rut||'no informado')) : 'Departamento'}} · {{previous.fechaUltimoMovimiento|date:'dd/MM/yyyy HH:mm'}} · {{originLabel(previous.origenDato)}}</span>}@else{<strong>Sin responsable conocido</strong><span>No existe evidencia histórica vinculada</span>}</article>
      </section>
      @for(alert of traceability()?.alertas || [];track alert){<div class="notice notice--warning traceability-alert"><svg lucideCircleAlert></svg><div><strong>{{ alert.includes('Asignado') ? 'Requiere revisión' : (device.estado.codigo==='EXTRAVIADO' ? 'Equipo perdido' : 'Equipo retirado del inventario') }}</strong><span>{{alert}}</span></div></div>}
      @if(activeServiceOrder(); as order){<section class="notice technical-service-card" role="status"><svg lucideWrench></svg><div><strong>Equipo en servicio técnico</strong><span>Este equipo está apartado del inventario operativo mientras se encuentra en revisión técnica.</span><dl><div><dt>Revisión N°</dt><dd>#{{order.id}}</dd></div><div><dt>Fecha de envío</dt><dd>{{serviceDateLabel(order.fechaEnvio)}}</dd></div><div><dt>Proveedor / técnico / destino</dt><dd>{{order.proveedor || 'No informado'}}</dd></div><div><dt>Falla reportada</dt><dd>{{order.fallaReportada}}</dd></div><div><dt>Estado de la revisión</dt><dd>{{technicalServiceStatusLabel(order.estado)}}</dd></div></dl><a class="btn btn--secondary btn--small" [routerLink]="['/servicio-tecnico']" [queryParams]="{orden: order.id}">Ver revisión técnica</a></div></section>}
      @if(serviceOrders().length){<section class="technical-history"><div class="column-title"><span>04</span><div><small>SERVICIO TÉCNICO</small><h3>Historial de servicio técnico</h3></div></div><div class="technical-history__list">@for(order of serviceOrders(); track order.id){<article><header><strong>Revisión #{{order.id}}</strong><span>{{technicalServiceStatusLabel(order.estado)}}</span></header><dl><div><dt>Fecha</dt><dd>{{serviceDateLabel(order.fechaEnvio)}}</dd></div><div><dt>Proveedor</dt><dd>{{order.proveedor || 'No informado'}}</dd></div><div><dt>Falla</dt><dd>{{order.fallaReportada}}</dd></div><div><dt>Costo cotizado / final</dt><dd>{{order.montoCotizacion === null ? 'No informado' : clp(order.montoCotizacion)}} / {{order.costoFinal === null ? 'No informado' : clp(order.costoFinal)}}</dd></div></dl><a class="btn btn--secondary btn--small" [routerLink]="['/servicio-tecnico']" [queryParams]="{orden: order.id}">Ver orden y cotización</a></article>}</div></section>}
      <section class="panoramic-card">
        <article class="panoramic-column details-column">
          <div class="column-title"><span>01</span><div><small>IDENTIFICACIÓN</small><h3>Detalles</h3></div></div>
          <div class="equipment-identity"><span>{{ device.tipo.nombre }}</span><strong>{{ device.marca || 'Sin marca' }}</strong><h4>{{ device.modelo || 'Modelo no registrado' }}</h4></div>
          <dl class="technical-list">
            @if (!isSmartphone(device)) { <div><dt>S/N</dt><dd class="code">{{ device.numeroSerie || '—' }}</dd></div> }
            <div><dt>Ubicación</dt><dd>{{ device.localidad || '—' }} {{ device.ubicacionDetalle || '' }}</dd></div>
            <div><dt>Código</dt><dd class="code">{{ device.codigoInventario }}</dd></div>
            <div><dt>Tipo</dt><dd>{{ device.tipo.nombre }}</dd></div>
            @if (isSmartphone(device)) {
              <div><dt>IMEI</dt><dd class="code">{{ device.imei || '—' }}</dd></div>
              <div><dt>Número telefónico</dt><dd>{{ smartphonePhoneText(device) }}</dd></div>
              <div><dt>SIM</dt><dd class="code" [style.color]="!device.simAsociada ? 'var(--warning)' : null">{{ device.simAsociada ? device.simAsociada.codigoInventario : 'Pendiente de asociar' }}</dd></div>
            } @else if (device.imei) { <div><dt>IMEI</dt><dd class="code">{{ device.imei }}</dd></div> }
            <div><dt>Valor del equipo</dt><dd>{{ clp(device.valorComercial) }}</dd></div>
            @for (field of device.tipo.configuracionFormulario.camposEspecificos; track field.clave) { @if (device.atributosEspecificos[field.clave] !== undefined) { <div><dt>{{ field.etiqueta }}</dt><dd>{{ device.atributosEspecificos[field.clave] }}</dd></div> } }
            <div><dt>Fecha de ingreso al inventario</dt><dd>{{ device.fechaIngresoInventario | date:'dd/MM/yyyy HH:mm:ss' }}</dd></div>
            <div><dt>Registrado en ITAM</dt><dd>{{ device.creadoEn | date:'dd/MM/yyyy HH:mm:ss' }}</dd></div>
          </dl>
          <section class="physical-label"><span>ETIQUETA FÍSICA</span><app-asset-label [code]="device.codigoInventario" [assetType]="device.tipo.nombre" [brandModel]="(device.marca || '') + (device.modelo ? ' ' + device.modelo : '')" [identifierLabel]="isSmartphone(device) ? 'IMEI' : 'N° serie'" [identifier]="isSmartphone(device) ? device.imei || '' : device.numeroSerie || ''" [responsible]="labelResponsible(device)" [phone]="labelPhone(device) || ''" [detail]="true" printLabel="Reimprimir etiqueta" /></section>
          @if(device.simAsociada){<section class="associated-sim"><strong>SIM asociada #{{ device.simAsociada.codigoInventario }}</strong><span>{{ smartphonePhoneText(device) }} · {{ device.simAsociada.compania || 'Sin operador' }}</span></section>}
        </article>
        <article class="panoramic-column audit-column">
          <div class="column-title"><span>02</span><div><small>TRAZABILIDAD</small><h3>Historial del equipo</h3></div><svg lucideHistory></svg></div>
          @if (!history().length) { <app-view-state kind="empty" title="Sin movimientos" message="Este equipo aún no registra movimientos." /> }
          @else { <div class="audit-timeline">@for(event of history(); track event.id){<article class="audit-event"><span class="audit-event__node"></span><div><strong>{{ eventLabel(event.tipoEvento) }}</strong>@if(event.tipoEvento==='VERIFICACION_FISICA' || event.tipoEvento==='EQUIPO_VERIFICADO_POR_REGISTRO_MANUAL'){<p>{{ verificationEventLabel(event) }}</p>}<p><span>{{ event.estadoAnterior?.nombre || 'Sin estado' }}</span><b>→</b><span>{{ event.estadoNuevo?.nombre || 'Sin cambio' }}</span></p>          @if(custodyText(event,'custodiaAnterior');as before){<p><span>{{before}}</span><b>→</b><span>{{custodyText(event,'custodiaNueva')||'Sin responsable'}}</span></p>}@if(event.observaciones){<blockquote>{{ event.observaciones }}</blockquote>}<footer><time>{{ event.fechaEvento | date:'dd/MM/yyyy HH:mm' }}</time><span>{{ event.responsable }}</span></footer></div></article>}</div> }
        </article>
        <aside class="panoramic-column actions-column">
          <div class="column-title"><span>03</span><div><small>GESTIÓN</small><h3>Acciones del equipo</h3></div></div>
          @if (!action()) {
            <div class="operation-list">
              <button type="button" [disabled]="terminal() || technicalServiceActive() || device.tipoCustodia!=='NONE'" (click)="open('assign-person')"><svg lucideUserCheck></svg><span>Entregar equipo<small>A un colaborador habilitado</small></span></button>
              @if((device.colaborador || device.departamento) && !terminal() && !technicalServiceActive()){<button type="button" class="operation-return" (click)="open('return')"><svg lucideRotateCcw></svg><span>Recibir en bodega<small>Registra recepción y revisión</small></span></button>}
              @if(!technicalServiceActive()){<button type="button" [disabled]="terminal()" (click)="openServiceOrder()"><svg lucideWrench></svg><span>Enviar a Servicio Técnico<small>Crear orden y bloquear movimientos</small></span></button>}
              <button type="button" [disabled]="!stateExists('EXTRAVIADO')" (click)="openState('EXTRAVIADO')"><svg lucideShieldAlert></svg><span>Reportar equipo perdido<small>Requiere confirmación</small></span></button>
              <button type="button" (click)="open('assign-department')" [disabled]="terminal() || technicalServiceActive() || device.tipoCustodia!=='NONE'"><svg lucideBuilding></svg><span>Entregar a departamento<small>Responsabilidad institucional</small></span></button>
              <button type="button" (click)="open('state')"><svg lucidePackageCheck></svg><span>Cambiar situación del equipo<small>Ver opciones disponibles</small></span></button>
              @if(canVerifyManually(device)){
                <button type="button" (click)="verifyManually()"><svg lucidePackageCheck></svg><span>Verificar equipo<small>Acción opcional de auditoría física</small></span></button>
              }
              @if(isSmartphone(device) && !terminal()){<button type="button" (click)="openSimAssociation()"><svg lucidePlus></svg><span>{{ lineActionCopy(device).title }}<small>{{ lineActionCopy(device).description }}</small></span></button>}
              @if(device.estado.codigo==='EXTRAVIADO' || device.estado.codigo==='DADO_BAJA'){<button type="button" (click)="open('recover')"><svg lucideRotateCcw></svg><span>Registrar equipo encontrado<small>Reactivar con trazabilidad</small></span></button>}
              <button type="button" class="operation-danger" [disabled]="!stateExists('DADO_BAJA')" (click)="open('retire')"><svg lucideCircleAlert></svg><span>Da de Baja<small>Motivo obligatorio</small></span></button>
            </div>
          } @else {
            <form class="action-form" [formGroup]="actionForm" (ngSubmit)="execute()">
              @if(action()==='service'){<section class="technical-order-identity"><strong>Orden de Trabajo - Servicio Técnico</strong><span>Revisa los antecedentes del equipo antes de registrar el envío.</span><dl><div><dt>Código ITAM</dt><dd>{{device.codigoInventario}}</dd></div><div><dt>Tipo de equipo</dt><dd>{{device.tipo.nombre}}</dd></div><div><dt>Marca / modelo</dt><dd>{{device.marca || 'Sin marca'}} {{device.modelo || ''}}</dd></div><div><dt>IMEI / serie</dt><dd>{{device.imei || device.numeroSerie || 'No informado'}}</dd></div><div><dt>Usuario / área</dt><dd>{{device.colaborador?.nombre || device.departamento?.nombre || 'No informado'}}</dd></div></dl></section>}
              <header><div><small>OPERACIÓN EN CURSO</small><h4>{{ actionTitle() }}</h4></div><button class="icon-button" type="button" aria-label="Cancelar operación" [disabled]="submitting()" (click)="action.set(null)"><svg lucideX></svg></button></header>
              @if(actionError()){<div class="notice notice--error" role="alert"><strong>{{ actionErrorTitle() || 'No se pudo registrar la operación' }}</strong><span>{{ actionError() }}</span></div>}
              @if(action()==='assign-person'){
                <div class="delivery-form">
                  <div class="field delivery-field">
                    <label for="colaborador">Colaborador responsable *</label>
                    @if(selectedCollaborator(); as person){
                      <div class="delivery-selection" role="status">
                        <div><small>Colaborador seleccionado</small><strong>{{person.nombre}}</strong><span>{{person.rut}} · {{person.departamento?.nombre || 'Sin departamento'}}</span></div>
                        <button type="button" class="btn btn--ghost btn--small" (click)="searchCollaborator('')" [disabled]="submitting()">Quitar</button>
                      </div>
                    } @else {
                      <input id="colaborador" type="search" autocomplete="off" placeholder="Buscar por nombre, apellido o RUT..." [value]="collaboratorQuery()" (input)="searchCollaborator($any($event.target).value)" [disabled]="submitting()" />
                      <small class="delivery-help">Escriba y seleccione un colaborador.</small>
                      @if(collaboratorQuery().trim()){
                        @if(matchingCollaborators().length){
                          <div class="delivery-suggestions" aria-label="Colaboradores encontrados">
                            @for(person of matchingCollaborators(); track person.id){
                              <button type="button" class="delivery-suggestion" (click)="selectCollaborator(person)"><strong>{{person.nombre}}</strong><span>{{person.rut}} · {{person.departamento?.nombre || 'Sin departamento'}}</span></button>
                            }
                          </div>
                        } @else {<p class="delivery-empty" role="status">Sin colaboradores encontrados</p>}
                      }
                    }
                  </div>
                  @if(isSmartphone(device)){
                    <div class="field delivery-field delivery-sim">
                      <label for="delivery-phone">Número telefónico{{ jointDelivery() ? ' *' : '' }}</label>
                      <input id="delivery-phone" type="tel" inputmode="tel" maxlength="20" placeholder="569XXXXXXXX" [value]="deliveryPhone()" (input)="deliveryPhone.set($any($event.target).value); actionError.set('')" [disabled]="submitting()" />
                      <small class="delivery-help">La línea móvil es independiente de la SIM; acepta 9 dígitos o formato 56XXXXXXXXX.</small>
                      @if(deliveryPhone().trim() && !isPhoneValid(deliveryPhone())){<small class="field-error" role="alert">Ingrese 9 dígitos o formato 56XXXXXXXXX.</small>}
                    </div>
                    @if(device.simAsociada; as associatedSim){
                      <div class="delivery-selection" role="status">
                        <div><small>Línea telefónica / SIM</small><strong>{{smartphonePhoneText(device)}}</strong><span>SIM ITAM {{associatedSim.codigoInventario}} · {{associatedSim.compania || 'Sin operador'}}</span></div>
                      </div>
                    } @else {
                      <label class="sim-delivery-toggle"><input type="checkbox" [checked]="jointDelivery()" (change)="toggleJointDelivery($any($event.target).checked)" [disabled]="submitting()" /> <span>Entregar SIM junto al equipo</span></label>
                    }
                    @if(!device.simAsociada && jointDelivery()){
                      <div class="field delivery-field delivery-sim">
                        <label for="delivery-sim">SIM disponible *</label>
                        @if(selectedSim(); as sim){
                          <div class="delivery-selection" role="status">
                            <div><small>SIM seleccionada</small><strong>ITAM {{sim.codigoInventario}}</strong><span>{{sim.numeroAsociado || 'Sin número'}} · {{sim.compania || 'Sin operador'}}</span></div>
                            <button type="button" class="btn btn--ghost btn--small" (click)="searchSim('')" [disabled]="submitting()">Quitar</button>
                          </div>
                        } @else {
                          <input id="delivery-sim" type="search" autocomplete="off" placeholder="Buscar por código ITAM, número o ICCID..." [value]="simQuery()" (input)="searchSim($any($event.target).value)" [disabled]="submitting()" />
                          @if(simLoading()){<p class="delivery-empty" role="status">Cargando SIM disponibles...</p>}
                          @else if(simError()){<div class="delivery-error"><span role="alert">{{simError()}}</span><button type="button" class="btn btn--ghost btn--small" (click)="loadDeliverySims()">Reintentar</button></div>}
                          @else if(simQuery().trim()){
                            @if(matchingSims().length){
                              <div class="delivery-suggestions" aria-label="SIM disponibles">
                                @for(sim of matchingSims(); track sim.id){<button type="button" class="delivery-suggestion" (click)="selectSim(sim)"><strong>ITAM {{sim.codigoInventario}}</strong><span>{{sim.numeroAsociado || 'Sin número'}} · {{sim.iccidCodigoFabrica || 'Sin ICCID'}}</span></button>}
                              </div>
                            } @else {<p class="delivery-empty" role="status">Sin SIM encontradas</p>}
                          }
                        }
                      </div>
                    }
                  }
                </div>
              }
              @if(action()==='assign-department'){<div class="notice notice--info">La responsabilidad será institucional; el colaborador que recibe confirma la entrega física.</div><div class="field"><label for="dept">Departamento *</label><select id="dept" formControlName="departamentoId"><option value="">Seleccionar</option>@for(department of departments(); track department.id){<option [value]="department.id">{{department.nombre}}</option>}</select></div><div class="field"><label for="receiver">Colaborador que recibe *</label><select id="receiver" formControlName="recibidoPorId"><option value="">Seleccionar colaborador del departamento</option>@for(person of departmentReceivers();track person.id){<option [value]="person.id">{{person.nombre}} · {{person.rut}} · {{person.cargo||'Sin cargo'}}</option>}</select></div><div class="field"><label for="location">Localidad</label><input id="location" formControlName="localidad" maxlength="120" /></div><div class="field"><label for="position">Ubicación</label><input id="position" formControlName="ubicacionDetalle" maxlength="250" /></div>}
              @if(action()==='state' || action()==='recover'){@if(action()==='recover'){<div class="notice notice--info">No se borrará la historia del equipo. Se registrará que el equipo fue encontrado.</div>}<div class="field"><label for="new-state">Nuevo estado *</label><select id="new-state" formControlName="estadoId"><option value="">Seleccionar</option>@for(state of states(); track state.id){@if(action()==='state' || state.codigo==='DISPONIBLE' || state.codigo==='SERVICIO_TECNICO'){<option [value]="state.id">{{ state.nombre }}{{ state.esTerminal ? ' · terminal' : '' }}</option>}}</select></div>}
              @if(isReportingSmartphoneLost()){
                <div class="notice notice--warning">El número pertenece a la línea móvil y puede conservarse aunque el equipo o la SIM se pierdan.</div>
                <div class="field"><label for="lost-line-action">¿Qué hacer con la línea telefónica? *</label><select id="lost-line-action" formControlName="accionLineaExtravio">
                  <option value="">Seleccionar</option>
                  @if(item()?.simAsociada){
                    <option value="CONSERVAR_BLOQUEAR">Conservar número y bloquear SIM actual</option>
                    <option value="DAR_BAJA">Dar de baja número</option>
                    <option value="PENDIENTE_CONFIRMAR">Dejar pendiente de confirmar</option>
                  } @else {
                    <option value="NO_APLICA">No aplica / no tenía SIM</option>
                  }
                </select></div>
              }
              @if(action()==='recover'){<div class="field"><label for="recovery-reason">Motivo *</label><textarea id="recovery-reason" formControlName="motivoRecuperacion" required></textarea></div>}
              @if(action()==='service'){<div class="field"><label for="service-date">Fecha de envío *</label><input id="service-date" type="date" formControlName="fechaEnvio" /></div><div class="field"><label for="provider">Proveedor / técnico / destino *</label><input id="provider" formControlName="proveedor" maxlength="180" /></div><div class="field"><label for="service-type">Tipo de servicio *</label><select id="service-type" formControlName="tipoServicio"><option value="">Seleccionar</option><option value="GARANTIA">Garantía</option><option value="REPARACION">Reparación</option><option value="MANTENCION">Mantención</option><option value="DIAGNOSTICO">Diagnóstico</option></select></div><div class="field"><label for="failure">Falla reportada *</label><textarea id="failure" formControlName="fallaReportada"></textarea></div><div class="field"><label for="accessories">Accesorios entregados</label><textarea id="accessories" formControlName="accesoriosEntregados"></textarea></div>}
              @if(action()==='retire'){<div class="notice notice--info">La baja conservará el motivo, el valor comercial vigente y el responsable TI en la trazabilidad.</div><div class="field"><label for="retire-reason">Motivo *</label><select id="retire-reason" formControlName="motivoBaja"><option value="">Seleccionar</option><option value="IRREPARABLE">Irreparable</option><option value="REPARACION_NO_CONVENIENTE">Reparación no conveniente</option><option value="MULTIPLES_REPARACIONES">Múltiples reparaciones</option><option value="OBSOLESCENCIA">Obsolescencia</option><option value="DANO_FISICO">Daño físico</option><option value="SIN_REPUESTOS">Sin repuestos</option><option value="OTRO">Otro</option></select></div>}
              <div class="field action-notes"><label for="action-notes">Observaciones</label><textarea id="action-notes" formControlName="observaciones" placeholder="Motivo, condición o antecedentes relevantes"></textarea></div>
              <div class="action-form__buttons"><button class="btn btn--ghost" type="button" (click)="action.set(null)">Cancelar</button><button class="btn btn--primary" type="submit" [disabled]="submitting()">{{ submitting() ? 'Procesando…' : (action()==='service'?'Registrar envío':'Confirmar operación') }}</button></div>
              @if(action()==='service'){<div class="form-grid"><div class="field"><label for="service-area">Área solicitante</label><input id="service-area" formControlName="areaSolicitante" maxlength="180" /></div><div class="field"><label for="service-contact">Contacto del servicio técnico</label><input id="service-contact" formControlName="contactoServicio" maxlength="180" /></div></div><div class="field"><label for="service-responsible">Responsable TI *</label><input id="service-responsible" formControlName="responsable" maxlength="150" /></div>}
            </form>
          }
        </aside>
      </section>
      @if(device.facturaAdquisicion;as factura){<section class="card device-notes"><strong>Antecedentes de adquisición</strong><p>Factura {{factura.numeroFactura}} · {{factura.fechaFactura||'Fecha no informada'}} · {{factura.proveedor||'Proveedor no informado'}} · {{factura.montoTotal===null?'Monto no informado':clp(factura.montoTotal)}}</p>@if(factura.observaciones){<p>{{factura.observaciones}}</p>}<div class="invoice-document">@if(factura.documento;as document){<span><svg lucideFileText></svg><strong>{{document.nombreOriginal}}</strong></span><a class="btn btn--ghost btn--small" [href]="facturas.documentoUrl(factura.id,false)" target="_blank" rel="noopener"><svg lucideExternalLink></svg>Ver documento</a><a class="btn btn--ghost btn--small" [href]="facturas.documentoUrl(factura.id,true)"><svg lucideDownload></svg>Descargar</a>}@else{<span>No se adjuntó documento.</span>}</div></section>}
      @if (device.observaciones) { <section class="card device-notes"><strong>Observaciones de la ficha</strong><p>{{ device.observaciones }}</p></section> }
    }
    @if(returnProof(); as proof){<app-comprobante-devolucion-preview [comprobante]="proof" [pdfUrl]="returnService.pdfUrl(proof.id)" (close)="returnProof.set(null)" />}
    @if(createdActa();as acta){<app-acta-preview [acta]="acta" [pdfUrl]="actasService.pdfUrl(acta.id)" (close)="createdActa.set(null)" />}
    @if(simAssociationOpen()){
      <div class="sim-association-overlay" role="presentation" (click)="closeSimAssociation()">
        <section class="sim-association-dialog card" role="dialog" aria-modal="true" aria-labelledby="sim-association-title" (click)="$event.stopPropagation()">
          <header><div><small>SMARTPHONE</small><h2 id="sim-association-title">{{ item() && lineActionCopy(item()!).title }}</h2></div><button class="icon-button" type="button" aria-label="Cerrar" [disabled]="submitting()" (click)="closeSimAssociation()"><svg lucideX></svg></button></header>
          @if(modalError(); as error){<div class="notice notice--error modal-save-error" role="alert"><strong>{{error.title}}</strong><span>{{error.detail}}</span></div>}
          <form novalidate (ngSubmit)="associateSim()">
            @if(submitting()){<div class="notice notice--info" role="status" aria-live="polite">Guardando número telefónico...</div>}
            <div class="field"><label for="association-phone">Número telefónico *</label><input id="association-phone" type="tel" inputmode="tel" maxlength="20" placeholder="569XXXXXXXX" [value]="simPhone()" (input)="simPhone.set($any($event.target).value); simError.set(''); modalError.set(null)" [disabled]="submitting()" required /><small class="hint">Acepta 9 dígitos o formato 56XXXXXXXXX.</small>@if(simPhone().trim() && !isPhoneValid(simPhone())){<small class="field-error" role="alert">Ingrese 9 dígitos o formato 56XXXXXXXXX.</small>}</div>
            @if(item()?.simAsociada; as currentSim){<div class="delivery-selection" role="status"><div><small>SIM asociada actualmente</small><strong>ITAM {{currentSim.codigoInventario}}</strong><span>{{currentSim.compania || 'Sin operador'}} · Elige otra SIM solo si deseas reemplazarla.</span></div></div>}@else{<div class="notice notice--warning">SIM pendiente de asociar. Puedes guardar el número ahora y asociar una SIM después.</div>}
            <div class="field"><label for="association-sim">{{item()?.simAsociada ? 'Reemplazar por una SIM disponible' : 'SIM disponible'}}</label><select id="association-sim" [value]="selectedSim()?.codigoInventario || ''" (change)="selectAssociationSimByCode($any($event.target).value)" [disabled]="simLoading() || submitting()"><option value="">{{simLoading() ? 'Cargando SIM disponibles…' : (item()?.simAsociada ? 'Mantener SIM actual' : 'Pendiente de asociar')}}</option>@for(sim of associationSims();track sim.id){<option [value]="sim.codigoInventario">ITAM {{sim.codigoInventario}} · {{sim.numeroAsociado || 'Sin número'}} · {{sim.compania || 'Sin operador'}}</option>}</select><small class="delivery-help">La SIM es opcional; el número queda guardado en la línea móvil.</small></div>
            <footer><button class="btn btn--ghost" type="button" [disabled]="submitting()" (click)="closeSimAssociation()">Cancelar</button><button class="btn btn--primary" type="submit" [disabled]="submitting()">{{submitting() ? 'Guardando número telefónico...' : 'Guardar cambios'}}</button></footer>
          </form>
        </section>
      </div>
    }
  `,
  styleUrl: './dispositivo-detail.scss',
  styles: [`.invoice-document{align-items:center;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:.7rem;display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.8rem;padding:.7rem}.invoice-document>span{align-items:center;color:var(--slate-500);display:flex;font-size:.74rem;gap:.45rem;margin-right:auto}.invoice-document>span svg{color:var(--blue);height:1rem;width:1rem}.device-feedback{align-items:flex-start;display:flex;gap:.75rem;justify-content:space-between;margin-bottom:1rem;position:relative;z-index:1}.device-feedback div,.modal-save-error{display:grid;gap:.25rem}.device-feedback span,.modal-save-error span{display:block}`]
})
export class DispositivoDetail implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly simService = inject(SimService);
  protected readonly collaboratorQuery = signal('');
  protected readonly selectedCollaborator = signal<Colaborador | null>(null);
  protected readonly jointDelivery = signal(false);
  protected readonly simQuery = signal('');
  protected readonly selectedSim = signal<Sim | null>(null);
  protected readonly deliverySims = signal<Sim[]>([]);
  protected readonly deliveryPhone = signal('');
  protected readonly associationSims = signal<Sim[]>([]);
  protected readonly simAssociationOpen = signal(false);
  protected readonly simPhone = signal('');
  protected readonly simLoading = signal(false);
  protected readonly simError = signal('');
  protected readonly modalError = signal<ModalErrorMessage | null>(null);
  protected readonly feedback = signal<FeedbackMessage | null>(null);
  private feedbackTimer?: number;
  protected matchingCollaborators(): Colaborador[] { return this.collaborators().filter(person => collaboratorMatchesQuery(person, this.collaboratorQuery())); }
  protected searchCollaborator(query: string): void { this.collaboratorQuery.set(query); this.selectedCollaborator.set(null); this.actionForm.controls.colaboradorId.setValue(''); }
  protected selectCollaborator(person: Colaborador): void { this.selectedCollaborator.set(person); this.collaboratorQuery.set(person.nombre); this.actionForm.controls.colaboradorId.setValue(person.id); }
  protected matchingSims(): Sim[] { return this.deliverySims().filter(sim => isSimAvailableForJointDelivery(sim) && simMatchesQuery(sim, this.simQuery())); }
  protected searchSim(query: string): void { const previous=this.selectedSim();if(!query&&previous?.numeroAsociado&&normalizeChileanPhoneInput(this.deliveryPhone())===normalizeChileanPhoneInput(previous.numeroAsociado))this.deliveryPhone.set('');this.simQuery.set(query);this.selectedSim.set(null); }
  protected selectSim(sim: Sim): void { this.selectedSim.set(sim); this.simQuery.set(String(sim.codigoInventario)); if(sim.numeroAsociado)this.deliveryPhone.set(sim.numeroAsociado); this.actionError.set(''); }
  protected selectAssociationSimByCode(code: string): void { const device=this.item(),previous=this.selectedSim(),sim=this.associationSims().find(item=>item.codigoInventario===Number(code))||null,currentPhone=device ? smartphonePhoneValue(device) || '' : '';if(sim?.numeroAsociado&&!currentPhone)this.simPhone.set(sim.numeroAsociado);else if(!currentPhone&&previous?.numeroAsociado&&normalizeChileanPhoneInput(this.simPhone())===normalizeChileanPhoneInput(previous.numeroAsociado))this.simPhone.set('');this.selectedSim.set(sim);this.simError.set('');this.modalError.set(null); }
  protected toggleJointDelivery(enabled: boolean): void { this.jointDelivery.set(enabled); this.searchSim(''); this.deliveryPhone.set(''); if(enabled) this.loadDeliverySims(); }
  protected loadDeliverySims(): void {
    if(this.simLoading()) return;
    this.simLoading.set(true); this.simError.set(''); this.deliverySims.set([]);
    this.simService.listar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sims => { this.deliverySims.set(sims.filter(isSimAvailableForJointDelivery)); this.simLoading.set(false); },
      error: error => { this.simError.set(errorMessage(error)); this.simLoading.set(false); }
    });
  }
  protected clearFeedback(): void {
    if (this.feedbackTimer !== undefined) {
      window.clearTimeout(this.feedbackTimer);
      this.feedbackTimer = undefined;
    }
    this.feedback.set(null);
  }
  private showFeedback(message: FeedbackMessage): void {
    this.clearFeedback();
    this.feedback.set(message);
    this.feedbackTimer=window.setTimeout(()=>this.feedback.set(null),7000);
  }
  private showModalError(title: string, detail: string): void {
    this.modalError.set({ title, detail });
  }
  private resetDetailStateForRoute(): void {
    this.submitting.set(false);
    this.action.set(null);
    this.actionError.set('');
    this.actionErrorTitle.set('');
    this.returnProof.set(null);
    this.createdActa.set(null);
    this.activeServiceOrder.set(null);
    this.serviceOrders.set([]);
    this.simAssociationOpen.set(false);
    this.selectedSim.set(null);
    this.simPhone.set('');
    this.simError.set('');
    this.modalError.set(null);
    this.clearFeedback();
  }
  private readonly service = inject(DispositivosService);
  private readonly estadosService = inject(EstadosService);
  private readonly colaboradoresService = inject(ColaboradoresService);
  private readonly departamentosService = inject(DepartamentosService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(ToastService);
  private readonly technicalService=inject(ServicioTecnicoService);
  protected readonly actasService=inject(ActasEntregaService);
  protected readonly returnService=inject(ComprobantesDevolucionService);
  protected readonly facturas=inject(FacturasAdquisicionService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  protected readonly item = signal<Dispositivo | null>(null);
  protected readonly traceability = signal<TrazabilidadDispositivo | null>(null);
  protected readonly history = signal<HistorialEvento[]>([]);
  protected readonly states = signal<Estado[]>([]);
  protected readonly collaborators = signal<Colaborador[]>([]);
  protected readonly departments = signal<Departamento[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly actionErrorTitle = signal('');
  protected readonly submitting = signal(false);
  protected readonly action = signal<DeviceAction | null>(null);
  protected readonly activeServiceOrder = signal<OrdenServicio | null>(null);
  protected readonly serviceOrders = signal<OrdenServicio[]>([]);
  protected readonly returnProof = signal<ComprobanteDevolucion | null>(null);
  protected readonly createdActa=signal<ActaEntrega|null>(null);
  protected readonly clp=formatClp;
  protected readonly isSmartphone=isSmartphoneDevice;
  protected readonly isPhoneValid=isChileanPhoneInputValid;
  protected readonly smartphonePhoneText=smartphonePhoneText;
  protected readonly smartphonePhonePending=smartphonePhonePending;
  protected readonly lineActionCopy=smartphoneLineActionCopy;
  protected readonly technicalServiceStatusLabel=technicalServiceOrderStatusLabel;
  protected serviceDateLabel(value: string): string { const [year,month,day]=value.slice(0,10).split('-');return `${day}/${month}/${year}`; }
  protected readonly labelResponsible=assetLabelResponsible;
  protected readonly labelPhone=smartphonePhoneValue;
  protected technicalServiceActive(): boolean { return this.item()?.estado.codigo === 'SERVICIO_TECNICO' || !!this.activeServiceOrder(); }
  protected originLabel(origin: 'HISTORIAL'|'BAJA'|'COMPROBANTE'): string { return {HISTORIAL:'Historial',BAJA:'Registro de baja',COMPROBANTE:'Comprobante'}[origin]; }
  protected eventLabel(event: string): string { return { ALTA_DISPOSITIVO: 'Equipo incorporado al inventario', ASIGNAR_COLABORADOR: 'Equipo entregado a un colaborador', CONCILIAR_DISPOSITIVO_EXISTENTE: 'Registro actualizado desde inventario anterior', DEVOLVER_A_BODEGA: 'Equipo recibido en bodega', CAMBIAR_ESTADO: 'Situación del equipo actualizada', REPORTAR_EXTRAVIO: 'Equipo reportado como perdido', DAR_DE_BAJA: 'Equipo retirado del inventario', VERIFICACION_FISICA: 'Verificación física', VERIFICACION_MANUAL_EQUIPO: 'Equipo verificado manualmente por usuario', EQUIPO_VERIFICADO_POR_REGISTRO_MANUAL: 'Equipo verificado por registro manual', SIM_ASOCIADA_A_DISPOSITIVO: 'SIM asociada al smartphone', ENTREGA_EQUIPO_CON_SIM: 'Smartphone entregado con SIM', LINEA_MOVIL_NUMERO_ACTUALIZADO: 'Número telefónico actualizado' }[event] || event.replaceAll('_', ' '); }
  protected verificationEventLabel(event: HistorialEvento): string { const result = event.detalle['resultado']; return result === 'VERIFICADO' ? '✓ Equipo verificado' : '○ Equipo no verificado'; }
  private codigo = 0;
  private id = '';
  private routeAction = '';
  protected readonly actionForm = this.fb.nonNullable.group({ colaboradorId: [''], departamentoId: [''], recibidoPorId:[''], localidad: [''], ubicacionDetalle: [''], estadoId: [''], accionLineaExtravio: [''], proveedor:[''], areaSolicitante:[''], contactoServicio:[''], fechaEnvio:[''], tipoServicio:[''], fallaReportada:[''], accesoriosEntregados:[''], motivoBaja:[''], motivoRecuperacion:[''], responsable: ['', [Validators.required, Validators.maxLength(150)]], observaciones: [''] });

  ngOnInit(): void {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([params, queryParams]) => {
        const nextId = params.get('codigo') || '';
        const routeChanged = nextId !== this.id;
        this.routeAction = queryParams.get('action') || '';
        if (!routeChanged && this.item()) return;
        this.id = nextId;
        this.codigo = Number(nextId) || 0;
        this.resetDetailStateForRoute();
        this.load();
      });
  }
  protected load(): void {
    const requestedId = this.id;
    this.loading.set(true); this.error.set('');
    forkJoin({ traceability: this.service.trazabilidad(this.id), states: this.estadosService.listar('DISPOSITIVO'), collaborators: this.colaboradoresService.listar({ activo: true }), departments: this.departamentosService.listar(), serviceOrders: this.technicalService.listar().pipe(catchError(() => of([] as OrdenServicio[]))) }).subscribe({ next: (result) => { if (requestedId !== this.id) return; this.traceability.set(result.traceability); this.item.set(result.traceability.dispositivo); this.codigo = result.traceability.dispositivo.codigoInventario; this.serviceOrders.set(result.serviceOrders.filter(order => String(order.dispositivo.id) === String(result.traceability.dispositivo.id))); this.activeServiceOrder.set(activeTechnicalServiceOrderForDevice(result.serviceOrders, this.codigo)); this.history.set(result.traceability.eventos); this.states.set(result.states.filter((state) => state.activo)); this.collaborators.set(result.collaborators); this.departments.set(result.departments.filter((department) => department.activo)); this.loading.set(false); if (this.routeAction === 'assign' && !this.terminal() && !this.technicalServiceActive()) this.open('assign-person'); }, error: (error) => { if (requestedId !== this.id) return; this.error.set(errorMessage(error)); this.loading.set(false); } });
  }
  protected terminal(): boolean { return this.states().find((state) => state.id === this.item()?.estado.id)?.esTerminal ?? false; }
  protected stateExists(code: string): boolean { return this.states().some((state) => state.codigo === code); }
  protected canVerifyManually(device: Dispositivo): boolean {
    return device.origenRegistro === 'IMPORTADO'
      && (device.verificacionFisica?.resultado || 'PENDIENTE') === 'PENDIENTE';
  }
  protected async verifyManually(): Promise<void> {
    if(this.submitting() || (this.item()?.verificacionFisica?.resultado || 'PENDIENTE')!=='PENDIENTE') return;
    const confirmed=await this.confirmation.confirm('Esta es una acción opcional de auditoría física. Confirme que revisó correctamente el código ITAM, tipo de equipo, marca/modelo, IMEI o número de serie, responsable actual, ubicación y estado operativo. Solo esta acción marcará el equipo como verificado y registrará un evento en su historial.',{title:'Verificar equipo',confirmLabel:'Confirmar verificación'});
    if(!confirmed)return;
    this.submitting.set(true);
    this.service.verificarManual(this.codigo).subscribe({next:()=>{this.submitting.set(false);this.toast.success('Equipo verificado','La verificación manual quedó registrada en el historial.');this.load();},error:error=>{this.submitting.set(false);this.toast.error('No se pudo verificar',errorMessage(error));}});
  }
  protected openSimAssociation(): void {
    const device=this.item();
    if(!device || !isSmartphoneDevice(device) || this.submitting())return;
    const currentPhone=smartphonePhoneText(device);this.action.set(null);this.selectedSim.set(null);this.simPhone.set(currentPhone==='Sin número telefónico asociado'||currentPhone==='Número telefónico pendiente de registrar'?'':currentPhone);this.simError.set('');this.modalError.set(null);this.associationSims.set([]);this.simAssociationOpen.set(true);this.simLoading.set(true);
    this.simService.listar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:sims=>{this.associationSims.set(sims.filter(isSimAvailableForDeviceAssociation));this.simLoading.set(false);},error:error=>{const message=errorMessage(error);this.simError.set(message);this.showModalError('No se pudieron cargar las SIM disponibles',message);this.simLoading.set(false);}});
  }
  protected closeSimAssociation(): void { if(this.submitting())return;this.simAssociationOpen.set(false);this.selectedSim.set(null);this.simPhone.set('');this.simError.set('');this.modalError.set(null); }
  protected async associateSim(): Promise<void> {
    const device=this.item(),sim=this.selectedSim();
    if(this.submitting())return;
    if(!device){this.showModalError('No se pudo guardar el número telefónico','No se pudo identificar el código ITAM del equipo actual.');return;}
    const codigo=Number(device.codigoInventario);
    if(!Number.isInteger(codigo)||codigo<=0){this.showModalError('No se pudo guardar el número telefónico','No se pudo identificar el código ITAM del equipo actual.');return;}
    const phone=this.simPhone().trim();
    if(!phone){this.showModalError('No se pudo guardar el número telefónico','Ingrese 9 dígitos o formato 56XXXXXXXXX.');return;}
    if(!isChileanPhoneInputValid(phone)){this.showModalError('No se pudo guardar el número telefónico','Ingrese 9 dígitos o formato 56XXXXXXXXX.');return;}
    const normalizedPhone=normalizeChileanPhoneInput(phone);
    const actorName=this.auth.user()?.nombre?.trim()||'Responsable TI';
    if(sim?.numeroAsociado && normalizeChileanPhoneInput(sim.numeroAsociado)!==normalizedPhone){
      const confirmed=await this.confirmation.confirm('La SIM seleccionada ya tiene otro número. Confirme que desea reemplazarlo por el número ingresado.',{title:'Actualizar número de la SIM',confirmLabel:'Actualizar y asociar'});
      if(!confirmed)return;
    }
    if(device.simAsociada && sim){
      const confirmed=await this.confirmation.confirm(`La SIM ITAM ${device.simAsociada.codigoInventario} será reemplazada por la SIM ITAM ${sim.codigoInventario}. El número telefónico se conservará en la línea móvil.`,{title:'Reemplazar SIM',confirmLabel:'Reemplazar SIM'});
      if(!confirmed)return;
    }
    this.submitting.set(true);this.simError.set('');this.modalError.set(null);
    const linePayload = { numeroTelefonico: normalizedPhone, simId: sim?.id ?? device.simAsociada?.id ?? null };
    console.log('[asociar-linea] codigo actual', codigo);
    console.log('[asociar-linea] payload', linePayload);
    const request: Observable<unknown> = this.service.asociarLinea(codigo,linePayload);
    request.subscribe({next:(result)=>{
      if (String(device.codigoInventario) !== this.id) return;
      {
        if(!isSavedMobileLine(result) || result.dispositivoId !== String(device.id)){
          this.submitting.set(false);
          const message='El servidor respondió, pero no devolvió la línea móvil guardada.';
          this.showModalError('No se pudo confirmar el guardado',message);
          this.toast.error('No se pudo confirmar el guardado del número telefónico',message);
          return;
        }
        const savedNumber=result.numeroTelefonico.trim();
        if(linePayload.simId && result.simId !== linePayload.simId){
          this.submitting.set(false);
          const message='El servidor guardó la línea, pero no confirmó la SIM seleccionada.';
          this.showModalError('No se pudo confirmar el guardado',message);
          this.toast.error('No se pudo confirmar la SIM asociada',message);
          return;
        }
        if(savedNumber!==normalizedPhone){
          this.submitting.set(false);
          const message=`El backend guardó otro número: ${savedNumber}.`;
          this.showModalError('No se pudo confirmar el guardado',message);
          this.toast.error('No se pudo confirmar el número telefónico',message);
          return;
        }
        this.service.obtener(device.codigoInventario).subscribe({
          next:refreshed=>{
            if (String(device.codigoInventario) !== this.id) return;
            const refreshedPhone=normalizeChileanPhoneInput(smartphonePhoneValue(refreshed) || '');
            if(refreshedPhone!==savedNumber){
              this.submitting.set(false);
              const message='La ficha del equipo no devolvió el número telefónico actualizado.';
              this.showModalError('No se pudo confirmar el guardado',message);
              this.toast.error('No se pudo confirmar el guardado del número telefónico',message);
              return;
            }
            this.item.set(refreshed);
            this.submitting.set(false);
            this.closeSimAssociation();
            const simStatus = linePayload.simId ? 'SIM asociada correctamente' : 'SIM pendiente de asociar';
            this.showFeedback({
              type: 'success',
              title: 'Número telefónico guardado correctamente',
              detail: `Número guardado: ${savedNumber}. ${simStatus}.`
            });
            this.toast.success('Número telefónico guardado correctamente',`Número guardado: ${savedNumber}. ${simStatus}.`);
          },
          error:error=>{
            if (String(device.codigoInventario) !== this.id) return;
             const message='La línea fue enviada, pero el detalle del equipo no devolvió el número guardado.';
            this.submitting.set(false);
            this.showModalError('No se pudo confirmar el guardado',message);
            this.toast.error('No se pudo confirmar el guardado del número telefónico',message);
          }
        });
        return;
      }
    },error:(error: unknown)=>{
      if (String(device.codigoInventario) !== this.id) return;
       const message=mobileLineErrorDetail(error);
      this.submitting.set(false);
      this.showModalError('No se pudo guardar el número telefónico',`Detalle: ${message}`);
      this.toast.error('No se pudo guardar el número telefónico',message);
    }});
  }
  protected open(action: DeviceAction): void { const actor=this.auth.user();if(!actor){this.actionError.set('La sesión no permite identificar al responsable TI.');this.toast.error('Sesión no válida','Vuelva a iniciar sesión antes de registrar una operación.');return;}if(action==='service'&&this.technicalServiceActive()){this.actionErrorTitle.set('No se pudo registrar el envío a servicio técnico');this.actionError.set('El equipo ya se encuentra en servicio técnico.');return;}this.actionForm.reset({ colaboradorId: '', departamentoId: '',recibidoPorId:'', localidad: this.item()?.localidad || '', ubicacionDetalle: this.item()?.ubicacionDetalle || '', estadoId: '',accionLineaExtravio:'',proveedor:'',fechaEnvio: action==='service' ? todayDateInputValue() : '',tipoServicio: action==='service' ? 'DIAGNOSTICO' : '',fallaReportada:'',accesoriosEntregados:'',motivoBaja:'',motivoRecuperacion:'', responsable: actor.nombre, observaciones: '' }); this.searchCollaborator(''); this.jointDelivery.set(false); this.deliveryPhone.set(action==='assign-person'&&this.item()&&isSmartphoneDevice(this.item()!) ? smartphonePhoneValue(this.item()!) || '' : ''); this.searchSim(''); this.actionError.set(''); this.actionErrorTitle.set(''); this.action.set(action); }
  protected openState(code: string): void { const state = this.states().find((item) => item.codigo === code); if (!state) return; this.open('state'); this.actionForm.controls.estadoId.setValue(state.id); if(code==='EXTRAVIADO'&&this.item()&&isSmartphoneDevice(this.item()!)&&!this.item()!.simAsociada)this.actionForm.controls.accionLineaExtravio.setValue('NO_APLICA'); }
  protected isReportingSmartphoneLost(): boolean { const target=this.states().find(state=>state.id===this.actionForm.controls.estadoId.value);const device=this.item();return this.action()==='state'&&!!device&&isSmartphoneDevice(device)&&target?.codigo==='EXTRAVIADO'; }
  protected actionTitle(): string { return { 'assign-person': 'Registrar entrega', 'assign-department': 'Entregar a departamento', return: 'Registrar recepción', state: 'Cambiar situación del equipo', recover: 'Registrar equipo encontrado', service:'Orden de Trabajo - Servicio Técnico',retire:'Retirar del inventario' }[this.action() || 'return']; }
  protected openServiceOrder(): void { this.open('service'); const device=this.item(); if(device)this.actionForm.controls.areaSolicitante.setValue(device.departamento?.nombre || 'Area TI - Aguas San Isidro'); }
  protected departmentReceivers():Colaborador[]{return receiversForDepartment(this.collaborators(),this.actionForm.controls.departamentoId.value);}
  protected custodyText(event: HistorialEvento, key: 'custodiaAnterior'|'custodiaNueva'): string {
    const value = event.detalle[key];
    if (!value || typeof value !== 'object') return '';
    const custody = value as { tipo?: string; nombre?: string };
    if (custody.tipo === 'COLABORADOR') return `Colaborador: ${custody.nombre || 'sin nombre'}`;
    if (custody.tipo === 'DEPARTAMENTO') return `Departamento: ${custody.nombre || 'sin nombre'}`;
    return 'Sin responsable';
  }

  protected async execute(): Promise<void> {
    const action = this.action(); if (!action || this.submitting()) return;
    const value = this.actionForm.getRawValue();
    const actor = this.auth.user();
    if (!actor?.nombre.trim()) { this.actionErrorTitle.set('No se pudo registrar la operación'); this.actionError.set('La sesión no permite identificar al responsable TI.'); return; }
    this.actionForm.controls.responsable.setValue(actor.nombre);
    if (action === 'assign-person' && !value.colaboradorId) { this.actionError.set('Selecciona un colaborador.'); return; }
    const deliveryPhoneValue = this.deliveryPhone().trim();
    if (action === 'assign-person' && this.item() && isSmartphoneDevice(this.item()!) && deliveryPhoneValue && !isChileanPhoneInputValid(deliveryPhoneValue)) { this.actionError.set('Ingresa un número telefónico chileno válido.'); return; }
    if (action === 'assign-person' && this.jointDelivery() && (!this.selectedSim() || !this.item() || !isSmartphoneDevice(this.item()!) || this.item()!.simAsociada)) { this.actionError.set('Selecciona una SIM disponible para este Smartphone.'); return; }
    if (action === 'assign-person' && this.jointDelivery() && !isChileanPhoneInputValid(deliveryPhoneValue)) { this.actionError.set('Ingresa un número telefónico chileno válido para la SIM.'); return; }
    if (action === 'assign-department' && (!value.departamentoId||!value.recibidoPorId)) { this.actionError.set('Selecciona el departamento y el colaborador que recibe.'); return; }
    if (action === 'state' && !value.estadoId) { this.actionError.set('Selecciona un estado.'); return; }
    if (action === 'state' && this.isReportingSmartphoneLost() && !value.accionLineaExtravio) { this.actionError.set('Indica qué hacer con la línea telefónica.'); return; }
    if (action === 'recover' && (!value.estadoId || !value.motivoRecuperacion.trim())) { this.actionError.set(!value.estadoId ? 'Selecciona el estado de recuperación.' : 'Ingresa el motivo de recuperación.'); return; }
    if (action === 'service' && this.technicalServiceActive()) { this.actionErrorTitle.set('No se pudo registrar el envío a servicio técnico'); this.actionError.set('El equipo ya se encuentra en servicio técnico.'); return; }
    if (action === 'service' && (!value.fechaEnvio || !isDateInputValue(value.fechaEnvio))) { this.actionErrorTitle.set('No se pudo registrar el envío a servicio técnico'); this.actionError.set('La fecha de envío es obligatoria y debe ser solo día.'); return; }
    if (action === 'service' && !value.proveedor.trim()) { this.actionErrorTitle.set('No se pudo registrar el envío a servicio técnico'); this.actionError.set('Falta proveedor, técnico o destino.'); return; }
    if (action === 'service' && !value.tipoServicio) { this.actionErrorTitle.set('No se pudo registrar el envío a servicio técnico'); this.actionError.set('Selecciona el tipo de servicio.'); return; }
    if (action === 'service' && !value.fallaReportada.trim()) { this.actionErrorTitle.set('No se pudo registrar el envío a servicio técnico'); this.actionError.set('Falta falla reportada.'); return; }
    if (action === 'retire' && !value.motivoBaja) { this.actionError.set('Selecciona el motivo de baja.'); return; }
    if (action === 'return' && !await this.confirmation.confirm('Se registrará la recepción y el equipo quedará retenido para revisión.', { title: 'Confirmar recepción', confirmLabel: 'Confirmar recepción' })) return;
    if (action === 'retire' && !await this.confirmation.confirm('El equipo será retirado del inventario y el motivo quedará guardado para revisión.', { title: 'Confirmar retiro', confirmLabel: 'Retirar del inventario', tone: 'danger' })) return;
    const target = this.states().find((state) => state.id === value.estadoId);
    if (action === 'state' && target?.esTerminal && !await this.confirmation.confirm(`El equipo cambiará a la situación “${target.nombre}”.`, { title: 'Confirmar cambio de situación', confirmLabel: 'Cambiar situación', tone: 'danger' })) return;
    if (action === 'state' && target?.codigo === 'EXTRAVIADO' && !await this.confirmation.confirm('Esta acción marcará el equipo como perdido y quedará registrada en su historial.', { title: 'Reportar equipo perdido', confirmLabel: 'Reportar', tone: 'danger' })) return;
    const common = { responsable: actor.nombre, observaciones: value.observaciones.trim() || null };
    let request: Observable<Dispositivo|OrdenServicio|ResultadoDevolucion>;
    if (action === 'assign-person') request = this.service.asignarColaborador(this.codigo, { ...common, colaboradorId: Number(value.colaboradorId), ...(deliveryPhoneValue && this.item() && isSmartphoneDevice(this.item()!) ? { numeroTelefonico: deliveryPhoneValue } : {}), ...(this.jointDelivery() && this.selectedSim() ? { simCodigoInventario: this.selectedSim()!.codigoInventario } : {}) });
    else if (action === 'assign-department') request = this.service.asignarDepartamento(this.codigo, { ...common, departamentoId: Number(value.departamentoId),recibidoPorId:Number(value.recibidoPorId), localidad: value.localidad.trim() || null, ubicacionDetalle: value.ubicacionDetalle.trim() || null });
    else if (action === 'return') request = this.service.devolver(this.codigo, common);
    else if(action==='service')request=this.technicalService.crear({dispositivoCodigo:this.codigo,proveedor:value.proveedor.trim()||null,areaSolicitante:value.areaSolicitante.trim()||this.item()?.departamento?.nombre||'Area TI - Aguas San Isidro',contactoServicio:value.contactoServicio.trim()||null,fechaEnvio:value.fechaEnvio||null,tipoServicio:value.tipoServicio as 'GARANTIA'|'REPARACION'|'MANTENCION'|'DIAGNOSTICO',fallaReportada:value.fallaReportada.trim(),accesoriosEntregados:value.accesoriosEntregados.trim()||null,observaciones:value.observaciones.trim()||null,responsable:actor.nombre});
    else if(action==='retire')request=this.service.darBaja(this.codigo,{...common,motivo:value.motivoBaja as import('../../core/models/itam.models').MotivoBaja});
    else request = this.service.cambiarEstado(this.codigo, { ...common, estadoId: Number(value.estadoId), ...(action === 'recover' ? { recuperar: true, motivoRecuperacion: value.motivoRecuperacion.trim() } : {}), ...(action === 'state' && this.isReportingSmartphoneLost() ? { accionLineaExtravio: value.accionLineaExtravio as import('../../core/models/itam.models').AccionLineaExtravio } : {}) });
    this.submitting.set(true); this.actionError.set(''); this.actionErrorTitle.set('');
    request.subscribe({
      next: (result) => {
        if(action==='service'&&'entregasTemporales' in result){
          const order=result;
          this.activeServiceOrder.set(order); this.action.set(null); this.submitting.set(false); this.showFeedback({type:'success',title:'Equipo enviado a servicio técnico',detail:'La orden de trabajo fue registrada correctamente y el PDF quedó disponible.'}); this.toast.success('Equipo enviado a servicio técnico','La orden de trabajo fue registrada correctamente y el PDF quedó disponible.'); this.load(); return;
          return;
        }
        this.action.set(null);
        this.submitting.set(false);
        if ('codigoInventario' in result && action === 'assign-person' && isSmartphoneDevice(result) && deliveryPhoneValue) {
          const savedNumber = smartphonePhoneValue(result) || normalizeChileanPhoneInput(deliveryPhoneValue);
          const simStatus = this.jointDelivery() ? 'SIM asociada correctamente' : 'SIM pendiente de asociar';
          this.showFeedback({
            type: 'success',
            title: 'Equipo entregado correctamente',
            detail: `Número telefónico guardado: ${savedNumber}. ${simStatus}.`
          });
          this.toast.success('Equipo entregado correctamente', `Número telefónico guardado: ${savedNumber}. ${simStatus}.`);
        } else {
          this.toast.success('Operación registrada', 'La ficha y el historial fueron actualizados.');
        }
        if('comprobante' in result){this.returnService.obtener(result.comprobante.id).subscribe({next:proof=>this.returnProof.set(proof),error:error=>this.toast.warning('Devolución registrada',`No fue posible abrir el comprobante: ${errorMessage(error)}`)});}
        else if('codigoInventario' in result&&(action==='assign-person'||action==='assign-department')){const updated=result;this.actasService.crear({colaboradorId:action==='assign-person'?Number(value.colaboradorId):null,departamentoId:action==='assign-department'?Number(value.departamentoId):null,recepcionanteId:action==='assign-department'?Number(value.recibidoPorId):null,localidad:value.localidad.trim()||updated.localidad,responsableTi:actor.nombre,observaciones:value.observaciones.trim()||null,dispositivosCodigos:[updated.codigoInventario]}).subscribe({next:acta=>this.createdActa.set(acta),error:error=>this.toast.warning('Asignación registrada',`No fue posible generar el acta: ${errorMessage(error)}`)});}
        this.load();
      },
      error: (error) => { this.actionErrorTitle.set(action==='service'?'No se pudo registrar el envío a servicio técnico':'No se pudo registrar la operación'); this.actionError.set(action==='service'?errorMessage(error):deviceActionErrorMessage(error)); this.submitting.set(false); }
    });
  }
}
