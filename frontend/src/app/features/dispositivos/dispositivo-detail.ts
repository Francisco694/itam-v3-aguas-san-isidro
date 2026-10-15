import { DatePipe } from '@angular/common';
import { Component, DestroyRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideBuilding, LucideCircleAlert, LucideDownload, LucideEye, LucideExternalLink, LucideFileText, LucideHistory, LucidePackageCheck, LucidePencil, LucidePlus, LucideRotateCcw, LucideShieldAlert, LucideShieldCheck, LucideUserCheck, LucideUsers, LucideWrench, LucideX } from '@lucide/angular';
import { catchError, combineLatest, forkJoin, map, Observable, of, switchMap } from 'rxjs';
import { ActaEntrega, CatalogoTecnico, Colaborador, ComprobanteDevolucion, Departamento, Dispositivo, Estado, HistorialEvento, LineaMovilLookup, LineaMovilResumen, OrdenServicio, RegistrarSimNuevaAccionLinea, ResultadoDevolucion, Sim, TrazabilidadDispositivo, ReemplazoDispositivo } from '../../core/models/itam.models';
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
import { CatalogoTecnicoService } from '../../core/services/catalogo-tecnico.service';
import { ReemplazosDispositivoService } from '../../core/services/reemplazos-dispositivo.service';
import { ComprobanteDevolucionPreview } from '../../shared/components/document-preview/comprobante-devolucion-preview';
import { AssetLabel, assetLabelResponsible } from '../../shared/components/asset-label/asset-label';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { ActaPreview } from '../../shared/components/acta-preview/acta-preview';
import { ApiError } from '../../core/models/api.models';
import { errorMessage } from '../../shared/utils/error-message';
import { formatClp } from '../../shared/utils/currency';
import { isCellularRouterDevice, isRouterType } from '../../core/utils/device-capabilities';

type ReplacementExistingLineChoice = 'CONSERVAR_NUMERO' | 'USAR_NUMERO_SIM' | 'NUMERO_NUEVO' | 'SIN_LINEA';

export const MAX_CATALOGO_TECNICO_BYTES = 10 * 1024 * 1024;


export const receiversForDepartment = (
  collaborators: readonly Colaborador[],
  departmentId: string
): Colaborador[] => departmentId
  ? collaborators.filter((person) => person.activo && person.departamento?.id === departmentId)
  : [];

const normalizeAutocompleteText = (value: string): string =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();

export const departmentMatchesQuery = (department: Departamento, query: string): boolean => {
  const normalizedQuery = normalizeAutocompleteText(query);
  return !!normalizedQuery && (
    normalizeAutocompleteText(department.nombre).includes(normalizedQuery)
    || department.id.toLocaleLowerCase('es').includes(normalizedQuery)
  );
};

export const isSmartphoneDevice = (device: Dispositivo): boolean =>
  device.tipo.nombre.trim().toLocaleLowerCase('es') === 'smartphone';

export const canDeviceCarrySim = (device: Pick<Dispositivo, 'tipo'>): boolean =>
  isRouterType(device.tipo)
    ? isCellularRouterDevice(device as Dispositivo)
    : device.tipo.permiteSim ?? device.tipo.configuracionFormulario?.permiteSim
      ?? isSmartphoneDevice(device as Dispositivo);

export interface DeviceTechnicalIdentifier {
  label: 'IMEI' | 'NÚMERO DE SERIE' | 'IDENTIFICADOR';
  value: string;
}

const normalizeTechnicalIdentifier = (value: string | null | undefined): string => {
  const normalized = value?.trim() || '';
  return normalized === '-' ? '' : normalized;
};

export const deviceTechnicalIdentifier = (
  device: { imei?: string | null; numeroSerie?: string | null },
): DeviceTechnicalIdentifier => {
  const imei = normalizeTechnicalIdentifier(device.imei);
  if (imei) return { label: 'IMEI', value: imei };

  const numeroSerie = normalizeTechnicalIdentifier(device.numeroSerie);
  if (numeroSerie) return { label: 'NÚMERO DE SERIE', value: numeroSerie };

  return { label: 'IDENTIFICADOR', value: 'Sin identificador registrado' };
};

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

export const latestTechnicalServiceOrder = (orders: readonly OrdenServicio[]): OrdenServicio | null =>
  [...orders].sort((left, right) => {
    const leftDate = Date.parse(left.actualizadoEn || left.fechaEnvio);
    const rightDate = Date.parse(right.actualizadoEn || right.fechaEnvio);
    return rightDate - leftDate || Number(right.id) - Number(left.id);
  })[0] ?? null;

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
    return error.message;
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
  const value = normalizeAutocompleteText(query);
  if (!value || !person.activo) return false;
  const rut = value.replace(/[.\s-]/g, '');
  return normalizeAutocompleteText(person.nombre).includes(value)
    || normalizeAutocompleteText(person.cargo || '').includes(value)
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

export type DeviceSimChange = 'KEEP' | 'NUMBER' | 'SIM' | 'BOTH';

export const deviceSimSearchMatches = (sims: readonly Sim[], query: string, limit = 8): Sim[] => {
  const value = query.trim().toLocaleLowerCase('es');
  if (!value) return [];
  const digits = value.replace(/\D/g, '');
  return sims.filter((sim) =>
    (digits && String(sim.codigoInventario).includes(digits))
    || (sim.iccidCodigoFabrica ?? '').toLocaleLowerCase('es').includes(value)
    || (sim.numeroAsociado ?? '').toLocaleLowerCase('es').includes(value)
  ).slice(0, limit);
};

export const deviceSimChangeLabel = (change: DeviceSimChange, hasCurrentSim: boolean): string => {
  if (change === 'NUMBER') return 'Actualizar número';
  if (change === 'SIM') return hasCurrentSim ? 'Cambiar SIM' : 'Asociar SIM';
  if (change === 'BOTH') return hasCurrentSim ? 'Cambiar número y SIM' : 'Registrar número y SIM';
  return 'Mantener configuración actual';
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
type AssignmentResolution = 'ADD' | 'REPLACE';

interface SimilarAssignedDevicePrompt {
  collaborator: Colaborador;
  devices: Dispositivo[];
}

@Component({
  selector: 'app-dispositivo-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, ReactiveFormsModule, RouterLink, PageHeader, StatusBadge, ViewState, ComprobanteDevolucionPreview, ActaPreview, AssetLabel, LucideBuilding, LucideCircleAlert, LucideDownload, LucideEye, LucideExternalLink, LucideFileText, LucideHistory, LucidePackageCheck, LucidePencil, LucidePlus, LucideRotateCcw, LucideShieldAlert, LucideShieldCheck, LucideUserCheck, LucideUsers, LucideWrench, LucideX],
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
      @if(pendingReplacement(); as pending){<section class="notice notice--warning replacement-pending-banner" role="status"><strong>Devoluci&oacute;n pendiente por reemplazo</strong><span>ITAM {{pending.dispositivoAnterior.codigoInventario}} contin&uacute;a bajo custodia. El nuevo equipo es ITAM {{pending.dispositivoNuevo.codigoInventario}}.</span></section>}
      <section class="device-banner">
        <div><span>EQUIPO TECNOLÓGICO</span><h2>{{ device.tipo.nombre }} · {{ device.marca || 'Sin marca' }} {{ device.modelo || '' }}</h2><p>{{ deviceTechnicalIdentifier(device).label }}: {{ deviceTechnicalIdentifier(device).value }}</p></div>
        <div><app-status-badge [code]="device.estado.codigo" [label]="device.estado.nombre" />@if (auth.user()?.rol !== 'SOLO_LECTURA') { <a class="btn btn--secondary btn--small" [routerLink]="['editar']"><svg lucidePencil></svg>Editar ficha</a> }</div>
      </section>
      <section class="traceability-overview" aria-label="Resumen de trazabilidad">
        <article class="traceability-card traceability-card--state"><span class="traceability-card__icon"><svg lucidePackageCheck></svg></span><div><small>ESTADO DEL EQUIPO</small><strong>{{ device.estado.nombre }}</strong><span>{{ terminal() ? 'Fuera de la operación normal' : 'Estado registrado actualmente' }}</span></div></article>
        <article class="traceability-card traceability-card--verification"><span class="traceability-card__icon"><svg lucideShieldCheck></svg></span><div><small>VERIFICACIÓN FÍSICA</small><strong>{{ verificationStatusLabel(device) }}</strong><span>{{ verificationSourceLabel(device) }}</span></div></article>
        <article class="traceability-card traceability-card--current"><span class="traceability-card__icon"><svg lucideUserCheck></svg></span><div><small>RESPONSABLE ACTUAL</small>@if(traceability()?.responsableActual;as current){<strong>En poder de {{current.nombre}}</strong><span>{{current.tipo==='COLABORADOR' ? ('RUT '+(current.rut||'no informado')) : 'Departamento responsable'}}</span>}@else{<strong>Sin responsable actual</strong><span>{{device.estado.codigo==='DISPONIBLE' ? 'Disponible para entregar' : 'No registra una entrega vigente'}}</span>}</div></article>
        <article class="traceability-card traceability-card--previous"><span class="traceability-card__icon"><svg lucideUsers></svg></span><div><small>ÚLTIMO RESPONSABLE CONOCIDO</small>@if(traceability()?.ultimoResponsableConocido;as previous){<strong>{{previous.nombre}}</strong><span>{{previous.tipo==='COLABORADOR' ? ('RUT '+(previous.rut||'no informado')) : 'Departamento'}} · {{previous.fechaUltimoMovimiento|date:'dd/MM/yyyy HH:mm'}} · {{originLabel(previous.origenDato)}}</span>}@else{<strong>Sin responsable conocido</strong><span>No existe evidencia histórica vinculada</span>}</div></article>
      </section>
      @for(alert of traceability()?.alertas || [];track alert){<div class="notice notice--warning traceability-alert"><svg lucideCircleAlert></svg><div><strong>{{ alert.includes('Asignado') ? 'Requiere revisión' : (device.estado.codigo==='EXTRAVIADO' ? 'Equipo perdido' : 'Equipo retirado del inventario') }}</strong><span>{{alert}}</span></div></div>}
      @if(activeServiceOrder(); as order){<section class="notice technical-service-card" role="status"><svg lucideWrench></svg><div><strong>Equipo en servicio técnico</strong><span>Este equipo está apartado del inventario operativo mientras se encuentra en revisión técnica.</span><dl><div><dt>Revisión N°</dt><dd>#{{order.id}}</dd></div><div><dt>Fecha de envío</dt><dd>{{serviceDateLabel(order.fechaEnvio)}}</dd></div><div><dt>Proveedor / técnico / destino</dt><dd>{{order.proveedor || 'No informado'}}</dd></div><div><dt>Falla reportada</dt><dd>{{order.fallaReportada}}</dd></div><div><dt>Estado de la revisión</dt><dd>{{technicalServiceStatusLabel(order.estado)}}</dd></div></dl><a class="btn btn--secondary btn--small" [routerLink]="['/servicio-tecnico']" [queryParams]="{orden: order.id}">Ver revisión técnica</a></div></section>}
      @if(latestServiceOrder(); as latest){<section class="technical-history"><header class="technical-history__header"><div class="technical-history__title"><span class="technical-history__icon"><svg lucideWrench></svg></span><div><small>SERVICIO TÉCNICO</small><h3>Historial de servicio técnico</h3><p>Última revisión registrada para este equipo.</p></div></div><a class="btn btn--secondary btn--small" [routerLink]="['/servicio-tecnico']" [queryParams]="{dispositivo: codigo}"><svg lucideHistory></svg>Ver historial completo</a></header><article class="technical-history__latest"><div class="technical-history__summary"><div class="technical-history__status"><span>{{technicalServiceStatusLabel(latest.estado)}}</span><strong>Revisión #{{latest.id}}</strong><small>{{serviceDateLabel(latest.fechaEnvio)}}</small></div><div class="technical-history__details"><div><small>PROVEEDOR</small><strong>{{latest.proveedor || 'No informado'}}</strong></div><div><small>FALLA REPORTADA</small><strong>{{latest.fallaReportada || 'No informada'}}</strong></div><div><small>COSTO COTIZADO / FINAL</small><strong>{{latest.montoCotizacion === null ? 'No informado' : clp(latest.montoCotizacion)}} / {{latest.costoFinal === null ? 'No informado' : clp(latest.costoFinal)}}</strong></div></div></div><div class="technical-history__costs"><div><div><span>Costo cotizado</span><strong>{{latest.montoCotizacion === null ? 'No informado' : clp(latest.montoCotizacion)}}</strong></div><div class="technical-history__bar"><span [style.width.%]="technicalCostPercent(latest.montoCotizacion, latest)"></span></div></div><div><div><span>Costo final</span><strong>{{latest.costoFinal === null ? 'No informado' : clp(latest.costoFinal)}}</strong></div><div class="technical-history__bar technical-history__bar--final"><span [style.width.%]="technicalCostPercent(latest.costoFinal, latest)"></span></div></div></div><a class="btn btn--primary btn--small" [routerLink]="['/servicio-tecnico']" [queryParams]="{orden: latest.id}"><svg lucideFileText></svg>Ver orden y cotización</a></article></section>}
      <section class="panoramic-card">
        <article class="panoramic-column details-column">
          <div class="column-title"><span>01</span><div><small>IDENTIFICACIÓN</small><h3>Detalles</h3></div></div>
          <div class="equipment-identity"><span>{{ device.tipo.nombre }}</span><strong>{{ device.marca || 'Sin marca' }}</strong><h4>{{ device.modelo || 'Modelo no registrado' }}</h4></div>
          <dl class="technical-list">
            <div><dt>Ubicación</dt><dd>{{ device.localidad || '—' }} {{ device.ubicacionDetalle || '' }}</dd></div>
            <div><dt>Código</dt><dd class="code">{{ device.codigoInventario }}</dd></div>
            <div><dt>Tipo</dt><dd>{{ device.tipo.nombre }}</dd></div>
            @if (isRouter(device.tipo)) {
              <div><dt>Número de serie</dt><dd class="code">{{ device.numeroSerie || '—' }}</dd></div>
              @if (isCellularRouter(device)) { <div><dt>IMEI</dt><dd class="code">{{ device.imei || '—' }}</dd></div> }
              <div><dt>Conectividad móvil</dt><dd>{{ isCellularRouter(device) ? 'Sí' : 'No' }}</dd></div>
            } @else {
              <div><dt>{{ deviceTechnicalIdentifier(device).label }}</dt><dd class="code">{{ deviceTechnicalIdentifier(device).value }}</dd></div>
            }
            @if (isSmartphone(device)) {
              <div><dt>Número telefónico</dt><dd>{{ smartphonePhoneText(device) }}</dd></div>
              <div><dt>SIM</dt><dd class="code" [style.color]="!device.simAsociada ? 'var(--warning)' : null">{{ device.simAsociada ? device.simAsociada.codigoInventario : 'Pendiente de asociar' }}</dd></div>
            }
            <div><dt>Valor del equipo</dt><dd>{{ clp(device.valorComercial) }}</dd></div>
            @for (field of device.tipo.configuracionFormulario.camposEspecificos; track field.clave) { @if (device.atributosEspecificos[field.clave] !== undefined) { <div><dt>{{ field.etiqueta }}</dt><dd>{{ device.atributosEspecificos[field.clave] }}</dd></div> } }
            <div><dt>Fecha de ingreso al inventario</dt><dd>{{ device.fechaIngresoInventario | date:'dd/MM/yyyy HH:mm:ss' }}</dd></div>
            <div><dt>Registrado en ITAM</dt><dd>{{ device.creadoEn | date:'dd/MM/yyyy HH:mm:ss' }}</dd></div>
          </dl>
          <section class="physical-label"><span>ETIQUETA FÍSICA</span><app-asset-label [code]="device.codigoInventario" [assetType]="device.tipo.nombre" [brandModel]="(device.marca || '') + (device.modelo ? ' ' + device.modelo : '')" [identifierLabel]="deviceTechnicalIdentifier(device).label" [identifier]="deviceTechnicalIdentifier(device).value" [responsible]="labelResponsible(device)" [phone]="labelPhone(device) || ''" [detail]="true" printLabel="Reimprimir etiqueta" /></section>
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
              @if (auth.user()?.rol !== 'SOLO_LECTURA') {
              <button type="button" [disabled]="terminal() || technicalServiceActive() || device.tipoCustodia!=='NONE'" (click)="open('assign-person')"><svg lucideUserCheck></svg><span>Entregar equipo<small>A un colaborador habilitado</small></span></button>
              @if((device.colaborador || device.departamento) && !terminal() && !technicalServiceActive()){<button type="button" class="operation-return" (click)="open('return')"><svg lucideRotateCcw></svg><span>Recibir en bodega<small>Registra recepción y revisión</small></span></button>}
              @if(!technicalServiceActive()){<button type="button" [disabled]="terminal()" (click)="openServiceOrder()"><svg lucideWrench></svg><span>Enviar a Servicio Técnico<small>Crear orden y bloquear movimientos</small></span></button>}
              <button type="button" [disabled]="!stateExists('EXTRAVIADO')" (click)="openState('EXTRAVIADO')"><svg lucideShieldAlert></svg><span>Reportar equipo perdido<small>Requiere confirmación</small></span></button>
              <button type="button" (click)="open('assign-department')" [disabled]="terminal() || technicalServiceActive() || device.tipoCustodia!=='NONE'"><svg lucideBuilding></svg><span>Entregar a departamento<small>Responsabilidad institucional</small></span></button>
              <button type="button" (click)="open('state')"><svg lucidePackageCheck></svg><span>Cambiar situación del equipo<small>Ver opciones disponibles</small></span></button>
              @if(canVerifyManually(device)){
                <button type="button" (click)="verifyManually()"><svg lucidePackageCheck></svg><span>Verificar equipo<small>Acción opcional de auditoría física</small></span></button>
              }
              @if(canCarrySim(device) && !terminal()){<button type="button" (click)="openSimAssociation()"><svg lucidePlus></svg><span>{{ lineActionCopy(device).title }}<small>{{ lineActionCopy(device).description }}</small></span></button>}
              @if(device.estado.codigo==='EXTRAVIADO' || device.estado.codigo==='DADO_BAJA'){<button type="button" (click)="open('recover')"><svg lucideRotateCcw></svg><span>Registrar equipo encontrado<small>Reactivar con trazabilidad</small></span></button>}
              }
              @if (catalogoTecnico(); as catalogo) {
                <div class="operation-document-group">
                  <a class="operation-document" [href]="catalogoArchivoUrl(device.codigoInventario)" target="_blank" rel="noopener"><svg lucideEye></svg><span>Ver catálogo técnico<small>{{ catalogo.nombreOriginal }}</small></span></a>
                  @if (auth.user()?.rol !== 'SOLO_LECTURA') {
                    <button type="button" class="operation-document-replace" [disabled]="catalogoSubiendo()" (click)="abrirCargaCatalogo()">Reemplazar PDF</button>
                  }
                </div>
              } @else {
                <button type="button" class="operation-document" [disabled]="auth.user()?.rol === 'SOLO_LECTURA' || catalogoSubiendo()" (click)="abrirCargaCatalogo()"><svg lucideFileText></svg><span>Adjuntar catálogo técnico<small>Sin catálogo técnico adjunto</small></span></button>
              }
              @if (catalogoError()) {
                <div class="catalogo-action-error" role="alert">{{ catalogoError() }}</div>
              }
              <input id="technical-catalog-upload" class="technical-catalog__input" type="file" accept="application/pdf,.pdf" [disabled]="catalogoSubiendo()" (change)="catalogoSeleccionado($event)" />
              @if (auth.user()?.rol !== 'SOLO_LECTURA') {
              <button type="button" class="operation-danger" [disabled]="!stateExists('DADO_BAJA')" (click)="open('retire')"><svg lucideCircleAlert></svg><span>Da de Baja<small>Motivo obligatorio</small></span></button>
              }
            </div>
          } @else if (auth.user()?.rol !== 'SOLO_LECTURA') {
            <form class="action-form" [formGroup]="actionForm" (ngSubmit)="execute()">
              @if(action()==='service'){<section class="technical-order-identity"><strong>Orden de Trabajo - Servicio Técnico</strong><span>Revisa los antecedentes del equipo antes de registrar el envío.</span><dl><div><dt>Código ITAM</dt><dd>{{device.codigoInventario}}</dd></div><div><dt>Tipo de equipo</dt><dd>{{device.tipo.nombre}}</dd></div><div><dt>Marca / modelo</dt><dd>{{device.marca || 'Sin marca'}} {{device.modelo || ''}}</dd></div><div><dt>IMEI / serie</dt><dd>{{device.imei || device.numeroSerie || 'No informado'}}</dd></div><div><dt>Usuario / área</dt><dd>{{device.colaborador?.nombre || device.departamento?.nombre || 'No informado'}}</dd></div></dl></section>}
              <header><div><small>OPERACIÓN EN CURSO</small><h4>{{ actionTitle() }}</h4></div><button class="icon-button" type="button" aria-label="Cancelar operación" [disabled]="submitting()" (click)="action.set(null)"><svg lucideX></svg></button></header>
              @if(actionError()){<div class="notice notice--error" role="alert"><strong>{{ actionErrorTitle() || 'No se pudo registrar la operación' }}</strong><span>{{ actionError() }}</span></div>}
              @if(action()==='return' && pendingReplacement(); as pending){<div class="notice notice--warning"><strong>Recibir equipo pendiente</strong><span>Se cerrará el reemplazo iniciado el {{pending.fechaInicio | date:'dd/MM/yyyy HH:mm'}}.</span></div><div class="field"><label for="replacement-return-state">Destino del dispositivo recibido *</label><select id="replacement-return-state" [value]="replacementStateId()" (change)="replacementStateId.set($any($event.target).value)"><option value="">Seleccionar destino</option>@for(state of replacementStates(); track state.id){<option [value]="state.id">{{state.nombre}}</option>}</select></div>@if(replacementRequiresBajaReason()){<div class="field"><label for="replacement-return-reason">Motivo de baja *</label><select id="replacement-return-reason" [value]="replacementBajaMotivo()" (change)="replacementBajaMotivo.set($any($event.target).value)"><option value="">Seleccionar motivo</option><option value="IRREPARABLE">Irreparable</option><option value="REPARACION_NO_CONVENIENTE">Reparación no conveniente</option><option value="MULTIPLES_REPARACIONES">Múltiples reparaciones</option><option value="OBSOLESCENCIA">Obsolescencia</option><option value="DANO_FISICO">Daño físico</option><option value="SIN_REPUESTOS">Sin repuestos</option><option value="OTRO">Otro</option></select></div>}
              }
              @if(action()==='return' && pendingReplacement() && item()?.simAsociada; as pendingSim){
                <section class="replacement-sim-receipt" role="group" aria-label="Resolución de SIM en recepción posterior">
                  <strong>El dispositivo tiene una SIM asociada.</strong>
                  <span>SIM ITAM {{ pendingSim.codigoInventario }} · ICCID {{ pendingSim.iccidCodigoFabrica || 'Pendiente de validación' }} · {{ pendingSim.compania || 'Sin compañía' }} · Número {{ pendingSim.lineaMovil?.numeroTelefonico || 'Sin número' }}</span>
                  <span>¿La SIM también fue entregada físicamente?</span>
                  <div class="assignment-warning__buttons"><button class="btn btn--secondary" type="button" [class.btn--primary]="pendingSimDelivered()===true" (click)="choosePendingSimDelivery(true)">Sí, recibir dispositivo y SIM</button><button class="btn btn--secondary" type="button" [class.btn--primary]="pendingSimDelivered()===false" (click)="choosePendingSimDelivery(false)">No, solo dispositivo</button></div>
                  @if(pendingSimDelivered()===true){<small>La SIM quedará DISPONIBLE, sin colaborador ni dispositivo. La línea y su número se conservarán asociados a la SIM.</small>}
                  @if(pendingSimDelivered()===false){<small>La SIM quedará ASIGNADA al colaborador, sin dispositivo instalado. La línea continuará asociada a la SIM.</small>}
                </section>
              }
              @if(action()==='assign-person'){
                <div class="assignment-workflow">
                @if(checkingAssignment()){<div class="notice notice--info" role="status">Consultando la custodia actual del colaborador...</div>}
                @if(similarAssignedDevices(); as duplicate){
                  @if(!assignmentResolution()){
                    <section class="assignment-type" role="group" aria-labelledby="assignment-type-title">
                      <strong id="assignment-type-title">TIPO DE ENTREGA</strong>
                      <span>{{duplicate.collaborator.nombre}} tiene {{duplicate.devices.length}} {{duplicate.devices.length === 1 ? 'equipo' : duplicate.devices.length + ' equipos'}} actualmente bajo custodia.</span>
                      <div class="assignment-warning__devices">@for(existing of duplicate.devices; track existing.codigoInventario){<span>ITAM {{existing.codigoInventario}} · {{existing.marca || 'Sin marca'}} {{existing.modelo || ''}} · {{existing.tipo.nombre}}</span>}</div>
                      <span>¿Cómo desea registrar esta entrega?</span>
                      <label class="radio-card"><input type="radio" name="assignment-resolution" [checked]="assignmentResolution()==='ADD'" (change)="chooseAddAssignment()" [disabled]="submitting()" /><span><strong>Agregar equipo</strong><small>El colaborador conservará todos sus equipos actuales.</small></span></label>
                      <label class="radio-card"><input type="radio" name="assignment-resolution" [checked]="assignmentResolution()==='REPLACE'" (change)="chooseReplaceAssignment()" [disabled]="submitting()" /><span><strong>Reemplazar equipo</strong><small>Se reemplazará uno de los dispositivos que ya tiene bajo custodia.</small></span></label>
                    </section>
                  }
                  @if(assignmentResolution()==='REPLACE' && replacementDevice(); as oldDevice){
                    <section class="replacement-confirmation" role="alert">
                      <div class="field replacement-device-field"><label for="replacement-device">Equipo que será reemplazado *</label><select id="replacement-device" [value]="replacementDevice()?.codigoInventario || ''" (change)="selectReplacementDevice($any($event.target).value, duplicate.devices)">@for(existing of duplicate.devices; track existing.codigoInventario){<option [value]="existing.codigoInventario">ITAM {{existing.codigoInventario}} · {{existing.marca || 'Sin marca'}} {{existing.modelo || ''}} · {{existing.tipo.nombre}}</option>}</select><button class="btn btn--link replacement-change-type" type="button" [disabled]="submitting()" (click)="changeAssignmentType()">Cambiar tipo de entrega</button></div>
                      <div class="replacement-new-sim-action">
                        <label class="checkbox-card replacement-new-sim-toggle"><input type="checkbox" [checked]="replacementSimAction()==='REGISTRAR_SIM_NUEVA'" (change)="toggleReplacementNewSim($any($event.target).checked)" [disabled]="submitting()" /><span><strong>Registrar SIM nueva</strong><small>Se creará solamente al confirmar la operación.</small></span></label>
                        @if(replacementSimAction()==='REGISTRAR_SIM_NUEVA'){
                          <div class="replacement-new-sim-form">
                            <div class="field"><label for="replacement-new-iccid">ICCID de la SIM nueva *</label><div class="inline-field"><input id="replacement-new-iccid" type="text" [value]="replacementNewIccid()" (input)="replacementNewIccidChanged($any($event.target).value)" [disabled]="submitting()" maxlength="32" /><button class="btn btn--secondary" type="button" (click)="checkReplacementNewIccid()" [disabled]="submitting() || replacementNewIccidStatus()==='checking'">{{replacementNewIccidStatus()==='checking' ? 'Comprobando…' : 'Comprobar ICCID'}}</button></div>
                              @if(replacementNewIccidStatus()==='available'){<small class="field-help">ICCID disponible. Se registrará durante la confirmación.</small>}
                              @if(replacementNewIccidStatus()==='existing' && replacementExistingSim(); as existingSim){<section class="replacement-existing-sim-card" role="group" aria-label="SIM encontrada"><strong>SIM ENCONTRADA</strong><span>ITAM SIM {{existingSim.codigoInventario}} · ICCID {{existingSim.iccidCodigoFabrica || 'Pendiente de validación'}}</span><span>Compañía: {{existingSim.compania || 'Sin compañía'}}</span><span>Estado: {{existingSim.estado.nombre}}</span><span>Línea asociada: {{replacementSimPhoneText(existingSim)}}</span>@if(replacementSimIsAvailable(existingSim)){<button class="btn btn--secondary" type="button" (click)="useExistingReplacementSim()">Utilizar esta SIM</button>} @else {<small class="field-help">No se puede utilizar esta SIM en este momento. {{replacementSimAvailability(existingSim)}}</small>}</section>}
                            </div>
                            @if(replacementNewIccidStatus() !== 'existing'){<div class="field"><label for="replacement-new-company">Compañía *</label><input id="replacement-new-company" type="text" [value]="replacementNewCompany()" (input)="replacementNewCompany.set($any($event.target).value); actionError.set('')" [disabled]="submitting()" maxlength="100" /></div>
                            <div class="field"><label for="replacement-new-observations">Observaciones</label><textarea id="replacement-new-observations" [value]="replacementNewObservations()" (input)="replacementNewObservations.set($any($event.target).value)" [disabled]="submitting()"></textarea></div>
                            <div class="field replacement-new-line-field"><label>Línea telefónica</label>@if(replacementCurrentPhone(oldDevice); as currentPhone){<small class="delivery-help">Número actual: <strong>{{replacementCurrentPhoneText(oldDevice)}}</strong></small>}<label><input type="radio" name="replacement-new-line" [checked]="replacementNewLine()==='CONSERVAR_NUMERO'" (click)="chooseReplacementNewLine(replacementNewLine()==='CONSERVAR_NUMERO' ? null : 'CONSERVAR_NUMERO')" [disabled]="submitting() || !replacementCurrentPhone(oldDevice)" /> Conservar número actual</label><label><input type="radio" name="replacement-new-line" [checked]="replacementNewLine()==='NUMERO_NUEVO'" (click)="chooseReplacementNewLine(replacementNewLine()==='NUMERO_NUEVO' ? null : 'NUMERO_NUEVO')" [disabled]="submitting()" /> Registrar número nuevo</label><label><input type="radio" name="replacement-new-line" [checked]="replacementNewLine()==='SIN_LINEA'" (click)="chooseReplacementNewLine(replacementNewLine()==='SIN_LINEA' ? null : 'SIN_LINEA')" [disabled]="submitting()" /> Sin línea</label>@if(replacementNewLine()==='CONSERVAR_NUMERO' && replacementCurrentPhone(oldDevice)){<small class="delivery-help">El número {{replacementCurrentPhoneText(oldDevice)}} se mantendrá y será asociado a la nueva SIM{{replacementNewCompany().trim() ? ' ' + replacementNewCompany().trim() : ''}}.</small>}</div>
                            @if(replacementNewLine()==='NUMERO_NUEVO'){<div class="field"><label for="replacement-new-phone">Número telefónico nuevo</label><input id="replacement-new-phone" type="tel" [value]="replacementNewPhone()" (input)="replacementNewPhone.set($any($event.target).value)" [disabled]="submitting()" placeholder="+56 9 1234 5678" /></div>}
                            }
                       </div>
                      }
                      </div>
                      <section class="replacement-old-sim-context" role="group" aria-label="SIM y línea del equipo anterior"><strong>SIM Y LÍNEA DEL EQUIPO ANTERIOR</strong>@if(oldDevice.simAsociada; as previousSim){<span>SIM ITAM {{previousSim.codigoInventario}} · ICCID {{previousSim.iccidCodigoFabrica || 'Pendiente de validación'}} · Compañía {{previousSim.compania || 'Sin compañía'}}</span>} @else {<span>SIM actual: Sin SIM asociada.</span>}<span>Número actual: {{replacementCurrentPhoneText(oldDevice) || 'Sin número asociado'}}</span></section>
                      @if(oldDevice.simAsociada; as oldSim){<div class="replacement-sim-resolution"><strong>Este dispositivo tiene una SIM asociada.</strong><span>SIM: ITAM {{oldSim.codigoInventario}} · ICCID {{oldSim.iccidCodigoFabrica || 'Pendiente de validación'}} · Número {{replacementCurrentPhoneText(oldDevice) || 'Sin número'}}</span><label><input type="radio" name="replacement-sim-action" [checked]="replacementSimAction()==='MOVER_SIM_ACTUAL'" (change)="chooseReplacementSimAction('MOVER_SIM_ACTUAL')" [disabled]="submitting() || replacementDelivered()===false" /> Mover SIM actual al dispositivo nuevo</label><label><input type="radio" name="replacement-sim-action" [checked]="replacementSimAction()==='USAR_SIM_EXISTENTE'" (change)="chooseReplacementSimAction('USAR_SIM_EXISTENTE')" [disabled]="submitting()" /> Utilizar otra SIM registrada</label><label><input type="radio" name="replacement-sim-action" [checked]="replacementSimAction()==='SIN_SIM'" (change)="chooseReplacementSimAction('SIN_SIM')" [disabled]="submitting()" /> Entregar dispositivo nuevo sin SIM</label></div>}
                      @if(oldDevice.simAsociada && !replacementSimAction()){<div class="notice notice--warning replacement-sim-required"><strong>Debes resolver la SIM antes de continuar.</strong><span>@if(replacementDelivered()===false){Como el equipo anterior no fue entregado, puedes utilizar otra SIM registrada o entregar el equipo nuevo sin SIM.}@else {Selecciona si moverás la SIM actual, utilizarás otra SIM o entregarás el equipo nuevo sin SIM.}</span></div>}
                      <section class="replacement-selected-sim" role="group" aria-label="SIM seleccionada">@if(replacementSimAction()==='USAR_SIM_EXISTENTE'){<select id="replacement-sim" [value]="replacementSimCode()" (change)="replacementSimCode.set($any($event.target).value); replacementExistingLineChoice.set(null); replacementKeepNumber.set(null)" [disabled]="submitting()"><option value="">Seleccionar SIM disponible</option>@for(candidate of replacementSims(); track candidate.id){<option [value]="candidate.codigoInventario">ITAM {{candidate.codigoInventario}} · ICCID {{candidate.iccidCodigoFabrica || 'Pendiente'}} · {{candidate.compania || 'Sin compañía'}} · {{replacementSimPhoneText(candidate)}}</option>}</select>}@if(replacementSimAction()==='USAR_SIM_EXISTENTE' && replacementSelectedSim(); as selectedSim){<strong>UTILIZAR SIM EXISTENTE</strong><span>ITAM SIM {{selectedSim.codigoInventario}} · ICCID {{selectedSim.iccidCodigoFabrica || 'Pendiente de validación'}}</span><span>Compañía: {{selectedSim.compania || 'Sin compañía'}} · Estado: {{selectedSim.estado.nombre}}</span><span>Línea asociada: {{replacementSimPhoneText(selectedSim)}}</span><button class="btn btn--link" type="button" (click)="changeExistingReplacementSim()">Cambiar SIM</button><div class="field replacement-existing-line-field"><label>Línea telefónica</label>@for(option of replacementExistingLineOptions(oldDevice); track option.value){<label><input type="radio" name="replacement-existing-line" [checked]="replacementExistingLineChoice()===option.value" (click)="chooseReplacementExistingLine(replacementExistingLineChoice()===option.value ? null : option.value)" [disabled]="submitting()" /> {{option.label}}</label>}@if(replacementExistingLineChoice()==='NUMERO_NUEVO'){<div class="field"><label for="replacement-existing-new-phone">Número telefónico nuevo</label><input id="replacement-existing-new-phone" type="tel" [value]="replacementNewPhone()" (input)="replacementNewPhone.set($any($event.target).value)" [disabled]="submitting()" placeholder="+56 9 1234 5678" /></div>} @if(replacementExistingLineWarning(oldDevice)){<small class="delivery-help">{{replacementExistingLineWarning(oldDevice)}}</small>}</div>}
                            </section>
                      <strong>{{ replacementDelivered()===false ? 'Confirmar reemplazo con devolución pendiente' : 'Confirmar reemplazo' }}</strong>
                      <div class="field replacement-delivery-question"><strong>¿El colaborador entregó físicamente el dispositivo anterior?</strong><div class="radio-card-group"><label class="radio-card"><input type="radio" name="replacement-delivery" [checked]="replacementDelivered()===true" (change)="chooseReplacementDelivery(true)" [disabled]="submitting()" /><span>Sí, lo entregó</span></label><label class="radio-card"><input type="radio" name="replacement-delivery" [checked]="replacementDelivered()===false" (change)="chooseReplacementDelivery(false)" [disabled]="submitting()" /><span>No, no lo entregó</span></label></div>@if(replacementDeliveryError()){<small class="field-error" role="alert">{{replacementDeliveryError()}}</small>}</div>
                      @if(replacementDelivered()===false){<div class="notice notice--warning"><strong>El dispositivo anterior no ha sido entregado.</strong><span>Continuará bajo responsabilidad del colaborador. Si continúa, el nuevo equipo será entregado y el anterior quedará pendiente de devolución.</span></div>}
                      @if(replacementDelivered()===true){<span>El equipo ITAM {{oldDevice.codigoInventario}} será recibido en bodega antes de entregar el nuevo equipo.</span>}

                      @if(replacementDelivered()===true){<div class="field"><label for="replacement-state">Estado del equipo recibido *</label><select id="replacement-state" [value]="replacementStateId()" (change)="replacementStateId.set($any($event.target).value)"><option value="">Seleccionar estado</option>@for(state of replacementStates(); track state.id){<option [value]="state.id">{{state.nombre}}</option>}</select><small class="delivery-help">Disponible, retenido para revisión o dado de baja.</small></div>}
                      @if(replacementDelivered()===true && replacementRequiresBajaReason()){<div class="field"><label for="replacement-baja-reason">Motivo de baja *</label><select id="replacement-baja-reason" [value]="replacementBajaMotivo()" (change)="replacementBajaMotivo.set($any($event.target).value)"><option value="">Seleccionar motivo</option><option value="IRREPARABLE">Irreparable</option><option value="REPARACION_NO_CONVENIENTE">Reparación no conveniente</option><option value="MULTIPLES_REPARACIONES">Múltiples reparaciones</option><option value="OBSOLESCENCIA">Obsolescencia</option><option value="DANO_FISICO">Daño físico</option><option value="SIN_REPUESTOS">Sin repuestos</option><option value="OTRO">Otro</option></select></div>}
                      @if(replacementDelivered() !== null){<section class="replacement-summary" aria-label="Resumen del reemplazo"><strong>Resumen del reemplazo</strong><span>Equipo anterior: ITAM {{oldDevice.codigoInventario}} · {{oldDevice.marca || 'Sin marca'}} {{oldDevice.modelo || ''}}</span><span>Equipo nuevo: ITAM {{item()?.codigoInventario}}</span><span>SIM: {{replacementSummarySim(oldDevice)}}</span><span>Línea: {{replacementSummaryLine(oldDevice)}}</span><span>Equipo anterior: {{replacementDelivered() ? 'Será recibido y enviado al destino seleccionado.' : 'Continuará bajo responsabilidad del colaborador y quedará pendiente de devolución.'}}</span></section>}
                      <div class="assignment-warning__buttons"><button class="btn btn--primary" type="button" [disabled]="submitting()" (click)="confirmReplacement()">{{ submitting() ? 'Registrando…' : (replacementDelivered()===false ? 'Confirmar reemplazo pendiente' : 'Confirmar reemplazo') }}</button><button class="btn btn--ghost" type="button" [disabled]="submitting()" (click)="cancelAssignmentDecision()">Cancelar operación</button></div>
                    </section>
                  }
                }
                </div>
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
                  @if(canCarrySim(device) && assignmentResolution()!=='REPLACE'){
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
              @if(action()==='assign-department'){
                <div class="notice notice--info">El equipo queda a cargo del departamento. La persona que lo recibe solo confirma que lo recibió.</div>
                <div class="field department-autocomplete department-autocomplete--department">
                  <label for="dept">Departamento *</label>
                  <input id="dept" type="search" autocomplete="off" placeholder="Buscar departamento..."
                    [value]="departmentQuery()" (input)="departmentQueryChanged($any($event.target).value)"
                    (focus)="departmentResultsOpen.set(true)" (keydown)="departmentKeydown($event)"
                    role="combobox" aria-autocomplete="list" aria-controls="department-results"
                    [attr.aria-expanded]="departmentResultsOpen()" [disabled]="submitting()" />
                  @if(departmentResultsOpen()){
                    <div id="department-results" class="department-autocomplete__results" role="listbox" aria-label="Departamentos">
                      @for(department of matchingDepartments(); track department.id; let index = $index){
                        <button type="button" class="department-autocomplete__option" role="option"
                          [id]="'department-option-' + index" [class.department-autocomplete__option--active]="index===departmentActiveIndex()"
                          [attr.aria-selected]="actionForm.controls.departamentoId.value===department.id"
                          (mouseenter)="departmentActiveIndex.set(index)" (click)="selectDepartment(department)">
                          <strong>{{department.nombre}}</strong><small>ID {{department.id}}</small>
                        </button>
                      } @empty {
                        @if(departmentQuery().trim()){<p class="department-autocomplete__empty">No se encontraron departamentos.</p>}
                      }
                    </div>
                  }
                  @if(departmentQuery().trim() && !actionForm.controls.departamentoId.value){<small class="field-error">Seleccione un departamento de los resultados.</small>}
                </div>
                <div class="field department-autocomplete department-autocomplete--receiver">
                  <label for="receiver">Colaborador que recibe *</label>
                  <input id="receiver" type="search" autocomplete="off" [value]="receiverQuery()"
                    (input)="receiverQueryChanged($any($event.target).value)"
                    (focus)="receiverResultsOpen.set(true)" (keydown)="receiverKeydown($event)"
                    [placeholder]="actionForm.controls.departamentoId.value ? 'Buscar por nombre, apellido o RUT...' : 'Seleccione primero un departamento'"
                    [disabled]="submitting() || !actionForm.controls.departamentoId.value"
                    role="combobox" aria-autocomplete="list" aria-controls="receiver-results"
                    [attr.aria-expanded]="receiverResultsOpen()" />
                  @if(receiverResultsOpen() && actionForm.controls.departamentoId.value){
                    <div id="receiver-results" class="department-autocomplete__results" role="listbox" aria-label="Colaboradores del departamento">
                      @for(person of matchingDepartmentReceivers(); track person.id; let index = $index){
                        <button type="button" class="department-autocomplete__option" role="option"
                          [id]="'receiver-option-' + index" [class.department-autocomplete__option--active]="index===receiverActiveIndex()"
                          [attr.aria-selected]="actionForm.controls.recibidoPorId.value===person.id"
                          (mouseenter)="receiverActiveIndex.set(index)" (click)="selectDepartmentReceiver(person)">
                          <strong>{{person.nombre}}</strong><small>{{person.rut}} · {{person.cargo || 'Sin cargo'}}</small>
                        </button>
                      } @empty {
                        @if(receiverQuery().trim()){<p class="department-autocomplete__empty">No se encontraron colaboradores activos en este departamento.</p>}
                      }
                    </div>
                  }
                  @if(receiverQuery().trim() && !actionForm.controls.recibidoPorId.value){<small class="field-error">Seleccione un colaborador de los resultados.</small>}
                </div>
                <div class="field"><label for="location">Localidad</label><input id="location" formControlName="localidad" maxlength="120" /></div>
                <div class="field"><label for="position">Ubicación</label><input id="position" formControlName="ubicacionDetalle" maxlength="250" /></div>
              }
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
              <div class="action-form__buttons"><button class="btn btn--ghost" type="button" (click)="action.set(null)">Cancelar</button><button class="btn btn--primary" type="submit" [disabled]="submitting()">{{ submitting() ? 'Procesando…' : (action()==='service' ? 'Registrar envío' : (action()==='assign-person' && assignmentResolution()==='ADD' && similarAssignedDevices() ? 'Agregar equipo' : (action()==='assign-person' && assignmentResolution()==='REPLACE' ? 'Confirmar reemplazo' : 'Confirmar operación'))) }}</button></div>
              @if(action()==='service'){<div class="form-grid"><div class="field"><label for="service-area">Área solicitante</label><input id="service-area" formControlName="areaSolicitante" maxlength="180" /></div><div class="field"><label for="service-contact">Contacto del servicio técnico</label><input id="service-contact" formControlName="contactoServicio" maxlength="180" /></div></div><div class="field"><label for="service-responsible">Responsable TI *</label><input id="service-responsible" formControlName="responsable" maxlength="150" /></div>}
            </form>
          }
          @if (auth.user()?.rol === 'SOLO_LECTURA') {
            <div class="notice notice--info">
              <strong>Perfil de solo lectura</strong>
              <span>Puede consultar el equipo y su trazabilidad, pero no modificar operaciones.</span>
            </div>
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
          <header><div><small>GESTIÓN LÍNEA / SIM</small><h2 id="sim-association-title">Gestionar línea / SIM</h2><p>La línea móvil es independiente de la tarjeta SIM física.</p></div><button class="icon-button" type="button" aria-label="Cerrar" [disabled]="submitting()" (click)="closeSimAssociation()"><svg lucideX></svg></button></header>
          @if(modalError(); as error){<div class="notice notice--error modal-save-error" role="alert"><strong>{{error.title}}</strong><span>{{error.detail}}</span></div>}
          <form novalidate (ngSubmit)="associateSim()">
            @if(submitting()){<div class="notice notice--info" role="status" aria-live="polite">Procesando cambio de línea / SIM…</div>}
            <section class="association-current-state">
              <h3>Configuración actual</h3>
              <div class="association-current-grid">
                <div><small>Número actual</small><strong>{{ item()?.lineaMovil?.numeroTelefonico || 'Sin línea asociada' }}</strong></div>
                <div><small>SIM actual</small><strong>{{ item()?.simAsociada ? ('ITAM ' + item()!.simAsociada!.codigoInventario + ' · ' + (item()!.simAsociada!.compania || 'Sin compañía')) : 'Sin SIM asociada' }}</strong><span>{{ item()?.simAsociada ? ('ICCID ' + (item()!.simAsociada!.iccidCodigoFabrica || 'Pendiente')) : 'No existe tarjeta instalada' }}</span></div>
              </div>
            </section>
            <section class="association-decision">
              <h3>¿Qué necesitas cambiar?</h3>
              @if(item()?.lineaMovil && item()?.simAsociada){<label><input type="radio" name="association-change" [checked]="associationChange()==='KEEP'" (change)="chooseAssociationChange('KEEP')" [disabled]="submitting()" /> Mantener configuración actual</label>}
              <label><input type="radio" name="association-change" [checked]="associationChange()==='NUMBER'" (change)="chooseAssociationChange('NUMBER')" [disabled]="submitting()" /> Cambiar número telefónico</label>
              <label><input type="radio" name="association-change" [checked]="associationChange()==='SIM'" (change)="chooseAssociationChange('SIM')" [disabled]="submitting()" /> {{ item()?.simAsociada ? 'Cambiar SIM' : 'Asociar SIM' }}</label>
              <label><input type="radio" name="association-change" [checked]="associationChange()==='BOTH'" (change)="chooseAssociationChange('BOTH')" [disabled]="submitting()" /> {{ item()?.simAsociada ? 'Cambiar número y SIM' : 'Registrar número y SIM' }}</label>
            </section>
            <div class="association-edit-grid">
            @if(associationChange()==='NUMBER' || associationChange()==='BOTH'){
              <section class="association-section">
                <h3>1. Nuevo número</h3>
                <label for="association-phone">Número telefónico</label>
                <input id="association-phone" type="tel" inputmode="tel" maxlength="20" placeholder="+56 9 9746 4529" [value]="associationNumber()" (input)="associationNumberChanged($any($event.target).value)" [disabled]="submitting()" required />
                <small class="hint">Busca el número oficial registrado en ITAM.</small>
                @if(associationLineState()==='checking'){<p class="association-lookup">Comprobando número oficial…</p>}
                @if(associationLineState()==='available'){<div class="association-context association-context--success">✓ Número disponible. Se puede registrar como nueva línea.</div>}
                @if(associationLineState()==='conflict' && !associationLineLookup()){<div class="association-context association-context--warning">Este número ya está en uso por otra asociación vigente. No se puede confirmar el cambio.</div>}
                @if(associationLineLookup(); as line){<div class="association-context" [class.association-context--warning]="associationLineState()==='conflict'"><strong>{{associationLineState()==='conflict' ? 'Número asociado a otro equipo' : ('Línea encontrada · ' + line.estado)}}</strong><span>{{line.numeroTelefonico}}</span><span>SIM {{line.sim ? ('ITAM ' + line.sim.codigoInventario + (line.sim.compania ? (' · ' + line.sim.compania) : '')) : 'Sin SIM'}}</span>@if(line.dispositivo){<span>Equipo ITAM {{line.dispositivo.codigoInventario}}</span>}@if(line.colaborador){<span>{{line.colaborador.nombre}}{{line.departamento ? (' · ' + line.departamento.nombre) : ''}}</span>}@if(associationLineState()==='conflict'){<strong class="association-conflict">No se trasladará silenciosamente.</strong>}</div>}
                @if(associationNumber() && !isPhoneValid(associationNumber())){<small class="field-error" role="alert">Ingrese 9 dígitos o formato 56XXXXXXXXX.</small>}
              </section>
            }
            @if(associationChange()==='SIM' || associationChange()==='BOTH'){
              <section class="association-section">
                <h3>{{ associationChange()==='BOTH' ? '2.' : '1.' }} SIM física</h3>
                <div class="association-sim-control">
                  <label for="association-sim-search">Buscar SIM por código ITAM o ICCID</label>
                  <input id="association-sim-search" type="search" autocomplete="off" placeholder="ITAM 2041 o 895603…" [value]="associationSimQuery()" (input)="associationSimSearchChanged($any($event.target).value)" [disabled]="submitting()" />
                  @if(simLoading()){<p class="association-lookup">Cargando SIM disponibles…</p>}
                  @if(associationSelectedSim(); as selected){<div class="association-selected"><div><small>SIM seleccionada · {{selected.estado.nombre}}</small><strong>ITAM {{selected.codigoInventario}} · {{selected.compania || 'Sin compañía'}}</strong><span>ICCID {{selected.iccidCodigoFabrica || 'Pendiente'}}{{selected.lineaMovil?.numeroTelefonico ? (' · Línea ' + selected.lineaMovil!.numeroTelefonico) : ''}}{{selected.dispositivo ? (' · Equipo ITAM ' + selected.dispositivo.codigoInventario) : ''}}</span></div><button type="button" class="btn btn--ghost btn--small" (click)="clearAssociationSim()" [disabled]="submitting()">Cambiar</button></div>}
                  @if(!associationSelectedSim() && associationSimResults().length){<div class="association-sim-results" role="listbox">@for(candidate of associationSimResults();track candidate.id){<div class="association-sim-result" [class.association-sim-result--blocked]="!isSimSelectableForAssociation(candidate)"><div><strong>ITAM {{candidate.codigoInventario}} · {{candidate.compania || 'Sin compañía'}}</strong><span>ICCID {{candidate.iccidCodigoFabrica || 'Pendiente'}}</span><span>{{candidate.estado.nombre}}{{candidate.lineaMovil?.numeroTelefonico ? (' · Línea ' + candidate.lineaMovil!.numeroTelefonico) : ''}}{{candidate.dispositivo ? (' · Equipo ITAM ' + candidate.dispositivo.codigoInventario) : ''}}</span></div>@if(isSimSelectableForAssociation(candidate)){<button type="button" class="btn btn--secondary btn--small" (click)="selectAssociationSim(candidate)">Usar esta SIM</button>}@else{<span>⚠ SIM actualmente asignada</span>}</div>}</div>}
                  @if(associationSimQuery() && !associationSelectedSim() && !associationSimResults().length && isValidIccidValue(associationSimQuery())){<div class="association-context association-context--success"><strong>SIM no registrada en ITAM</strong><span>ICCID {{normalizeIccidValue(associationSimQuery())}}</span><button type="button" class="btn btn--secondary btn--small" (click)="startAssociationInlineRegistration()">+ Registrar esta SIM</button></div>}
                </div>
                @if(associationInlineRegistration()){<div class="association-inline-registration"><h4>Registrar nueva SIM</h4><label for="association-new-iccid">ICCID *</label><input id="association-new-iccid" type="text" maxlength="24" [value]="associationNewIccid()" (input)="associationNewIccid.set($any($event.target).value)" [disabled]="submitting()" /><label for="association-new-company">Compañía *</label><select id="association-new-company" [value]="associationNewCompany()" (change)="associationNewCompany.set($any($event.target).value)" [disabled]="submitting()"><option value="">Seleccionar compañía</option><option>Claro</option><option>Entel</option><option>Movistar</option><option>WOM</option><option>Otro</option></select>@if(associationNewCompany()==='Otro'){<label for="association-other-company">Especifique compañía</label><input id="association-other-company" type="text" [value]="associationOtherCompany()" (input)="associationOtherCompany.set($any($event.target).value)" [disabled]="submitting()" />}<label for="association-new-observations">Observaciones</label><textarea id="association-new-observations" rows="2" [value]="associationNewObservations()" (input)="associationNewObservations.set($any($event.target).value)" [disabled]="submitting()"></textarea><small>Código ITAM: se generará automáticamente.</small></div>}
              </section>
            }
            </div>
            @if(associationChange()!=='KEEP'){
              <section class="association-result"><h3>RESULTADO DEL CAMBIO</h3><div><small>EQUIPO</small><strong>ITAM {{item()?.codigoInventario}} · {{item()?.marca || 'Sin marca'}} {{item()?.modelo || ''}}</strong></div><div><small>NÚMERO</small><span>{{item()?.lineaMovil?.numeroTelefonico || 'Sin línea'}}{{associationNumber() && isPhoneValid(associationNumber()) ? (' → ' + normalizePhone(associationNumber())) : ''}}</span></div><div><small>SIM</small><span>{{item()?.simAsociada ? ('ITAM ' + item()!.simAsociada!.codigoInventario) : 'Sin SIM'}}{{associationInlineRegistration() ? (' → Nueva SIM · ' + (associationNewCompany() === 'Otro' ? (associationOtherCompany() || 'Otra compañía') : (associationNewCompany() || 'Compañía pendiente'))) : associationSelectedSim() ? (' → ITAM ' + associationSelectedSim()!.codigoInventario + ' · ' + (associationSelectedSim()!.compania || 'Sin compañía')) : ''}}</span>@if(associationInlineRegistration() && associationNewIccid()){<span>ICCID {{normalizeIccidValue(associationNewIccid())}}</span>}</div>@if(associationLineState()==='conflict' && associationLineLookup()?.dispositivo){<div class="association-context association-context--warning">EQUIPO ORIGEN DE LA LÍNEA: ITAM {{associationLineLookup()!.dispositivo!.codigoInventario}}. Debes utilizar otro número.</div>}</section>
            }
            <footer><button class="btn btn--ghost" type="button" [disabled]="submitting()" (click)="closeSimAssociation()">Cancelar</button><button class="btn btn--primary" type="submit" [disabled]="!canSubmitAssociation()">{{submitting() ? 'Procesando…' : associationSubmitLabel()}}</button></footer>
          </form>
        </section>
      </div>
    }
  `,
  styleUrl: './dispositivo-detail.scss',
  styles: [`
    .invoice-document{align-items:center;background:var(--gray-50);border:1px solid var(--gray-200);border-radius:.7rem;display:flex;flex-wrap:wrap;gap:.6rem;margin-top:.8rem;padding:.7rem}.invoice-document>span{align-items:center;color:var(--slate-500);display:flex;font-size:.74rem;gap:.45rem;margin-right:auto}.invoice-document>span svg{color:var(--blue);height:1rem;width:1rem}.device-feedback{align-items:flex-start;display:flex;gap:.75rem;justify-content:space-between;margin-bottom:1rem;position:relative;z-index:1}.device-feedback div,.modal-save-error{display:grid;gap:.25rem}.device-feedback span,.modal-save-error span{display:block}
    .assignment-warning,.replacement-confirmation{background:#fff7ed;border:1px solid #fed7aa;border-radius:.85rem;display:grid;gap:.65rem;margin-bottom:1rem;padding:1rem}.assignment-warning>strong,.replacement-confirmation>strong{color:#9a3412;font-size:.82rem}.assignment-warning>span,.replacement-confirmation>span{color:#7c2d12;font-size:.72rem;line-height:1.45}.assignment-warning__devices{display:grid;gap:.3rem}.assignment-warning__devices span{background:#ffedd5;border-radius:.45rem;color:#7c2d12;font-size:.68rem;padding:.45rem .6rem}.assignment-warning__buttons{display:flex;flex-wrap:wrap;gap:.55rem}.replacement-confirmation{background:#eff6ff;border-color:#bfdbfe}.replacement-confirmation>strong{color:#1d4ed8}.replacement-confirmation>span{color:#1e3a8a}.replacement-confirmation .field{margin-top:.15rem}.replacement-sim-resolution{background:#fff;border:1px solid #bfdbfe;border-radius:.65rem;display:grid;gap:.45rem;padding:.75rem}.replacement-sim-resolution>span{color:#1e3a8a;font-size:.72rem}
    .sim-association-dialog{max-height:calc(100vh - 2rem);max-width:46rem;overflow:auto}.sim-association-dialog header p{color:var(--slate-500);font-size:.72rem;margin:.25rem 0 0}.association-current-state,.association-decision,.association-section,.association-result{border-top:1px solid var(--gray-200);display:grid;gap:.55rem;margin-top:1rem;padding-top:1rem}.association-current-state h3,.association-decision h3,.association-section h3,.association-result h3{font-size:.86rem;margin:0}.association-current-grid{display:grid;gap:.6rem;grid-template-columns:repeat(2,minmax(0,1fr))}.association-current-grid>div,.association-selected,.association-context,.association-result{background:#f8fafc;border:1px solid var(--gray-200);border-radius:.65rem;padding:.7rem}.association-current-grid small,.association-result small{color:var(--blue);display:block;font-size:.58rem;font-weight:850;letter-spacing:.06em;text-transform:uppercase}.association-current-grid strong,.association-current-grid span,.association-result span{display:block;font-size:.72rem;margin-top:.2rem;overflow-wrap:anywhere}.association-current-grid span,.association-result span{color:var(--slate-500)}.association-decision{gap:.4rem}.association-decision label{align-items:center;display:flex;font-size:.74rem;gap:.45rem}.association-section .hint{color:var(--slate-500);font-size:.66rem}.association-lookup{color:var(--slate-500);font-size:.68rem;margin:0}.association-context{display:grid;gap:.2rem;font-size:.7rem}.association-context--success{background:#f0fdf4;border-color:#bbf7d0;color:#166534}.association-context--warning{background:#fff7ed;border-color:#fed7aa;color:#9a3412}.association-conflict{color:#b91c1c}.association-sim-results{display:grid;gap:.45rem;max-height:14rem;overflow:auto}.association-sim-result{align-items:center;background:#f8fafc;border:1px solid var(--gray-200);border-radius:.65rem;display:flex;gap:.7rem;justify-content:space-between;padding:.65rem}.association-sim-result>div{display:grid;gap:.14rem;min-width:0}.association-sim-result strong{font-size:.74rem}.association-sim-result span{color:var(--slate-500);font-size:.66rem}.association-sim-result--blocked{background:#fff7ed;border-color:#fed7aa}.association-sim-result--blocked>span{color:#b45309;font-size:.64rem;text-align:right}.association-selected{align-items:center;display:flex;justify-content:space-between}.association-selected>div{display:grid;gap:.14rem}.association-selected small{color:var(--blue);font-size:.58rem;font-weight:850}.association-selected strong{font-size:.74rem}.association-selected span{color:var(--slate-500);font-size:.66rem}.association-inline-registration{background:#eff6ff;border:1px solid #bfdbfe;border-radius:.65rem;display:grid;gap:.45rem;padding:.75rem}.association-inline-registration h4{font-size:.78rem;margin:0}.association-result{grid-template-columns:repeat(3,minmax(0,1fr))}.association-result>div{display:grid;gap:.15rem;min-width:0}.association-result>h3{grid-column:1/-1}.association-result .association-context{grid-column:1/-1}.association-result strong{font-size:.72rem;overflow-wrap:anywhere}.association-result span{font-size:.66rem}.association-section input:not([type=radio]),.association-section select,.association-inline-registration input,.association-inline-registration select{width:100%}
    .association-edit-grid{display:grid;gap:.65rem;grid-template-columns:repeat(2,minmax(0,1fr))}.association-edit-grid>.association-section:only-child{grid-column:1/-1}.association-current-state,.association-decision,.association-section,.association-result{gap:.4rem;margin-top:.65rem;padding-top:.65rem}.association-current-grid>div,.association-selected,.association-context,.association-result{padding:.55rem}.association-sim-results{gap:.3rem;max-height:11rem}.association-sim-result{gap:.5rem;padding:.45rem .55rem}.association-sim-result>div{gap:.08rem}.association-sim-result span{font-size:.62rem}.association-selected{padding:.5rem .55rem}.association-inline-registration{gap:.35rem;padding:.6rem}.association-inline-registration textarea{min-height:3rem}.association-result{gap:.35rem;padding:.55rem}.association-result>div{gap:.1rem}.association-section input:not([type=radio]),.association-section select,.association-inline-registration input,.association-inline-registration select,.association-inline-registration textarea{width:100%}
    .sim-association-dialog{max-width:760px;padding:1rem}.sim-association-dialog form{gap:16px;margin-top:.75rem}.association-current-state{margin-top:0;padding-top:0}.association-current-grid{align-items:stretch;gap:10px}.association-current-grid>div{min-height:58px;padding:10px}.association-decision{display:grid;gap:6px;grid-template-columns:repeat(4,minmax(0,1fr));padding-top:16px}.association-decision h3{grid-column:1/-1}.association-decision label{background:#f8fafc;border:1px solid var(--gray-200);border-radius:.55rem;font-size:.68rem;min-height:34px;padding:5px 7px}.association-edit-grid{align-items:start;gap:16px;grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.association-section{border:1px solid var(--gray-200);border-radius:.7rem;margin:0;min-width:0;padding:12px}.association-section h3{margin-bottom:2px}.association-section>label,.association-inline-registration>label,.association-sim-control>label{font-size:.68rem}.association-section input:not([type=radio]),.association-section select,.association-inline-registration input,.association-inline-registration select,.association-inline-registration textarea{box-sizing:border-box;line-height:1.2;min-height:42px;padding:9px 10px}.association-sim-control{display:grid;gap:6px;position:relative}.association-sim-results{background:#fff;border:1px solid var(--gray-300);border-radius:.65rem;box-shadow:0 8px 22px #0f17241f;left:0;max-height:220px;overflow-y:auto;position:absolute;right:0;top:4.45rem;z-index:20}.association-sim-result{min-height:54px;padding:8px 10px}.association-sim-result>div{gap:2px}.association-selected{min-height:54px}.association-result{gap:10px;grid-template-columns:1fr 1fr;margin-top:0;padding:10px}.association-result>h3,.association-result>div:first-of-type,.association-result .association-context{grid-column:1/-1}.association-result>div{padding:0}.sim-association-dialog footer{border-top:1px solid var(--gray-200);margin-top:0;padding-top:12px}.sim-association-dialog footer .btn{min-height:40px}
    @media(max-width:900px) and (min-width:701px){.association-decision{grid-template-columns:repeat(2,minmax(0,1fr))}}
    @media(max-width:700px){.association-current-grid,.association-result,.association-edit-grid{grid-template-columns:1fr}.association-decision{grid-template-columns:1fr}.association-sim-result{align-items:flex-start;flex-direction:column}.association-sim-result--blocked>span{text-align:left}.sim-association-dialog{max-height:calc(100vh - 1rem);padding:.85rem}}
    .traceability-overview { background: transparent; border: 0; display: grid; gap: .75rem; grid-template-columns: repeat(4, minmax(0, 1fr)); padding: .75rem 0; }
    .traceability-card { align-items: flex-start; background: #fff; border: 1px solid var(--gray-200); border-radius: .85rem; box-shadow: var(--shadow-sm); display: flex; gap: .7rem; min-width: 0; padding: .95rem; }
    .traceability-overview .traceability-card + .traceability-card { border-left: 1px solid var(--gray-200); }
    .traceability-card > div { display: grid; gap: .24rem; min-width: 0; }
    .traceability-card__icon { align-items: center; background: var(--cyan-soft); border-radius: .65rem; color: var(--blue); display: flex; flex: 0 0 2rem; height: 2rem; justify-content: center; width: 2rem; }
    .traceability-card__icon svg { height: 1rem; width: 1rem; }
    .traceability-card--verification .traceability-card__icon { background: #ecfdf5; color: #15803d; }
    .traceability-card--current .traceability-card__icon { background: #eff6ff; color: #1d4ed8; }
    .traceability-card--previous .traceability-card__icon { background: #f8fafc; color: #475569; }
    .traceability-card small { color: var(--blue); font-size: .55rem; font-weight: 850; letter-spacing: .09em; }
    .traceability-card strong { font-size: .78rem; overflow-wrap: anywhere; }
    .traceability-card span:not(.traceability-card__icon) { color: var(--slate-500); font-size: .64rem; overflow-wrap: anywhere; }
    .technical-history { background: #fff; border: 1px solid var(--gray-200); border-radius: var(--radius-xl); box-shadow: var(--shadow-md); margin: .5rem 0 1rem; padding: 1.25rem 1.35rem; }
    .technical-history__header { align-items: flex-start; display: flex; gap: 1rem; justify-content: space-between; }
    .technical-history__title { align-items: flex-start; display: flex; gap: .7rem; }
    .technical-history__title > div { display: grid; gap: .2rem; }
    .technical-history__title small { color: var(--blue); font-size: .56rem; font-weight: 850; letter-spacing: .12em; }
    .technical-history__title h3 { font-size: 1.05rem; margin: 0; }
    .technical-history__title p { color: var(--slate-500); font-size: .7rem; margin: 0; }
    .technical-history__icon { align-items: center; background: #eff6ff; border-radius: .7rem; color: var(--blue); display: flex; height: 2.35rem; justify-content: center; width: 2.35rem; }
    .technical-history__icon svg { height: 1.1rem; width: 1.1rem; }
    .technical-history__latest { background: #f8fbff; border: 1px solid #dbeafe; border-radius: .9rem; display: grid; gap: 1rem; margin-top: 1rem; padding: 1rem; }
    .technical-history__summary { display: grid; gap: 1rem; grid-template-columns: minmax(13rem, .8fr) minmax(0, 2fr); }
    .technical-history__status { align-items: center; display: flex; flex-wrap: wrap; gap: .55rem .8rem; }
    .technical-history__status span { background: #dcfce7; border-radius: 999px; color: #166534; font-size: .63rem; font-weight: 800; padding: .35rem .6rem; }
    .technical-history__status strong { color: var(--navy); font-size: .95rem; }
    .technical-history__status small { color: var(--slate-500); font-size: .68rem; }
    .technical-history__details { display: grid; gap: .65rem; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .technical-history__details > div { border-left: 2px solid #bfdbfe; display: grid; gap: .2rem; min-width: 0; padding-left: .7rem; }
    .technical-history__details small, .technical-history__costs span { color: var(--slate-500); font-size: .56rem; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
    .technical-history__details strong { font-size: .72rem; overflow-wrap: anywhere; }
    .technical-history__costs { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .technical-history__costs > div > div:first-child { align-items: center; display: flex; justify-content: space-between; margin-bottom: .35rem; }
    .technical-history__costs strong { color: var(--navy); font-size: .75rem; }
    .technical-history__bar { background: #dbeafe; border-radius: 999px; height: .45rem; overflow: hidden; }
    .technical-history__bar span { background: #60a5fa; border-radius: inherit; display: block; height: 100%; min-width: 0; transition: width .2s ease; }
    .technical-history__bar--final { background: #dcfce7; }
    .technical-history__bar--final span { background: #22c55e; }
    @media (max-width: 1100px) { .traceability-overview { grid-template-columns: repeat(2, minmax(0, 1fr)); } .technical-history__summary { grid-template-columns: 1fr; } }
    @media (max-width: 760px) { .traceability-overview { grid-template-columns: 1fr; } .technical-history { padding: 1rem; } .technical-history__header { flex-direction: column; } .technical-history__header .btn { width: 100%; } .technical-history__details, .technical-history__costs { grid-template-columns: 1fr; } }
  `]
})
export class DispositivoDetail implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly simService = inject(SimService);
  protected readonly collaboratorQuery = signal('');
  protected readonly selectedCollaborator = signal<Colaborador | null>(null);
  protected readonly similarAssignedDevices = signal<SimilarAssignedDevicePrompt | null>(null);
  protected readonly assignmentResolution = signal<AssignmentResolution | null>(null);
  protected readonly replacementDevice = signal<Dispositivo | null>(null);
  protected readonly replacementStateId = signal('');
  protected readonly replacementBajaMotivo = signal('');
  protected readonly checkingAssignment = signal(false);
  protected readonly replacementConfirmed = signal(false);
  protected readonly replacementDelivered = signal<boolean | null>(null);
  protected readonly replacementDeliveryError = signal('');
  protected readonly pendingSimDelivered = signal<boolean | null>(null);
  protected readonly replacementSimAction = signal<'MOVER_SIM_ACTUAL' | 'USAR_SIM_EXISTENTE' | 'REGISTRAR_SIM_NUEVA' | 'SIN_SIM' | null>(null);
  protected readonly replacementSimCode = signal('');
  protected readonly replacementSims = signal<Sim[]>([]);
  protected readonly replacementKeepNumber = signal<boolean | null>(null);
  protected readonly replacementNewIccid = signal('');
  protected readonly replacementNewCompany = signal('');
  protected readonly replacementNewObservations = signal('');
  protected readonly replacementNewLine = signal<'CONSERVAR_NUMERO' | 'NUMERO_NUEVO' | 'SIN_LINEA' | null>(null);
  protected readonly replacementNewPhone = signal('');
  protected readonly replacementNewIccidStatus = signal<'idle' | 'checking' | 'available' | 'existing' | 'error'>('idle');
  protected readonly replacementExistingSim = signal<Sim | null>(null);
  protected readonly replacementExistingLineChoice = signal<ReplacementExistingLineChoice | null>(null);
  protected readonly jointDelivery = signal(false);
  protected readonly simQuery = signal('');
  protected readonly selectedSim = signal<Sim | null>(null);
  protected readonly deliverySims = signal<Sim[]>([]);
  protected readonly deliveryPhone = signal('');
  protected readonly associationSims = signal<Sim[]>([]);
  protected readonly simAssociationOpen = signal(false);
  protected readonly simLoading = signal(false);
  protected readonly simError = signal('');
  protected readonly modalError = signal<ModalErrorMessage | null>(null);
  protected readonly associationChange = signal<DeviceSimChange>('KEEP');
  protected readonly associationNumber = signal('');
  protected readonly associationLineLookup = signal<LineaMovilLookup | null>(null);
  protected readonly associationLineState = signal<'idle' | 'checking' | 'available' | 'found' | 'conflict'>('idle');
  protected readonly associationSimQuery = signal('');
  protected readonly associationSelectedSim = signal<Sim | null>(null);
  protected readonly associationInlineRegistration = signal(false);
  protected readonly associationNewIccid = signal('');
  protected readonly associationNewCompany = signal('');
  protected readonly associationOtherCompany = signal('');
  protected readonly associationNewObservations = signal('');
  private associationLookupTimer?: ReturnType<typeof setTimeout>;
  protected readonly feedback = signal<FeedbackMessage | null>(null);
  private feedbackTimer?: number;
  protected matchingCollaborators(): Colaborador[] { return this.collaborators().filter(person => collaboratorMatchesQuery(person, this.collaboratorQuery())); }
  protected searchCollaborator(query: string): void {
    this.collaboratorQuery.set(query);
    this.selectedCollaborator.set(null);
    this.actionForm.controls.colaboradorId.setValue('');
    this.resetAssignmentDecision();
  }
  protected selectCollaborator(person: Colaborador): void {
    this.selectedCollaborator.set(person);
    this.collaboratorQuery.set(person.nombre);
    this.actionForm.controls.colaboradorId.setValue(person.id);
    this.resetAssignmentDecision();
    this.checkForSimilarAssignment(Number(person.id));
  }
  protected replacementStates(): Estado[] {
    const allowed = new Set(['DISPONIBLE', 'RETENIDO_REVISION', 'DADO_BAJA']);
    return this.states().filter(state => allowed.has(state.codigo));
  }
  protected replacementStateName(): string {
    return this.replacementStates().find(state => state.id === this.replacementStateId())?.nombre || 'Seleccionar estado';
  }
  protected replacementRequiresBajaReason(): boolean {
    return this.replacementStates().find(state => state.id === this.replacementStateId())?.codigo === 'DADO_BAJA';
  }
  protected chooseAddAssignment(): void {
    this.assignmentResolution.set('ADD');
    this.replacementDevice.set(null);
    this.replacementStateId.set('');
    this.replacementBajaMotivo.set('');
    this.replacementConfirmed.set(false);
    this.replacementDelivered.set(null);
    this.replacementDeliveryError.set('');
    this.replacementSimAction.set(null);
    this.replacementSimCode.set('');
    this.replacementKeepNumber.set(null);
    this.replacementExistingLineChoice.set(null);
    this.resetReplacementNewSim();
    this.actionError.set('');
  }
  protected chooseReplaceAssignment(): void {
    const prompt = this.similarAssignedDevices();
    if (!prompt?.devices.length) return;
    this.assignmentResolution.set('REPLACE');
    this.replacementDevice.set(prompt.devices[0]);
    this.replacementStateId.set('');
    this.replacementBajaMotivo.set('');
    this.replacementConfirmed.set(false);
    this.replacementDelivered.set(null);
    this.replacementSimAction.set(null);
    this.replacementSimCode.set('');
    this.replacementKeepNumber.set(null);
    this.resetReplacementNewSim();
    this.actionError.set('');
  }
  protected changeAssignmentType(): void {
    this.assignmentResolution.set(null);
    this.replacementDevice.set(null);
    this.replacementStateId.set('');
    this.replacementBajaMotivo.set('');
    this.replacementConfirmed.set(false);
    this.replacementDelivered.set(null);
    this.replacementDeliveryError.set('');
    this.replacementSimAction.set(null);
    this.replacementSimCode.set('');
    this.replacementSims.set([]);
    this.replacementKeepNumber.set(null);
    this.resetReplacementNewSim();
    this.actionError.set('');
  }
  protected selectReplacementDevice(code: string, devices: Dispositivo[]): void {
    this.replacementDevice.set(devices.find(device => device.codigoInventario === Number(code)) || null);
    this.replacementConfirmed.set(false);
  }
  protected chooseReplacementDelivery(delivered: boolean): void {
    this.replacementDelivered.set(delivered);
    this.replacementDeliveryError.set('');
    this.replacementStateId.set('');
    this.replacementBajaMotivo.set('');
    this.replacementConfirmed.set(false);
    this.actionError.set('');
  }
  protected choosePendingSimDelivery(delivered: boolean): void {
    this.pendingSimDelivered.set(delivered);
    this.actionError.set('');
  }
  protected chooseReplacementSimAction(action: 'MOVER_SIM_ACTUAL' | 'USAR_SIM_EXISTENTE' | 'REGISTRAR_SIM_NUEVA' | 'SIN_SIM' | null): void {
    this.replacementSimAction.set(action);
    this.replacementSimCode.set('');
    this.replacementKeepNumber.set(null);
    this.replacementExistingLineChoice.set(null);
    if (action !== 'REGISTRAR_SIM_NUEVA') this.resetReplacementNewSim();
    this.actionError.set('');
    if (action === 'USAR_SIM_EXISTENTE' && !this.replacementSims().length) {
      this.simService.listar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: sims => this.replacementSims.set(sims.filter(isSimAvailableForJointDelivery)),
        error: error => this.actionError.set(errorMessage(error))
      });
    }
  }
  protected toggleReplacementNewSim(enabled: boolean): void {
    if (enabled) {
      this.chooseReplacementSimAction('REGISTRAR_SIM_NUEVA');
      return;
    }
    this.replacementSimAction.set(null);
    this.actionError.set('');
  }
  protected replacementNewIccidChanged(value: string): void {
    this.replacementNewIccid.set(value);
    this.replacementNewIccidStatus.set('idle');
    this.replacementExistingSim.set(null);
    this.actionError.set('');
  }
  protected checkReplacementNewIccid(): void {
    const iccid = this.replacementNewIccid().trim();
    if (!iccid) {
      this.replacementNewIccidStatus.set('idle');
      this.replacementExistingSim.set(null);
      this.actionError.set('Ingresa el ICCID de la SIM nueva.');
      return;
    }
    this.replacementNewIccidStatus.set('checking');
    this.simService.buscarPorIccid(iccid).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sim => {
        this.replacementExistingSim.set(sim);
        this.replacementNewIccidStatus.set('existing');
        this.actionError.set('La SIM ya existe. Puedes utilizarla como SIM registrada.');
      },
      error: error => {
        if (error instanceof ApiError && error.status === 404) {
          this.replacementExistingSim.set(null);
          this.replacementNewIccidStatus.set('available');
          this.actionError.set('ICCID disponible para registrar una SIM nueva.');
          return;
        }
        this.replacementNewIccidStatus.set('error');
        this.actionError.set(errorMessage(error));
      }
    });
  }
  protected useExistingReplacementSim(): void {
    const sim = this.replacementExistingSim();
    if (!sim || !isSimAvailableForJointDelivery(sim)) {
      this.actionError.set('La SIM existente no está disponible para este reemplazo.');
      return;
    }
    this.chooseReplacementSimAction('USAR_SIM_EXISTENTE');
    this.replacementSimCode.set(String(sim.codigoInventario));
    this.replacementExistingSim.set(sim);
    this.replacementNewIccid.set(sim.iccidCodigoFabrica || '');
  }
  protected changeExistingReplacementSim(): void {
    this.replacementSimAction.set('REGISTRAR_SIM_NUEVA');
    this.replacementSimCode.set('');
    this.replacementKeepNumber.set(null);
    this.replacementExistingLineChoice.set(null);
    this.replacementExistingSim.set(null);
    this.replacementNewIccidStatus.set('idle');
    this.actionError.set('');
  }
  protected replacementSimPhone(sim: Sim | null): string | null {
    return sim?.lineaMovil?.numeroTelefonico?.trim() || sim?.numeroAsociado?.trim() || null;
  }
  protected replacementSimPhoneText(sim: Sim | null): string {
    const phone = this.replacementSimPhone(sim);
    if (!phone) return 'Sin número asociado';
    const normalized = normalizeChileanPhoneInput(phone);
    return /^56\d{9}$/.test(normalized)
      ? `+${normalized.slice(0, 2)} ${normalized.slice(2, 3)} ${normalized.slice(3, 7)} ${normalized.slice(7)}`
      : phone;
  }
  protected replacementSimAvailability(sim: Sim): string {
    if (sim.dispositivo) return `Está instalada en ITAM ${sim.dispositivo.codigoInventario}.`;
    if (sim.colaborador) return `Está bajo custodia de ${sim.colaborador.nombre}.`;
    return `No está disponible: estado ${sim.estado.nombre}.`;
  }
  protected replacementSimIsAvailable(sim: Sim): boolean { return isSimAvailableForJointDelivery(sim); }
  protected replacementSelectedSim(): Sim | null {
    const code = Number(this.replacementSimCode());
    if (!code) return null;
    const lookedUp = this.replacementExistingSim();
    return lookedUp?.codigoInventario === code
      ? lookedUp
      : this.replacementSims().find(sim => sim.codigoInventario === code) || null;
  }
  protected replacementExistingLineOptions(device: Dispositivo): Array<{ value: ReplacementExistingLineChoice; label: string }> {
    const oldPhone = this.replacementCurrentPhone(device);
    const simPhone = this.replacementSimPhone(this.replacementSelectedSim());
    const options: Array<{ value: ReplacementExistingLineChoice; label: string }> = [];
    if (oldPhone) {
      options.push({
        value: 'CONSERVAR_NUMERO',
        label: simPhone && normalizeChileanPhoneInput(simPhone) === normalizeChileanPhoneInput(oldPhone)
          ? 'Mantener número actual'
          : 'Conservar número anterior'
      });
    }
    if (simPhone && normalizeChileanPhoneInput(simPhone) !== normalizeChileanPhoneInput(oldPhone || '')) {
      options.push({ value: 'USAR_NUMERO_SIM', label: 'Utilizar número de la SIM' });
    }
    options.push({ value: 'NUMERO_NUEVO', label: 'Registrar número nuevo' });
    options.push({ value: 'SIN_LINEA', label: 'Sin línea' });
    return options;
  }
  protected chooseReplacementExistingLine(choice: ReplacementExistingLineChoice | null): void {
    this.replacementExistingLineChoice.set(choice);
    this.replacementKeepNumber.set(choice === 'CONSERVAR_NUMERO' ? true : choice === 'USAR_NUMERO_SIM' ? false : null);
    if (choice !== 'NUMERO_NUEVO') this.replacementNewPhone.set('');
    this.actionError.set('');
  }
  protected replacementEffectiveExistingLineChoice(): ReplacementExistingLineChoice | null {
    return this.replacementExistingLineChoice()
      ?? (this.replacementKeepNumber() === true ? 'CONSERVAR_NUMERO' : this.replacementKeepNumber() === false ? 'USAR_NUMERO_SIM' : null);
  }
  protected replacementExistingLineWarning(device: Dispositivo): string {
    const selected = this.replacementSelectedSim();
    const oldPhone = this.replacementCurrentPhone(device);
    const simPhone = this.replacementSimPhone(selected);
    if (this.replacementExistingLineChoice() !== 'CONSERVAR_NUMERO' || !oldPhone || !simPhone) return '';
    if (normalizeChileanPhoneInput(oldPhone) === normalizeChileanPhoneInput(simPhone)) return '';
    return `La SIM seleccionada tiene el número ${this.replacementSimPhoneText(selected)}. Al conservar ${this.replacementCurrentPhoneText(device)}, esa línea quedará sin SIM asociada.`;
  }
  protected replacementSummarySim(device: Dispositivo): string {
    const action = this.replacementSimAction();
    if (action === 'REGISTRAR_SIM_NUEVA') return `SIM nueva · ICCID ${this.replacementNewIccid() || 'pendiente'} · ${this.replacementNewCompany() || 'compañía pendiente'}`;
    if (action === 'USAR_SIM_EXISTENTE') {
      const sim = this.replacementSelectedSim();
      return sim ? `SIM ITAM ${sim.codigoInventario} · ICCID ${sim.iccidCodigoFabrica || 'pendiente'} · ${sim.compania || 'sin compañía'}` : 'SIM existente pendiente de selección';
    }
    if (action === 'MOVER_SIM_ACTUAL' && device.simAsociada) return `SIM ITAM ${device.simAsociada.codigoInventario} · ICCID ${device.simAsociada.iccidCodigoFabrica || 'pendiente'} · ${device.simAsociada.compania || 'sin compañía'}`;
    if (device.simAsociada && !action) return 'Pendiente de resolver';
    return 'Sin SIM';
  }
  protected replacementSummaryLine(device: Dispositivo): string {
    const action = this.replacementSimAction();
    if (action === 'REGISTRAR_SIM_NUEVA') {
      if (this.replacementNewLine() === 'CONSERVAR_NUMERO') return `Conservar ${this.replacementCurrentPhoneText(device)}`;
      if (this.replacementNewLine() === 'NUMERO_NUEVO') return `Número nuevo: ${this.replacementNewPhone() || 'pendiente'}`;
      return 'Sin línea';
    }
    if (action === 'USAR_SIM_EXISTENTE') {
      const choice = this.replacementExistingLineChoice();
      if (choice === 'CONSERVAR_NUMERO') return `Conservar ${this.replacementCurrentPhoneText(device)}`;
      if (choice === 'USAR_NUMERO_SIM') return `Número de la SIM: ${this.replacementSimPhoneText(this.replacementSelectedSim())}`;
      if (choice === 'NUMERO_NUEVO') return `Número nuevo: ${this.replacementNewPhone() || 'pendiente'}`;
      if (choice === 'SIN_LINEA') return 'Sin línea';
    }
    if (action === 'MOVER_SIM_ACTUAL') return this.replacementCurrentPhoneText(device) || 'Sin número asociado';
    if (device.simAsociada && !action) return 'Pendiente de resolver';
    return 'Sin línea';
  }
  protected chooseReplacementNewLine(line: 'CONSERVAR_NUMERO' | 'NUMERO_NUEVO' | 'SIN_LINEA' | null): void {
    this.replacementNewLine.set(line);
    if (line !== 'NUMERO_NUEVO') this.replacementNewPhone.set('');
    this.actionError.set('');
  }
  protected cancelAssignmentDecision(): void {
    this.action.set(null);
    this.resetAssignmentDecision();
  }
  protected async confirmReplacement(): Promise<void> {
    if (this.submitting()) return;
    const oldDevice = this.replacementDevice();
    if (!oldDevice) return;
    if (this.item()?.estado.codigo !== 'DISPONIBLE') {
      this.actionError.set('El dispositivo nuevo debe estar disponible para iniciar el reemplazo.');
      return;
    }
    if (this.replacementDelivered() === null) {
      this.replacementDeliveryError.set('Debes indicar si el equipo anterior fue entregado físicamente.');
      this.actionError.set('');
      return;
    }
    if (this.replacementDelivered() && !this.replacementStateId()) {
      this.actionError.set('Selecciona el destino del dispositivo anterior recibido.');
      return;
    }
    if (this.replacementDelivered() && this.replacementRequiresBajaReason() && !this.replacementBajaMotivo()) {
      this.actionError.set('Selecciona el motivo de baja del equipo reemplazado.');
      return;
    }
    if (oldDevice.simAsociada || this.replacementSimAction() === 'USAR_SIM_EXISTENTE') {
      const simAction = this.replacementSimAction();
      if (!simAction) {
        this.actionError.set('Indica qué deseas hacer con la SIM asociada.');
        return;
      }
      if (simAction !== 'SIN_SIM' && (!this.item() || !canDeviceCarrySim(this.item()!))) {
        this.actionError.set('El dispositivo nuevo no admite una SIM. Selecciona “Entregar dispositivo nuevo sin SIM”.');
        return;
      }
      if (simAction === 'MOVER_SIM_ACTUAL' && this.replacementDelivered() === false) {
        this.actionError.set('No se puede mover la SIM mientras el dispositivo anterior no haya sido entregado.');
        return;
      }
      if (simAction === 'USAR_SIM_EXISTENTE' && !this.replacementSimCode()) {
        this.actionError.set('Selecciona la SIM registrada que utilizarás.');
        return;
      }
      if (simAction === 'USAR_SIM_EXISTENTE' && !this.replacementEffectiveExistingLineChoice()) {
        this.actionError.set('Selecciona qué ocurrirá con la línea telefónica de la SIM.');
        return;
      }
      if (simAction === 'USAR_SIM_EXISTENTE' && this.replacementEffectiveExistingLineChoice() === 'NUMERO_NUEVO' && !isChileanPhoneInputValid(this.replacementNewPhone())) {
        this.actionError.set('Ingresa un número telefónico chileno válido.');
        return;
      }
      if (simAction === 'USAR_SIM_EXISTENTE' && this.replacementEffectiveExistingLineChoice() === 'CONSERVAR_NUMERO' && !this.replacementCurrentPhone(oldDevice)) {
        this.actionError.set('El dispositivo anterior no tiene una línea que pueda conservarse.');
        return;
      }
      if (simAction === 'USAR_SIM_EXISTENTE' && this.replacementEffectiveExistingLineChoice() === 'CONSERVAR_NUMERO' && this.replacementDelivered() === false) {
        const confirmed = await this.confirmation.confirm(
          'El número anterior se transferirá a la SIM seleccionada. La devolución del equipo anterior quedará pendiente.',
          { title: 'Transferir línea con devolución pendiente', confirmLabel: 'Continuar' }
        );
        if (!confirmed) return;
      }
    }
    if (this.replacementSimAction() === 'REGISTRAR_SIM_NUEVA') {
      if (!this.item() || !canDeviceCarrySim(this.item()!)) {
        this.actionError.set('El dispositivo nuevo no admite una SIM.');
        return;
      }
      if (!this.replacementNewIccid().trim()) {
        this.actionError.set('Ingresa el ICCID de la SIM nueva.');
        return;
      }
      if (!this.replacementNewCompany().trim()) {
        this.actionError.set('Debe seleccionar una compañía.');
        return;
      }
      if (this.replacementNewIccidStatus() === 'idle') {
        this.actionError.set('Comprueba primero el ICCID antes de registrar la SIM.');
        return;
      }
      if (this.replacementNewIccidStatus() === 'existing') {
        this.actionError.set('El ICCID ya existe. Selecciona “Utilizar esta SIM” para continuar.');
        return;
      }
      if (this.replacementNewIccidStatus() !== 'available') {
        this.actionError.set('El ICCID debe estar disponible para registrar una SIM nueva.');
        return;
      }
      const newLine = this.replacementNewLine();
      if (!newLine) {
        this.actionError.set('Selecciona qué ocurrirá con la línea telefónica.');
        return;
      }
      if (newLine === 'CONSERVAR_NUMERO' && !this.replacementCurrentPhone(oldDevice)) {
        this.actionError.set('El dispositivo anterior no tiene una línea que pueda conservarse.');
        return;
      }
      if (newLine === 'NUMERO_NUEVO' && !isChileanPhoneInputValid(this.replacementNewPhone())) {
        this.actionError.set('Ingresa un número telefónico chileno válido.');
        return;
      }
      if (newLine === 'CONSERVAR_NUMERO' && this.replacementDelivered() === false) {
        const confirmed = await this.confirmation.confirm(
          'El número se transferirá a la SIM nueva. La SIM anterior permanecerá bajo responsabilidad del colaborador, sin línea asociada.',
          { title: 'Transferir línea con devolución pendiente', confirmLabel: 'Continuar' }
        );
        if (!confirmed) return;
      }
    }
    this.replacementConfirmed.set(true);
    await this.execute();
  }
  protected matchingSims(): Sim[] { return this.deliverySims().filter(sim => isSimAvailableForJointDelivery(sim) && simMatchesQuery(sim, this.simQuery())); }
  protected searchSim(query: string): void { const previous=this.selectedSim();if(!query&&previous?.numeroAsociado&&normalizeChileanPhoneInput(this.deliveryPhone())===normalizeChileanPhoneInput(previous.numeroAsociado))this.deliveryPhone.set('');this.simQuery.set(query);this.selectedSim.set(null); }
  protected selectSim(sim: Sim): void { this.selectedSim.set(sim); this.simQuery.set(String(sim.codigoInventario)); if(sim.numeroAsociado)this.deliveryPhone.set(sim.numeroAsociado); this.actionError.set(''); }
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
  private resetAssignmentDecision(): void {
    this.similarAssignedDevices.set(null);
    this.assignmentResolution.set(null);
    this.replacementDevice.set(null);
    this.replacementStateId.set('');
    this.replacementBajaMotivo.set('');
    this.replacementConfirmed.set(false);
    this.replacementDelivered.set(null);
    this.replacementDeliveryError.set('');
    this.pendingSimDelivered.set(null);
    this.replacementSimAction.set(null);
    this.replacementSimCode.set('');
    this.replacementSims.set([]);
    this.replacementKeepNumber.set(null);
    this.resetReplacementNewSim();
    this.checkingAssignment.set(false);
  }
  private resetReplacementNewSim(): void {
    this.replacementNewIccid.set('');
    this.replacementNewCompany.set('');
    this.replacementNewObservations.set('');
    this.replacementNewLine.set(null);
    this.replacementNewPhone.set('');
    this.replacementNewIccidStatus.set('idle');
    this.replacementExistingSim.set(null);
    this.replacementExistingLineChoice.set(null);
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
    this.pendingReplacement.set(null);
    this.simAssociationOpen.set(false);
    this.selectedSim.set(null);
    this.simError.set('');
    this.modalError.set(null);
    this.catalogoTecnico.set(null);
    this.catalogoSubiendo.set(false);
    this.catalogoError.set('');
    this.resetAssignmentDecision();
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
  protected readonly catalogos=inject(CatalogoTecnicoService);
  private readonly replacements=inject(ReemplazosDispositivoService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  protected readonly item = signal<Dispositivo | null>(null);
  protected readonly catalogoTecnico = signal<CatalogoTecnico | null>(null);
  protected readonly catalogoSubiendo = signal(false);
  protected readonly catalogoError = signal('');
  protected readonly traceability = signal<TrazabilidadDispositivo | null>(null);
  protected readonly history = signal<HistorialEvento[]>([]);
  protected readonly states = signal<Estado[]>([]);
  protected readonly collaborators = signal<Colaborador[]>([]);
  protected readonly departments = signal<Departamento[]>([]);
  protected readonly departmentQuery = signal('');
  protected readonly departmentResultsOpen = signal(false);
  protected readonly departmentActiveIndex = signal(-1);
  protected readonly receiverQuery = signal('');
  protected readonly receiverResultsOpen = signal(false);
  protected readonly receiverActiveIndex = signal(-1);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly actionErrorTitle = signal('');
  protected readonly submitting = signal(false);
  protected readonly action = signal<DeviceAction | null>(null);
  protected readonly activeServiceOrder = signal<OrdenServicio | null>(null);
  protected readonly serviceOrders = signal<OrdenServicio[]>([]);
  protected readonly pendingReplacement = signal<ReemplazoDispositivo | null>(null);
  protected readonly returnProof = signal<ComprobanteDevolucion | null>(null);
  protected readonly createdActa=signal<ActaEntrega|null>(null);
  protected readonly clp=formatClp;
  protected readonly isSmartphone=isSmartphoneDevice;
  protected readonly isRouter=isRouterType;
  protected readonly isCellularRouter=isCellularRouterDevice;
  protected readonly canCarrySim=canDeviceCarrySim;
  protected readonly deviceTechnicalIdentifier=deviceTechnicalIdentifier;
  protected readonly isPhoneValid=isChileanPhoneInputValid;
  protected readonly normalizePhone=normalizeChileanPhoneInput;
  protected readonly smartphonePhoneText=smartphonePhoneText;
  protected readonly smartphonePhonePending=smartphonePhonePending;
  protected replacementCurrentPhone(device: Dispositivo): string | null { return smartphonePhoneValue(device); }
  protected replacementCurrentPhoneText(device: Dispositivo): string {
    const phone = this.replacementCurrentPhone(device);
    if (!phone) return '';
    const normalized = normalizeChileanPhoneInput(phone);
    return /^56\d{9}$/.test(normalized)
      ? `+${normalized.slice(0, 2)} ${normalized.slice(2, 3)} ${normalized.slice(3, 7)} ${normalized.slice(7)}`
      : phone;
  }
  protected readonly lineActionCopy=smartphoneLineActionCopy;
  protected readonly technicalServiceStatusLabel=technicalServiceOrderStatusLabel;
  protected latestServiceOrder(): OrdenServicio | null { return latestTechnicalServiceOrder(this.serviceOrders()); }
  protected catalogoArchivoUrl(codigo: number, download = false): string {
    return this.catalogos.archivoUrl(codigo, download);
  }
  protected abrirCargaCatalogo(): void {
    if (this.auth.user()?.rol === 'SOLO_LECTURA' || this.catalogoSubiendo()) return;
    document.getElementById('technical-catalog-upload')?.click();
  }
  protected catalogoSeleccionado(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (input) input.value = '';
    if (!file || this.catalogoSubiendo()) return;

    if (file.type !== 'application/pdf' || !file.name.toLowerCase().endsWith('.pdf')) {
      this.catalogoError.set('Solo se permiten archivos PDF.');
      this.toast.error('Archivo no válido', 'Selecciona un archivo PDF.');
      return;
    }
    if (file.size < 1 || file.size > MAX_CATALOGO_TECNICO_BYTES) {
      this.catalogoError.set('El PDF debe pesar como máximo 10 MB.');
      this.toast.error('Archivo demasiado grande', 'El PDF debe pesar como máximo 10 MB.');
      return;
    }

    this.catalogoSubiendo.set(true);
    this.catalogoError.set('');
    this.catalogos.reemplazar(this.codigo, file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (catalogo) => {
          this.catalogoTecnico.set(catalogo);
          this.catalogoSubiendo.set(false);
          this.toast.success('Catálogo técnico guardado', 'El PDF quedó asociado al dispositivo.');
        },
        error: (error) => {
          this.catalogoSubiendo.set(false);
          this.catalogoError.set(errorMessage(error));
          this.toast.error('No se pudo guardar el catálogo técnico', errorMessage(error));
        }
      });
  }
  protected technicalCostPercent(value: number | null, order: OrdenServicio): number {
    const maximum = Math.max(order.montoCotizacion ?? 0, order.costoFinal ?? 0);
    return maximum > 0 && value !== null ? Math.min(100, (value / maximum) * 100) : 0;
  }
  protected serviceDateLabel(value: string): string { const [year,month,day]=value.slice(0,10).split('-');return `${day}/${month}/${year}`; }
  protected readonly labelResponsible=assetLabelResponsible;
  protected readonly labelPhone=smartphonePhoneValue;
  protected technicalServiceActive(): boolean { return this.item()?.estado.codigo === 'SERVICIO_TECNICO' || !!this.activeServiceOrder(); }
  protected originLabel(origin: 'HISTORIAL'|'BAJA'|'COMPROBANTE'): string { return {HISTORIAL:'Historial',BAJA:'Registro de baja',COMPROBANTE:'Comprobante'}[origin]; }
  protected eventLabel(event: string): string { return { ALTA_DISPOSITIVO: 'Equipo incorporado al inventario', ASIGNAR_COLABORADOR: 'Equipo entregado a un colaborador', CONCILIAR_DISPOSITIVO_EXISTENTE: 'Registro actualizado desde inventario anterior', DEVOLVER_A_BODEGA: 'Equipo recibido en bodega', CAMBIAR_ESTADO: 'Situación del equipo actualizada', REPORTAR_EXTRAVIO: 'Equipo reportado como perdido', DAR_DE_BAJA: 'Equipo retirado del inventario', VERIFICACION_FISICA: 'Verificación física', VERIFICACION_MANUAL_EQUIPO: 'Equipo verificado manualmente por usuario', EQUIPO_VERIFICADO_POR_REGISTRO_MANUAL: 'Equipo verificado por registro manual', SIM_ASOCIADA_A_DISPOSITIVO: 'SIM asociada al smartphone', ENTREGA_EQUIPO_CON_SIM: 'Smartphone entregado con SIM', LINEA_MOVIL_NUMERO_ACTUALIZADO: 'Número telefónico actualizado' }[event] || event.replaceAll('_', ' '); }
  protected verificationEventLabel(event: HistorialEvento): string { const result = event.detalle['resultado']; return result === 'VERIFICADO' ? '✓ Equipo verificado' : '○ Equipo no verificado'; }
  protected codigo = 0;
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
    this.loading.set(true); this.error.set(''); this.catalogoError.set('');
    forkJoin({ traceability: this.service.trazabilidad(this.id), states: this.estadosService.listar('DISPOSITIVO'), collaborators: this.colaboradoresService.listar({ activo: true }), departments: this.departamentosService.listar(), catalogo: this.catalogos.obtener(this.id).pipe(catchError((error) => { this.catalogoError.set(errorMessage(error)); return of(null as CatalogoTecnico | null); })), serviceOrders: this.technicalService.listar().pipe(catchError(() => of([] as OrdenServicio[]))), replacements: this.replacements.pendientes().pipe(catchError(() => of([] as ReemplazoDispositivo[]))) }).subscribe({ next: (result) => { if (requestedId !== this.id) return; this.traceability.set(result.traceability); this.item.set(result.traceability.dispositivo); this.catalogoTecnico.set(result.catalogo); this.codigo = result.traceability.dispositivo.codigoInventario; this.pendingReplacement.set(result.replacements.find(replacement => replacement.dispositivoAnterior.codigoInventario === this.codigo && replacement.estadoOperacion === 'PENDIENTE_DEVOLUCION') || null); this.serviceOrders.set(result.serviceOrders.filter(order => String(order.dispositivo.id) === String(result.traceability.dispositivo.id))); this.activeServiceOrder.set(activeTechnicalServiceOrderForDevice(result.serviceOrders, this.codigo)); this.history.set(result.traceability.eventos); this.states.set(result.states.filter((state) => state.activo)); this.collaborators.set(result.collaborators); this.departments.set(result.departments.filter((department) => department.activo)); this.loading.set(false); if (this.routeAction === 'assign' && !this.terminal() && !this.technicalServiceActive()) this.open('assign-person'); }, error: (error) => { if (requestedId !== this.id) return; this.error.set(errorMessage(error)); this.loading.set(false); } });
  }
  protected terminal(): boolean { return this.states().find((state) => state.id === this.item()?.estado.id)?.esTerminal ?? false; }
  protected stateExists(code: string): boolean { return this.states().some((state) => state.codigo === code); }
  protected canVerifyManually(device: Dispositivo): boolean {
    return device.origenRegistro === 'IMPORTADO'
      && device.estado.codigo !== 'EXTRAVIADO'
      && (device.verificacionFisica?.resultado || 'PENDIENTE') === 'PENDIENTE';
  }
  protected verificationStatusLabel(device: Dispositivo): string {
    return device.origenRegistro === 'MANUAL' || device.verificacionFisica?.resultado === 'VERIFICADO'
      ? 'Verificado'
      : 'No verificado';
  }
  protected verificationSourceLabel(device: Dispositivo): string {
    return device.origenRegistro === 'MANUAL'
      ? 'Acreditada por registro manual'
      : 'Auditoría física del inventario';
  }
  protected async verifyManually(): Promise<void> {
    if (this.auth.user()?.rol === 'SOLO_LECTURA') return;
    if(this.submitting() || (this.item()?.verificacionFisica?.resultado || 'PENDIENTE')!=='PENDIENTE') return;
    const confirmed=await this.confirmation.confirm('Esta es una acción opcional de auditoría física. Confirme que revisó correctamente el código ITAM, tipo de equipo, marca/modelo, IMEI o número de serie, responsable actual, ubicación y estado operativo. Solo esta acción marcará el equipo como verificado y registrará un evento en su historial.',{title:'Verificar equipo',confirmLabel:'Confirmar verificación'});
    if(!confirmed)return;
    this.submitting.set(true);
    this.service.verificarManual(this.codigo).subscribe({next:()=>{this.submitting.set(false);this.toast.success('Equipo verificado','La verificación manual quedó registrada en el historial.');this.load();},error:error=>{this.submitting.set(false);this.toast.error('No se pudo verificar',errorMessage(error));}});
  }
  protected associationSimResults(): Sim[] {
    return deviceSimSearchMatches(this.associationSims(), this.associationSimQuery());
  }
  protected isSimSelectableForAssociation(sim: Sim): boolean {
    return sim.estado.codigo === 'DISPONIBLE' && !sim.dispositivo && !sim.colaborador;
  }
  protected isValidIccidValue(value: string): boolean { return /^\d{19,20}$/.test(this.normalizeIccidValue(value)); }
  protected normalizeIccidValue(value: string): string { return value.trim().replace(/[\s-]/g, ''); }
  protected chooseAssociationChange(change: DeviceSimChange): void {
    const device = this.item();
    this.associationChange.set(change);
    this.modalError.set(null);
    this.associationInlineRegistration.set(false);
    this.associationSelectedSim.set(null);
    this.associationSimQuery.set('');
    this.associationLineLookup.set(null);
    this.associationLineState.set('idle');
    if ((change === 'NUMBER' || change === 'BOTH') && device?.lineaMovil?.numeroTelefonico) {
      this.associationNumber.set(device.lineaMovil.numeroTelefonico);
      this.lookupAssociationNumber(device.lineaMovil.numeroTelefonico);
    } else {
      this.associationNumber.set('');
    }
  }
  protected associationNumberChanged(value: string): void {
    this.associationNumber.set(value);
    this.modalError.set(null);
    this.lookupAssociationNumber(value);
  }
  private lookupAssociationNumber(value: string): void {
    if (this.associationLookupTimer) clearTimeout(this.associationLookupTimer);
    const normalized = normalizeChileanPhoneInput(value);
    this.associationLineLookup.set(null);
    if (!value.trim() || !isChileanPhoneInputValid(value)) {
      this.associationLineState.set('idle');
      return;
    }
    this.associationLineState.set('checking');
    this.associationLookupTimer = setTimeout(() => {
      const device = this.item();
      this.simService.buscarLineaPorNumero(normalized, device?.id, device?.simAsociada?.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: line => {
          this.associationLineLookup.set(line);
          const device = this.item();
          const conflict = !!line.dispositivo && String(line.dispositivo.id) !== String(device?.id)
            || !!line.colaborador && !!device?.colaborador && String(line.colaborador.id) !== String(device.colaborador.id);
          this.associationLineState.set(conflict ? 'conflict' : 'found');
        },
        error: error => {
          if ((error as { status?: number })?.status === 404) this.associationLineState.set('available');
          else if ((error as { status?: number })?.status === 409) this.associationLineState.set('conflict');
          else { this.associationLineState.set('idle'); this.showModalError('No se pudo buscar el número', errorMessage(error)); }
        }
      });
    }, 300);
  }
  protected associationSimSearchChanged(value: string): void {
    this.associationSimQuery.set(value);
    this.associationSelectedSim.set(null);
    this.associationInlineRegistration.set(false);
    this.modalError.set(null);
  }
  protected selectAssociationSim(sim: Sim): void {
    if (!this.isSimSelectableForAssociation(sim)) return;
    this.associationSelectedSim.set(sim);
    this.associationSimQuery.set(String(sim.codigoInventario));
    this.associationInlineRegistration.set(false);
  }
  protected clearAssociationSim(): void {
    this.associationSelectedSim.set(null);
    this.associationSimQuery.set('');
    this.associationInlineRegistration.set(false);
  }
  protected startAssociationInlineRegistration(): void {
    this.associationInlineRegistration.set(true);
    this.associationNewIccid.set(this.normalizeIccidValue(this.associationSimQuery()));
    this.associationNewCompany.set('');
    this.associationOtherCompany.set('');
    this.associationNewObservations.set('');
  }
  protected associationSubmitLabel(): string {
    return deviceSimChangeLabel(this.associationChange(), !!this.item()?.simAsociada);
  }
  protected canSubmitAssociation(): boolean {
    if (this.submitting() || this.associationChange() === 'KEEP') return false;
    const change = this.associationChange();
    const needsNumber = change === 'NUMBER' || change === 'BOTH';
    const needsSim = change === 'SIM' || change === 'BOTH';
    if (needsNumber && !isChileanPhoneInputValid(this.associationNumber())) return false;
    if (needsNumber && !['available', 'found'].includes(this.associationLineState())) return false;
    if (needsNumber && this.associationLineState() === 'conflict') return false;
    if (!needsSim && !this.item()?.simAsociada) return false;
    if (needsSim && this.associationInlineRegistration()) {
      const company = this.associationNewCompany() === 'Otro' ? this.associationOtherCompany().trim() : this.associationNewCompany().trim();
      return this.isValidIccidValue(this.associationNewIccid()) && !!company;
    }
    if (needsSim && !this.associationSelectedSim()) return false;
    if (needsNumber && !this.associationInlineRegistration() && this.associationLineState() === 'found'
      && String(this.associationLineLookup()?.id) !== String(this.item()?.lineaMovil?.id)) return false;
    return true;
  }
  protected openSimAssociation(): void {
    if (this.auth.user()?.rol === 'SOLO_LECTURA') return;
    const device = this.item();
    if (!device || !canDeviceCarrySim(device) || this.submitting()) return;
    const initialChange: DeviceSimChange = device.lineaMovil && device.simAsociada ? 'KEEP'
      : device.lineaMovil ? 'SIM'
        : device.simAsociada ? 'NUMBER' : 'BOTH';
    this.action.set(null);
    this.associationChange.set(initialChange);
    this.associationNumber.set('');
    this.associationLineLookup.set(null);
    this.associationLineState.set('idle');
    this.associationSimQuery.set('');
    this.associationSelectedSim.set(null);
    this.associationInlineRegistration.set(false);
    this.associationNewIccid.set('');
    this.associationNewCompany.set('');
    this.associationOtherCompany.set('');
    this.associationNewObservations.set('');
    this.simError.set('');
    this.modalError.set(null);
    this.associationSims.set([]);
    this.simAssociationOpen.set(true);
    this.simLoading.set(true);
    this.simService.listar().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sims => { this.associationSims.set(sims); this.simLoading.set(false); },
      error: error => { const message = errorMessage(error); this.simError.set(message); this.showModalError('No se pudieron cargar las SIM', message); this.simLoading.set(false); }
    });
  }
  protected closeSimAssociation(): void {
    if (this.submitting()) return;
    if (this.associationLookupTimer) clearTimeout(this.associationLookupTimer);
    this.simAssociationOpen.set(false);
    this.associationChange.set('KEEP');
    this.associationNumber.set('');
    this.associationLineLookup.set(null);
    this.associationLineState.set('idle');
    this.associationSimQuery.set('');
    this.associationSelectedSim.set(null);
    this.associationInlineRegistration.set(false);
    this.associationNewIccid.set('');
    this.associationNewCompany.set('');
    this.associationOtherCompany.set('');
    this.associationNewObservations.set('');
    this.simError.set('');
    this.modalError.set(null);
  }
  protected associateSim(): void {
    const device = this.item();
    if (this.submitting() || !device || !this.canSubmitAssociation()) return;
    const codigo = Number(device.codigoInventario);
    const change = this.associationChange();
    const changeNumber = change === 'NUMBER' || change === 'BOTH';
    const changeSim = change === 'SIM' || change === 'BOTH';
    const normalizedNumber = changeNumber ? normalizeChileanPhoneInput(this.associationNumber()) : null;
    this.submitting.set(true);
    this.modalError.set(null);
    if (changeSim && this.associationInlineRegistration()) {
      const company = this.associationNewCompany() === 'Otro' ? this.associationOtherCompany().trim() : this.associationNewCompany().trim();
      let accionLinea: RegistrarSimNuevaAccionLinea = 'SIN_LINEA';
      let lineaMovilId: number | null = null;
      let numeroNuevo: string | null = null;
      if (changeNumber) {
        if (this.associationLineState() === 'found' && this.associationLineLookup()) {
          accionLinea = 'USAR_LINEA_EXISTENTE';
          lineaMovilId = Number(this.associationLineLookup()!.id);
        } else {
          accionLinea = 'CREAR_LINEA_NUEVA';
          numeroNuevo = normalizedNumber;
        }
      } else if (device.lineaMovil) {
        accionLinea = 'USAR_LINEA_EXISTENTE';
        lineaMovilId = Number(device.lineaMovil.id);
      }
      this.service.registrarSimNueva(codigo, {
        iccidCodigoFabrica: this.normalizeIccidValue(this.associationNewIccid()),
        compania: company,
        observaciones: this.associationNewObservations().trim() || null,
        accionLinea,
        lineaMovilId,
        numeroNuevo
      }).subscribe({
        next: () => this.finishAssociationSave(codigo, 'SIM nueva registrada y asociada correctamente.'),
        error: error => this.failAssociationSave(error)
      });
      return;
    }
    this.service.gestionarLineaSim(codigo, {
      mantenerNumero: !changeNumber,
      mantenerSim: !changeSim,
      simDestinoCodigo: changeSim ? this.associationSelectedSim()!.codigoInventario : null,
      numeroNuevo: normalizedNumber,
      observaciones: 'Gestión desde ficha de dispositivo'
    }).subscribe({
      next: () => this.finishAssociationSave(codigo, `${this.associationSubmitLabel()} realizado correctamente.`),
      error: error => this.failAssociationSave(error)
    });
  }
  private finishAssociationSave(codigo: number, detail: string): void {
    this.service.obtener(codigo).subscribe({
      next: refreshed => { this.item.set(refreshed); this.submitting.set(false); this.closeSimAssociation(); this.showFeedback({ type: 'success', title: 'Gestión de línea / SIM completada', detail }); this.toast.success('Gestión de línea / SIM completada', detail); },
      error: error => this.failAssociationSave(error)
    });
  }
  private failAssociationSave(error: unknown): void {
    const message = mobileLineErrorDetail(error);
    this.submitting.set(false);
    this.showModalError('No se pudo completar el cambio', message);
    this.toast.error('No se pudo completar el cambio', message);
  }
   protected open(action: DeviceAction): void { const actor=this.auth.user();if(!actor){this.actionError.set('La sesión no permite identificar al responsable TI.');this.toast.error('Sesión no válida','Vuelva a iniciar sesión antes de registrar una operación.');return;}if(action==='service'&&this.technicalServiceActive()){this.actionErrorTitle.set('No se pudo registrar el envío a servicio técnico');this.actionError.set('El equipo ya se encuentra en servicio técnico.');return;}this.actionForm.reset({ colaboradorId: '', departamentoId: '',recibidoPorId:'', localidad: this.item()?.localidad || '', ubicacionDetalle: this.item()?.ubicacionDetalle || '', estadoId: '',accionLineaExtravio:'',proveedor:'',fechaEnvio: action==='service' ? todayDateInputValue() : '',tipoServicio: action==='service' ? 'DIAGNOSTICO' : '',fallaReportada:'',accesoriosEntregados:'',motivoBaja:'',motivoRecuperacion:'', responsable: actor.nombre, observaciones: '' }); this.resetDepartmentAutocomplete(); this.searchCollaborator(''); this.resetAssignmentDecision(); this.jointDelivery.set(false); this.deliveryPhone.set(action==='assign-person'&&this.item()&&canDeviceCarrySim(this.item()!) ? smartphonePhoneValue(this.item()!) || '' : ''); this.searchSim(''); this.actionError.set(''); this.actionErrorTitle.set(''); this.action.set(action); }
  protected openState(code: string): void { const state = this.states().find((item) => item.codigo === code); if (!state) return; this.open('state'); this.actionForm.controls.estadoId.setValue(state.id); if(code==='EXTRAVIADO'&&this.item()&&isSmartphoneDevice(this.item()!)&&!this.item()!.simAsociada)this.actionForm.controls.accionLineaExtravio.setValue('NO_APLICA'); }
  protected isReportingSmartphoneLost(): boolean { const target=this.states().find(state=>state.id===this.actionForm.controls.estadoId.value);const device=this.item();return this.action()==='state'&&!!device&&isSmartphoneDevice(device)&&target?.codigo==='EXTRAVIADO'; }
  protected actionTitle(): string { return { 'assign-person': 'Registrar entrega', 'assign-department': 'Entregar a departamento', return: 'Registrar recepción', state: 'Cambiar situación del equipo', recover: 'Registrar equipo encontrado', service:'Orden de Trabajo - Servicio Técnico',retire:'Retirar del inventario' }[this.action() || 'return']; }
  protected openServiceOrder(): void { this.open('service'); const device=this.item(); if(device)this.actionForm.controls.areaSolicitante.setValue(device.departamento?.nombre || 'Area TI - Aguas San Isidro'); }
  protected matchingDepartments(): Departamento[] {
    const query = this.departmentQuery();
    return this.departments().filter((department) => !query.trim() || departmentMatchesQuery(department, query));
  }
  protected matchingDepartmentReceivers(): Colaborador[] {
    const departmentId = this.actionForm.controls.departamentoId.value;
    return receiversForDepartment(this.collaborators(), departmentId)
      .filter((person) => !this.receiverQuery().trim() || collaboratorMatchesQuery(person, this.receiverQuery()));
  }
  protected departmentReceivers(): Colaborador[] {
    return receiversForDepartment(this.collaborators(), this.actionForm.controls.departamentoId.value);
  }
  protected departmentQueryChanged(query: string): void {
    this.departmentQuery.set(query);
    this.departmentResultsOpen.set(true);
    this.actionForm.controls.departamentoId.setValue('');
    this.actionForm.controls.recibidoPorId.setValue('');
    this.receiverQuery.set('');
    this.receiverResultsOpen.set(false);
    this.departmentActiveIndex.set(-1);
    this.actionError.set('');
  }
  protected selectDepartment(department: Departamento): void {
    this.actionForm.controls.departamentoId.setValue(department.id);
    this.departmentQuery.set(department.nombre);
    this.departmentResultsOpen.set(false);
    this.departmentActiveIndex.set(-1);
    this.actionForm.controls.recibidoPorId.setValue('');
    this.receiverQuery.set('');
    this.receiverResultsOpen.set(false);
    this.receiverActiveIndex.set(-1);
    this.actionError.set('');
  }
  protected receiverQueryChanged(query: string): void {
    this.receiverQuery.set(query);
    this.receiverResultsOpen.set(true);
    this.actionForm.controls.recibidoPorId.setValue('');
    this.receiverActiveIndex.set(-1);
    this.actionError.set('');
  }
  protected selectDepartmentReceiver(person: Colaborador): void {
    if (!this.departmentReceivers().some((candidate) => candidate.id === person.id)) return;
    this.actionForm.controls.recibidoPorId.setValue(person.id);
    this.receiverQuery.set(person.nombre);
    this.receiverResultsOpen.set(false);
    this.receiverActiveIndex.set(-1);
    this.actionError.set('');
  }
  protected departmentKeydown(event: KeyboardEvent): void {
    this.handleAutocompleteKeydown(event, this.matchingDepartments().length, this.departmentActiveIndex, this.departmentResultsOpen,
      (index) => this.selectDepartment(this.matchingDepartments()[index]!));
  }
  protected receiverKeydown(event: KeyboardEvent): void {
    const results = this.matchingDepartmentReceivers();
    this.handleAutocompleteKeydown(event, results.length, this.receiverActiveIndex, this.receiverResultsOpen,
      (index) => this.selectDepartmentReceiver(results[index]!));
  }
  @HostListener('document:click', ['$event'])
  protected closeDepartmentAutocompleteOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (!target.closest('.department-autocomplete--department')) this.departmentResultsOpen.set(false);
    if (!target.closest('.department-autocomplete--receiver')) this.receiverResultsOpen.set(false);
  }
  private handleAutocompleteKeydown(
    event: KeyboardEvent,
    resultCount: number,
    activeIndex: WritableSignal<number>,
    isOpen: WritableSignal<boolean>,
    select: (index: number) => void
  ): void {
    if (event.key === 'Escape') {
      isOpen.set(false);
      activeIndex.set(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!resultCount) return;
      event.preventDefault();
      isOpen.set(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const current = activeIndex();
      activeIndex.set(current < 0
        ? (direction > 0 ? 0 : resultCount - 1)
        : (current + direction + resultCount) % resultCount);
      return;
    }
    if (event.key === 'Enter' && isOpen() && resultCount) {
      event.preventDefault();
      select(Math.max(0, activeIndex()));
    }
  }
  private resetDepartmentAutocomplete(): void {
    this.departmentQuery.set('');
    this.departmentResultsOpen.set(false);
    this.departmentActiveIndex.set(-1);
    this.receiverQuery.set('');
    this.receiverResultsOpen.set(false);
    this.receiverActiveIndex.set(-1);
  }
  protected custodyText(event: HistorialEvento, key: 'custodiaAnterior'|'custodiaNueva'): string {
    const value = event.detalle[key];
    if (!value || typeof value !== 'object') return '';
    const custody = value as { tipo?: string; nombre?: string };
    if (custody.tipo === 'COLABORADOR') return `Colaborador: ${custody.nombre || 'sin nombre'}`;
    if (custody.tipo === 'DEPARTAMENTO') return `Departamento: ${custody.nombre || 'sin nombre'}`;
    return 'Sin responsable';
  }

  private checkForSimilarAssignment(collaboratorId: number): void {
    const current = this.item();
    const collaborator = this.selectedCollaborator();
    if (!current || !collaborator) return;
    this.checkingAssignment.set(true);
    this.actionError.set('');
    this.service.listar({ colaboradorId: collaboratorId, estado: 'ASIGNADO' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: devices => {
          this.checkingAssignment.set(false);
          const currentCustody = devices.filter(device => device.codigoInventario !== current.codigoInventario);
          if (!currentCustody.length) {
            this.assignmentResolution.set('ADD');
            return;
          }
          this.assignmentResolution.set(null);
          this.similarAssignedDevices.set({ collaborator, devices: currentCustody });
        },
        error: error => {
          this.checkingAssignment.set(false);
          this.actionErrorTitle.set('No se pudo verificar la custodia existente');
          this.actionError.set(errorMessage(error));
        }
      });
  }

  private executeGeneralReplacement(
    value: ReturnType<typeof this.actionForm.getRawValue>,
    actor: { nombre: string }
  ): void {
    const oldDevice = this.replacementDevice();
    const newDevice = this.item();
    const delivered = this.replacementDelivered() === true;
    const targetState = delivered
      ? this.replacementStates().find(state => state.id === this.replacementStateId())
      : null;
    if (!oldDevice || !newDevice || (delivered && !targetState)) {
      this.actionError.set('Completa la información del reemplazo antes de continuar.');
      return;
    }
    const simAction = this.replacementSimAction() === 'REGISTRAR_SIM_NUEVA'
      ? 'REGISTRAR_SIM_NUEVA'
      : this.replacementSimAction() || 'SIN_SIM';
    if (oldDevice.simAsociada && !simAction) {
      this.actionError.set('Resuelve primero qué ocurrirá con la SIM asociada.');
      return;
    }
    this.submitting.set(true);
    this.actionError.set('');
    this.actionErrorTitle.set('');
    this.replacements.crear({
      colaboradorId: Number(value.colaboradorId),
      dispositivoAnteriorCodigo: oldDevice.codigoInventario,
      dispositivoNuevoCodigo: newDevice.codigoInventario,
      entregaAnterior: delivered,
      ...(targetState ? { destinoDispositivoAnterior: targetState.codigo as 'DISPONIBLE' | 'RETENIDO_REVISION' | 'DADO_BAJA' } : {}),
      accionSim: simAction as 'MOVER_SIM_ACTUAL' | 'USAR_SIM_EXISTENTE' | 'REGISTRAR_SIM_NUEVA' | 'SIN_SIM',
      ...(simAction === 'USAR_SIM_EXISTENTE' ? {
        simDestinoCodigo: Number(this.replacementSimCode()),
        conservarNumero: this.replacementEffectiveExistingLineChoice() === 'CONSERVAR_NUMERO',
        lineaSimExistente: this.replacementEffectiveExistingLineChoice()!,
        ...(this.replacementEffectiveExistingLineChoice() === 'NUMERO_NUEVO' ? { numeroTelefonicoNuevo: this.replacementNewPhone().trim() } : {})
      } : {}),
      ...(simAction === 'REGISTRAR_SIM_NUEVA' ? {
        simNueva: {
          iccidCodigoFabrica: this.replacementNewIccid().trim(),
          compania: this.replacementNewCompany().trim() || null,
          observaciones: this.replacementNewObservations().trim() || null,
          linea: this.replacementNewLine()!,
          ...(this.replacementNewLine() === 'NUMERO_NUEVO' ? { numeroTelefonico: this.replacementNewPhone().trim() } : {})
        }
      } : {}),
      ...(this.replacementRequiresBajaReason() ? { motivoBaja: this.replacementBajaMotivo() as import('../../core/models/itam.models').MotivoBaja } : {}),
      observaciones: value.observaciones.trim() || null
    }).subscribe({
      next: replacement => {
        this.action.set(null);
        this.submitting.set(false);
        this.resetAssignmentDecision();
        const detail = delivered
          ? `ITAM ${oldDevice.codigoInventario} quedó en ${targetState!.nombre}.`
          : `ITAM ${oldDevice.codigoInventario} continúa bajo custodia y queda pendiente de devolución.`;
        this.toast.success('Reemplazo registrado', `El nuevo equipo fue asignado. ${detail}`);
        this.showFeedback({
          type: delivered ? 'success' : 'warning',
          title: delivered ? 'Reemplazo registrado correctamente' : 'Reemplazo con devolución pendiente',
          detail
        });
        this.actasService.crear({
          colaboradorId: Number(value.colaboradorId),
          departamentoId: null,
          recepcionanteId: null,
          localidad: value.localidad.trim() || newDevice.localidad,
          responsableTi: actor.nombre,
          observaciones: value.observaciones.trim() || null,
          dispositivosCodigos: [newDevice.codigoInventario]
        }).subscribe({
          next: acta => this.createdActa.set(acta),
          error: error => this.toast.warning('Reemplazo registrado', `No fue posible generar el acta: ${errorMessage(error)}`)
        });
        void replacement;
        this.load();
      },
      error: error => {
        this.submitting.set(false);
        this.replacementConfirmed.set(false);
        this.actionErrorTitle.set('No se pudo completar el reemplazo');
        this.actionError.set(errorMessage(error));
      }
    });
  }

  private executeReplacementAssignment(
    value: ReturnType<typeof this.actionForm.getRawValue>,
    actor: { nombre: string },
    deliveryPhoneValue: string
  ): void {
    this.executeGeneralReplacement(value, actor);
    return;
    /*
    const oldDevice = this.replacementDevice()!;
    const targetState = this.replacementStates().find(state => state.id === this.replacementStateId())!;
    if (!oldDevice || !targetState) {
      this.actionError.set('Selecciona el equipo anterior y el estado final del reemplazo.');
      return;
    }

    const observation = [
      `Reemplazo por equipo ITAM ${this.codigo}.`,
      value.observaciones.trim()
    ].filter(Boolean).join(' ');
    const assignmentInput = {
      responsable: actor.nombre,
      observaciones: value.observaciones.trim() || null,
      colaboradorId: Number(value.colaboradorId),
      ...(deliveryPhoneValue && this.item() && canDeviceCarrySim(this.item()!)
        ? { numeroTelefonico: deliveryPhoneValue }
        : {}),
      ...(this.jointDelivery() && this.selectedSim()
        ? { simCodigoInventario: this.selectedSim()!.codigoInventario }
        : {})
    };

    this.submitting.set(true);
    this.actionError.set('');
    this.actionErrorTitle.set('');
    this.service.devolver(oldDevice.codigoInventario, {
      responsable: actor.nombre,
      observaciones: observation,
      resultado: targetState.codigo === 'SERVICIO_TECNICO' ? 'DANADO' : 'DEVUELTO'
    }).pipe(
      switchMap(() => {
        if (targetState.codigo === 'RETENIDO_REVISION') return of(null);
        if (targetState.codigo === 'DADO_BAJA') {
          return this.service.darBaja(oldDevice.codigoInventario, {
            responsable: actor.nombre,
            motivo: this.replacementBajaMotivo() as import('../../core/models/itam.models').MotivoBaja,
            observaciones: observation
          }).pipe(map(() => null));
        }
        return this.service.cambiarEstado(oldDevice.codigoInventario, {
          estadoId: Number(targetState.id),
          responsable: actor.nombre,
          observaciones: observation
        }).pipe(map(() => null));
      }),
      switchMap(() => this.service.asignarColaborador(this.codigo, assignmentInput))
    ).subscribe({
      next: updated => {
        this.action.set(null);
        this.submitting.set(false);
        this.resetAssignmentDecision();
        const simStatus = this.jointDelivery() ? 'SIM asociada correctamente' : 'SIM pendiente de asociar';
        this.showFeedback({
          type: 'success',
          title: 'Reemplazo registrado correctamente',
          detail: `ITAM ${oldDevice.codigoInventario} quedó en ${targetState.nombre}. El nuevo equipo fue entregado. ${simStatus}.`
        });
        this.toast.success('Reemplazo registrado', `El equipo anterior quedó en ${targetState.nombre} y el nuevo equipo fue asignado.`);
        this.actasService.crear({
          colaboradorId: Number(value.colaboradorId),
          departamentoId: null,
          recepcionanteId: null,
          localidad: value.localidad.trim() || updated.localidad,
          responsableTi: actor.nombre,
          observaciones: value.observaciones.trim() || null,
          dispositivosCodigos: [updated.codigoInventario]
        }).subscribe({
          next: acta => this.createdActa.set(acta),
          error: error => this.toast.warning('Reemplazo registrado', `No fue posible generar el acta: ${errorMessage(error)}`)
        });
        this.load();
      },
      error: error => {
        this.submitting.set(false);
        this.replacementConfirmed.set(false);
        this.actionErrorTitle.set('No se pudo completar el reemplazo');
        this.actionError.set(errorMessage(error));
      }
    });
  }

    */
  }

  protected async execute(): Promise<void> {
    if (this.auth.user()?.rol === 'SOLO_LECTURA') return;
    const action = this.action(); if (!action || this.submitting()) return;
    const value = this.actionForm.getRawValue();
    const actor = this.auth.user();
    if (!actor?.nombre.trim()) { this.actionErrorTitle.set('No se pudo registrar la operación'); this.actionError.set('La sesión no permite identificar al responsable TI.'); return; }
    this.actionForm.controls.responsable.setValue(actor.nombre);
    if (action === 'assign-person' && !value.colaboradorId) { this.actionError.set('Selecciona un colaborador.'); return; }
    if (action === 'assign-person' && !this.assignmentResolution()) {
      this.checkForSimilarAssignment(Number(value.colaboradorId));
      return;
    }
    if (action === 'assign-person' && this.assignmentResolution() === 'REPLACE' && !this.replacementConfirmed()) {
      if (this.replacementDelivered() === null) {
        this.replacementDeliveryError.set('Debes indicar si el equipo anterior fue entregado físicamente.');
        this.actionError.set('');
      } else {
        this.actionError.set('Confirma el reemplazo y el estado final del equipo anterior.');
      }
      return;
    }
    const deliveryPhoneValue = this.deliveryPhone().trim();
    if (action === 'assign-person' && this.assignmentResolution() !== 'REPLACE' && this.item() && canDeviceCarrySim(this.item()!) && deliveryPhoneValue && !isChileanPhoneInputValid(deliveryPhoneValue)) { this.actionError.set('Ingresa un número telefónico chileno válido.'); return; }
    if (action === 'assign-person' && this.assignmentResolution() !== 'REPLACE' && this.jointDelivery() && (!this.selectedSim() || !this.item() || !canDeviceCarrySim(this.item()!) || this.item()!.simAsociada)) { this.actionError.set('Selecciona una SIM disponible para este dispositivo.'); return; }
    if (action === 'assign-person' && this.assignmentResolution() !== 'REPLACE' && this.jointDelivery() && !isChileanPhoneInputValid(deliveryPhoneValue)) { this.actionError.set('Ingresa un número telefónico chileno válido para la SIM.'); return; }
    if (action === 'assign-department' && !value.departamentoId) { this.actionError.set('Seleccione un departamento de los resultados.'); return; }
    if (action === 'assign-department' && !value.recibidoPorId) { this.actionError.set('Seleccione un colaborador de los resultados.'); return; }
    if (action === 'state' && !value.estadoId) { this.actionError.set('Selecciona un estado.'); return; }
    if (action === 'return' && this.pendingReplacement() && !this.replacementStateId()) { this.actionError.set('Selecciona el destino del dispositivo anterior.'); return; }
    if (action === 'return' && this.pendingReplacement() && this.item()?.simAsociada && this.pendingSimDelivered() === null) { this.actionError.set('Indica si la SIM también fue entregada físicamente.'); return; }
    if (action === 'return' && this.pendingReplacement() && this.replacementRequiresBajaReason() && !this.replacementBajaMotivo()) { this.actionError.set('Selecciona el motivo de baja.'); return; }
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
    if (action === 'assign-person' && this.assignmentResolution() === 'REPLACE') {
      this.executeGeneralReplacement(value, actor);
      return;
    }
    const common = { responsable: actor.nombre, observaciones: value.observaciones.trim() || null };
    let request: Observable<Dispositivo|OrdenServicio|ResultadoDevolucion|ReemplazoDispositivo>;
    if (action === 'assign-person') request = this.service.asignarColaborador(this.codigo, { ...common, colaboradorId: Number(value.colaboradorId), ...(deliveryPhoneValue && this.item() && canDeviceCarrySim(this.item()!) ? { numeroTelefonico: deliveryPhoneValue } : {}), ...(this.jointDelivery() && this.selectedSim() ? { simCodigoInventario: this.selectedSim()!.codigoInventario } : {}) });
    else if (action === 'assign-department') request = this.service.asignarDepartamento(this.codigo, { ...common, departamentoId: Number(value.departamentoId),recibidoPorId:Number(value.recibidoPorId), localidad: value.localidad.trim() || null, ubicacionDetalle: value.ubicacionDetalle.trim() || null });
    else if (action === 'return' && this.pendingReplacement()) request = this.replacements.recibir(this.pendingReplacement()!.id, { destinoDispositivoAnterior: this.replacementStates().find(state => state.id === this.replacementStateId())!.codigo as 'DISPONIBLE' | 'RETENIDO_REVISION' | 'DADO_BAJA', ...(this.item()?.simAsociada ? { simEntregada: this.pendingSimDelivered() === true } : {}), ...(this.replacementRequiresBajaReason() ? { motivoBaja: this.replacementBajaMotivo() as import('../../core/models/itam.models').MotivoBaja } : {}), responsable: actor.nombre, observaciones: value.observaciones.trim() || null });
    else if (action === 'return') request = this.service.devolver(this.codigo, common);
    else if(action==='service')request=this.technicalService.crear({dispositivoCodigo:this.codigo,proveedor:value.proveedor.trim()||null,areaSolicitante:value.areaSolicitante.trim()||this.item()?.departamento?.nombre||'Area TI - Aguas San Isidro',contactoServicio:value.contactoServicio.trim()||null,fechaEnvio:value.fechaEnvio||null,tipoServicio:value.tipoServicio as 'GARANTIA'|'REPARACION'|'MANTENCION'|'DIAGNOSTICO',fallaReportada:value.fallaReportada.trim(),accesoriosEntregados:value.accesoriosEntregados.trim()||null,observaciones:value.observaciones.trim()||null,responsable:actor.nombre});
    else if(action==='retire')request=this.service.darBaja(this.codigo,{...common,motivo:value.motivoBaja as import('../../core/models/itam.models').MotivoBaja});
    else request = this.service.cambiarEstado(this.codigo, { ...common, estadoId: Number(value.estadoId), ...(action === 'recover' ? { recuperar: true, motivoRecuperacion: value.motivoRecuperacion.trim() } : {}), ...(action === 'state' && this.isReportingSmartphoneLost() ? { accionLineaExtravio: value.accionLineaExtravio as import('../../core/models/itam.models').AccionLineaExtravio } : {}) });
    this.submitting.set(true); this.actionError.set(''); this.actionErrorTitle.set('');
    request.subscribe({
      next: (result: any) => {
        if(action==='service'&&'entregasTemporales' in result){
          const order=result;
          this.activeServiceOrder.set(order); this.action.set(null); this.submitting.set(false); this.showFeedback({type:'success',title:'Equipo enviado a servicio técnico',detail:'La orden de trabajo fue registrada correctamente y el PDF quedó disponible.'}); this.toast.success('Equipo enviado a servicio técnico','La orden de trabajo fue registrada correctamente y el PDF quedó disponible.'); this.load(); return;
          return;
        }
        this.action.set(null);
        this.submitting.set(false);
        if ('codigoInventario' in result && action === 'assign-person' && canDeviceCarrySim(result) && deliveryPhoneValue) {
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
import type { WritableSignal } from '@angular/core';
