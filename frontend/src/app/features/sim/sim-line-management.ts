import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, input, output, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { LineaMovilLookup, Sim, SimLineaHistorial } from '../../core/models/itam.models';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { SimService } from '../../core/services/sim.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { errorMessage } from '../../shared/utils/error-message';

type NumberMode = 'KEEP' | 'CHANGE';
type SimMode = 'KEEP' | 'EXISTING' | 'NEW';
type LookupState = 'idle' | 'checking' | 'available' | 'found' | 'conflict';

const phoneDigits = (value: string): string => value.trim().replace(/\D/g, '');

export const normalizeChileanPhone = (value: string): string | null => {
  const digits = phoneDigits(value);
  if (!/^(?:\d{9}|56\d{9})$/.test(digits)) return null;
  return digits.length === 9 ? `56${digits}` : digits;
};

export const normalizeIccidSearch = (value: string): string => value.trim().replace(/[\s-]/g, '');

export const isValidIccidSearch = (value: string): boolean =>
  /^\d{19,20}$/.test(normalizeIccidSearch(value));

export const formatPhoneSearch = (value: string): string => {
  const digits = phoneDigits(value).slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.startsWith('56')) {
    const rest = digits.slice(2);
    if (rest.length <= 1) return `+56 ${rest}`;
    if (rest.length <= 5) return `+56 ${rest.slice(0, 1)} ${rest.slice(1)}`;
    return `+56 ${rest.slice(0, 1)} ${rest.slice(1, 5)} ${rest.slice(5, 9)}`.trim();
  }
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 1)} ${digits.slice(1, 5)} ${digits.slice(5, 9)}`;
};

export const canSelectExistingSim = (
  candidate: Pick<Sim, 'codigoInventario' | 'estado' | 'dispositivo' | 'colaborador'>,
  currentCode: number
): boolean => candidate.codigoInventario !== currentCode
  && candidate.estado.codigo === 'DISPONIBLE'
  && !candidate.dispositivo
  && !candidate.colaborador;

export const findPhoneMatch = (sims: readonly Sim[], value: string): Sim | null => {
  const normalized = normalizeChileanPhone(value);
  return normalized ? sims.find(candidate => phoneOf(candidate) === normalized) ?? null : null;
};

export const simSearchMatches = (sims: readonly Sim[], value: string, limit = 8): Sim[] => {
  const query = value.trim().toLocaleLowerCase('es');
  if (!query) return [];
  const iccid = normalizeIccidSearch(query);
  return sims.filter(candidate =>
    String(candidate.codigoInventario).includes(query.replace(/\D/g, ''))
    || Boolean(iccid && normalizeIccidSearch(candidate.iccidCodigoFabrica || '').includes(iccid))
    || (candidate.iccidCodigoFabrica || '').toLocaleLowerCase('es').includes(query)
  ).slice(0, limit);
};

export const requiresAtomicBackendOperation = (changeNumber: boolean, changeSim: boolean): boolean =>
  changeNumber && changeSim;

export const canStartLineSimOperation = (submitting: boolean): boolean => !submitting;

export const buildAtomicLineSimIntent = (
  numberMode: NumberMode,
  simMode: SimMode,
  normalizedNumber: string | null,
  selectedSimCode: string
) => ({
  mantenerNumero: numberMode === 'KEEP',
  mantenerSim: simMode === 'KEEP',
  numeroNuevo: numberMode === 'CHANGE' ? normalizedNumber : null,
  simDestinoCodigo: simMode === 'EXISTING' || simMode === 'NEW' && selectedSimCode
    ? Number(selectedSimCode)
    : null
});

export const iccidLabel = (sim: Pick<Sim, 'iccidCodigoFabrica'>): string =>
  sim.iccidCodigoFabrica || 'Pendiente de validación';

const phoneOf = (sim: Sim | null | undefined): string | null =>
  sim?.lineaMovil?.numeroTelefonico ? normalizeChileanPhone(sim.lineaMovil.numeroTelefonico) : null;

@Component({
  selector: 'app-sim-line-management',
  imports: [DatePipe],
  template: `
    <section class="card sim-line-panel">
      <div class="panel-heading">
        <div><span class="eyebrow">GESTIÓN OPERATIVA</span><h3>Gestionar línea / SIM</h3><p>Primero identifica el número y luego confirma la tarjeta física que quedará instalada.</p></div>
        @if (sim().lineaMovil) { <button class="btn btn--secondary btn--small" type="button" (click)="open()">Editar asociación</button> }
      </div>
      @if (notice()) { <div class="notice notice--success">{{ notice() }}</div> }
      <div class="sim-line-summary">
        <div><span>Número oficial</span><strong>{{ sim().lineaMovil?.numeroTelefonico || 'Sin línea asociada' }}</strong><small>{{ sim().lineaMovil?.estado || 'Estado no aplica' }}</small></div>
        <div><span>SIM física</span><strong>ITAM {{ sim().codigoInventario }}</strong><small>Estado: {{ sim().estado.nombre }}</small></div>
        <div><span>ICCID</span><strong class="mono">{{ iccidLabel(sim()) }}</strong><small>{{ sim().compania || 'Compañía no informada' }}</small></div>
      </div>
      @if (!sim().lineaMovil) { <p class="empty-state">Sin línea asociada. Puedes registrar una línea desde este panel cuando exista un dispositivo compatible.</p> }
      @if (auth.user()?.rol !== 'SOLO_LECTURA') {
        <div class="panel-actions">
          <button class="btn btn--primary btn--small" type="button" (click)="open()">Gestionar línea / SIM</button>
          @if (sim().lineaMovil) { <button class="btn btn--danger btn--small" type="button" (click)="detach()" [disabled]="submitting()">Desasociar línea</button> }
        </div>
      }
    </section>

    <section class="card history-card">
      <h3>Historial de líneas</h3>
      @if (!lineHistory().length) { <p class="text-muted">Todavía no existen asociaciones históricas registradas.</p> }
      @else { <div class="timeline">@for (entry of lineHistory(); track entry.id) {
        <div class="timeline-item"><strong>{{ entry.numeroTelefonico }}</strong>
          <p>{{ entry.fechaInicio | date:'dd-MM-yyyy HH:mm' }} → {{ entry.fechaFin ? (entry.fechaFin | date:'dd-MM-yyyy HH:mm') : 'Asociación activa' }}</p>
          <p>{{ entry.motivo }} · Usuario {{ entry.usuarioId || 'no disponible' }}</p>
          @if (!entry.fechaFin) { <span class="history-active">ACTIVA</span> }
        </div>
      }</div> }
    </section>

    @if (opened()) { <div class="dialog-backdrop" (click)="closeBackdrop($event)"><form class="dialog line-dialog" (ngSubmit)="save()">
      <div class="dialog-header"><div><span class="eyebrow">OPERACIÓN SIM / LÍNEA</span><h2>Gestionar línea / SIM</h2><p>La fuente oficial del número es la línea móvil. La SIM solo representa la tarjeta física.</p></div><button class="icon-button" type="button" (click)="close()" aria-label="Cerrar">×</button></div>
      @if (error()) { <div class="notice notice--error">{{ error() }}</div> }
      @if (catalogLoading()) { <div class="notice notice--info">Cargando datos actuales de líneas y SIM…</div> }

      <section class="operation-step">
        <div class="step-heading"><span>1</span><div><h3>Número telefónico</h3><p>Busca por el número que debe conservarse o registrarse.</p></div></div>
        <label for="line-number-search">Número telefónico</label>
        <input id="line-number-search" type="tel" autocomplete="off" placeholder="+56 9 9746 4529" [value]="phoneQuery()" (input)="numberChanged($any($event.target).value)" [disabled]="submitting()" />
        @if (phoneLookupState() === 'checking') { <p class="lookup-message">Comprobando número…</p> }
        @if (phoneLookupState() === 'available') { <p class="lookup-message lookup-message--success">✓ Número disponible. Se registrará como una nueva línea móvil.</p> }
        @if (phoneLineMatch(); as match) {
          <div class="lookup-context" [class.lookup-context--warning]="phoneConflict()">
            <strong>{{ phoneConflict() ? 'Este número ya está registrado en otro contexto' : 'Línea encontrada' }}</strong>
            <span>Número: {{ match.numeroTelefonico }}</span>
            <span>Estado: {{ match.estado }}</span>
            <span>SIM asociada: {{ match.sim ? ('ITAM ' + match.sim.codigoInventario + ' · ICCID ' + (match.sim.iccid || 'Pendiente')) : 'Ninguna' }}</span>
            <span>Equipo: {{ match.dispositivo ? ('ITAM ' + match.dispositivo.codigoInventario + ' · ' + (match.dispositivo.tipo || '')) : 'Sin equipo asociado' }}</span>
            <span>Colaborador: {{ match.colaborador?.nombre || 'Sin custodio personal' }}{{ match.departamento ? (' · Departamento ' + match.departamento.nombre) : '' }}</span>
            @if (phoneConflict()) {
              <div class="context-actions"><button class="btn btn--secondary btn--small" type="button" (click)="useAnotherNumber()">Utilizar otro número</button><button class="btn btn--ghost btn--small" type="button" (click)="close()">Cancelar</button></div>
            }
          </div>
        }
        @if (phoneQuery() && !normalizedNewNumber() && phoneLookupState() !== 'checking') { <p class="lookup-message lookup-message--error">Ingresa un número chileno válido de 9 dígitos.</p> }
      </section>

      <section class="operation-step">
        <div class="step-heading"><span>2</span><div><h3>SIM física</h3><p>Busca por código ITAM o ICCID. Se muestran como máximo 8 resultados.</p></div></div>
        <div class="current-selection"><small>SIM actualmente seleccionada</small><strong>ITAM {{ sim().codigoInventario }}</strong><span>ICCID {{ iccidLabel(sim()) }} · {{ sim().compania || 'Compañía no informada' }}</span></div>
        <label for="sim-search">Buscar SIM por código ITAM o ICCID</label>
        <input id="sim-search" type="search" autocomplete="off" placeholder="ITAM 2027 o 8956…" [value]="simQuery()" (input)="simSearchChanged($any($event.target).value)" [disabled]="submitting()" />
        @if (selectedSim(); as selected) { <div class="selected-sim"><div><strong>ITAM {{ selected.codigoInventario }}</strong><span>ICCID {{ iccidLabel(selected) }} · {{ selected.compania || 'Compañía no informada' }}</span></div><button class="btn btn--ghost btn--small" type="button" (click)="clearSelectedSim()">Cambiar</button></div> }
        @if (simLookupState() === 'checking') { <p class="lookup-message">Comprobando ICCID…</p> }
        @if (simSearchResults().length && !selectedSim()) { <div class="sim-results" role="listbox">@for (candidate of simSearchResults(); track candidate.id) {
          <div class="sim-result" [class.sim-result--blocked]="!isSelectable(candidate)">
            <div><strong>ITAM {{ candidate.codigoInventario }}</strong><span>ICCID {{ iccidLabel(candidate) }} · {{ candidate.compania || 'Sin compañía' }}</span><span>Línea: {{ candidate.lineaMovil?.numeroTelefonico || 'Sin línea asociada' }} · Equipo: {{ candidate.dispositivo ? ('ITAM ' + candidate.dispositivo.codigoInventario) : 'Sin equipo' }}</span></div>
            @if (isSelectable(candidate)) { <button class="btn btn--secondary btn--small" type="button" (click)="useSim(candidate)">Usar esta SIM</button> }
            @else { <span class="sim-blocked">SIM actualmente asignada · {{ candidate.colaborador?.nombre || candidate.dispositivo ? 'ocupada' : candidate.estado.nombre }}</span> }
          </div>
        }</div> }
        @if (simQuery() && !simSearchResults().length && simLookupState() !== 'checking' && isValidIccidSearch(simQuery()) && !remoteIccidSim()) {
          <div class="lookup-context lookup-context--success"><strong>✓ No encontramos esta SIM en ITAM.</strong><span>ICCID: {{ normalizeIccidSearch(simQuery()) }}</span><button class="btn btn--secondary btn--small" type="button" (click)="startInlineRegistration()">+ Registrar esta SIM</button></div>
        }
        @if (remoteIccidSim(); as existingIccid) { <div class="lookup-context lookup-context--warning"><strong>⚠ Esta SIM ya existe como ITAM {{ existingIccid.codigoInventario }}</strong><span>ICCID {{ iccidLabel(existingIccid) }} · {{ existingIccid.estado.nombre }}</span><button class="btn btn--secondary btn--small" type="button" (click)="useSim(existingIccid)">Usar SIM existente</button></div> }
        @if (simMode() === 'NEW') {
          <button class="btn btn--ghost btn--small line-mode-button" type="button" (click)="chooseNoLine()">{{ withoutLine() ? 'Usar un número / línea' : 'Registrar SIM nueva sin línea' }}</button>
          <div class="inline-registration">
            <div><strong>Registrar nueva SIM</strong><span>El código ITAM se generará automáticamente al confirmar.</span></div>
            <label for="new-sim-iccid">ICCID *</label><input id="new-sim-iccid" type="text" [value]="newSimIccid()" (input)="newSimIccidChanged($any($event.target).value)" [disabled]="submitting()" maxlength="24" />
            <label for="new-sim-company">Compañía *</label><select id="new-sim-company" [value]="newSimCompany()" (change)="newSimCompany.set($any($event.target).value)" [disabled]="submitting()"><option value="">Seleccionar compañía</option><option>Claro</option><option>Entel</option><option>Movistar</option><option>WOM</option><option>Otro</option></select>
            @if (newSimCompany() === 'Otro') { <input type="text" placeholder="Escribe la compañía" [value]="newSimOtherCompany()" (input)="newSimOtherCompany.set($any($event.target).value)" [disabled]="submitting()" /> }
            <label for="new-sim-notes">Observaciones</label><textarea id="new-sim-notes" rows="2" [value]="newSimObservations()" (input)="newSimObservations.set($any($event.target).value)" [disabled]="submitting()"></textarea>
          </div>
        }
      </section>

      <section class="operation-step result-step">
        <div class="step-heading"><span>3</span><div><h3>Resultado de la operación</h3><p>Revisa el efecto antes de confirmar.</p></div></div>
        <div class="result-summary"><div><small>EQUIPO</small><strong>{{ sim().dispositivo ? ('ITAM ' + sim().dispositivo!.codigoInventario) : 'Sin equipo asociado' }}</strong></div><div><small>NÚMERO</small><strong>{{ withoutLine() ? 'Sin línea' : normalizedNewNumber() || 'Sin línea' }}</strong><span>{{ withoutLine() ? 'No se creará línea' : numberMode() === 'KEEP' ? 'Se conservará' : normalizedNewNumber() ? 'Se registrará / actualizará' : 'Requiere un número válido' }}</span></div><div><small>SIM</small><strong>{{ simMode() === 'NEW' ? 'Nueva SIM' : simMode() === 'EXISTING' ? ('ITAM ' + (selectedSim()?.codigoInventario || '—')) : ('ITAM ' + sim().codigoInventario) }}</strong><span>{{ simMode() === 'NEW' ? 'Se registrará y recibirá código automático' : simMode() === 'EXISTING' ? 'Se asociará al equipo' : 'Se conservará' }}</span></div></div>
      </section>

      <div class="form-actions"><button class="btn btn--secondary" type="button" (click)="close()">Cancelar</button><button class="btn btn--primary" type="submit" [disabled]="!canSubmit()">{{ submitting() ? 'Procesando…' : finalButtonLabel() }}</button></div>
    </form></div> }
  `,
  styles: [`
    .sim-line-panel,.history-card{margin-top:1rem;padding:1.3rem}.panel-heading{align-items:start;display:flex;gap:1rem;justify-content:space-between}.panel-heading h3,.history-card h3{margin:.15rem 0 .35rem}.panel-heading p{color:var(--color-muted);font-size:.82rem;margin:0}.eyebrow{color:var(--color-primary);font-size:.58rem;font-weight:850;letter-spacing:.1em}.sim-line-summary{display:grid;gap:.7rem;grid-template-columns:repeat(3,1fr);margin-top:1rem}.sim-line-summary>div,.current-selection{background:#f5f8f8;border-radius:.65rem;padding:.8rem}.sim-line-summary span,.sim-line-summary strong,.sim-line-summary small{display:block}.sim-line-summary span{color:var(--color-muted);font-size:.68rem;font-weight:750;text-transform:uppercase}.sim-line-summary strong{margin:.3rem 0}.sim-line-summary small{color:var(--color-muted)}.mono{font-family:var(--font-mono);overflow-wrap:anywhere}.panel-actions,.context-actions,.form-actions{display:flex;flex-wrap:wrap;gap:.6rem;margin-top:1rem}.empty-state,.text-muted{color:var(--color-muted);font-size:.85rem}.history-active{color:var(--color-primary);font-size:.68rem;font-weight:800}.line-dialog{max-height:calc(100vh - 2rem);max-width:48rem;overflow:auto}.dialog-header{align-items:flex-start;display:flex;gap:1rem;justify-content:space-between}.dialog-header h2{margin:.15rem 0 .35rem}.dialog-header p{color:var(--color-muted);font-size:.78rem;margin:0}.operation-step{border-top:1px solid var(--gray-200);display:grid;gap:.5rem;margin-top:1rem;padding-top:1rem}.step-heading{align-items:flex-start;display:flex;gap:.65rem;margin-bottom:.2rem}.step-heading>span{align-items:center;background:var(--cyan-soft);border-radius:50%;color:var(--blue);display:flex;font-size:.72rem;font-weight:850;height:1.5rem;justify-content:center;width:1.5rem}.step-heading h3{font-size:.9rem;margin:0}.step-heading p{color:var(--color-muted);font-size:.7rem;margin:.12rem 0 0}.operation-step label{font-size:.72rem;font-weight:750}.operation-step input:not([type=radio]),.operation-step select,.operation-step textarea{width:100%}.lookup-message{color:var(--color-muted);font-size:.7rem;margin:0}.lookup-message--success{color:#15803d}.lookup-message--error{color:#b91c1c}.lookup-context,.selected-sim,.sim-result,.inline-registration,.result-summary{background:#f8fafc;border:1px solid var(--gray-200);border-radius:.7rem;padding:.7rem}.lookup-context{display:grid;gap:.2rem}.lookup-context strong{font-size:.75rem}.lookup-context span,.sim-result span,.selected-sim span,.inline-registration span,.result-summary span{color:var(--color-muted);font-size:.68rem}.lookup-context--warning{background:#fff7ed;border-color:#fed7aa}.lookup-context--success{background:#f0fdf4;border-color:#bbf7d0}.current-selection{display:grid;gap:.18rem}.current-selection small,.result-summary small{color:var(--blue);font-size:.58rem;font-weight:850;letter-spacing:.05em}.current-selection span{color:var(--color-muted);font-size:.68rem}.sim-results{display:grid;gap:.45rem;max-height:15rem;overflow:auto}.sim-result{align-items:center;display:flex;gap:.7rem;justify-content:space-between}.sim-result>div{display:grid;gap:.14rem;min-width:0}.sim-result strong,.selected-sim strong{font-size:.74rem}.sim-result--blocked{background:#fff7ed;border-color:#fed7aa}.sim-blocked{color:#b45309!important;font-size:.62rem!important;text-align:right}.selected-sim{align-items:center;display:flex;justify-content:space-between}.selected-sim>div{display:grid;gap:.18rem}.inline-registration{display:grid;gap:.45rem;background:#eff6ff;border-color:#bfdbfe}.inline-registration strong{font-size:.8rem}.result-summary{display:grid;gap:.55rem;grid-template-columns:repeat(3,1fr)}.result-summary>div{display:grid;gap:.16rem}.result-summary strong{font-size:.76rem}.result-step{margin-bottom:.2rem}.form-actions{justify-content:flex-end}.timeline{display:grid;gap:.7rem}.timeline-item{border-left:2px solid var(--gray-200);padding-left:.7rem}.timeline-item strong{font-size:.78rem}.timeline-item p{color:var(--color-muted);font-size:.68rem;margin:.2rem 0}.notice--info{color:var(--blue)}
    @media(max-width:700px){.sim-line-summary,.result-summary{grid-template-columns:1fr}.panel-heading{flex-direction:column}.sim-result{align-items:flex-start;flex-direction:column}.sim-blocked{text-align:left}.line-dialog{max-height:calc(100vh - 1rem)}.form-actions{justify-content:stretch}.form-actions button{flex:1}}
  `],
})
export class SimLineManagement implements OnInit, OnDestroy {
  readonly sim = input.required<Sim>();
  protected readonly iccidLabel = iccidLabel;
  protected readonly isValidIccidSearch = isValidIccidSearch;
  protected readonly normalizeIccidSearch = normalizeIccidSearch;
  protected readonly changed = output<void>();
  protected readonly auth = inject(AuthService);
  private readonly service = inject(SimService);
  private readonly devices = inject(DispositivosService);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly opened = signal(false);
  protected readonly numberMode = signal<NumberMode>('KEEP');
  protected readonly simMode = signal<SimMode>('KEEP');
  protected readonly phoneQuery = signal('');
  protected readonly phoneLookupState = signal<LookupState>('idle');
  protected readonly phoneLineMatch = signal<LineaMovilLookup | null>(null);
  protected readonly withoutLine = signal(false);
  protected readonly simQuery = signal('');
  protected readonly simLookupState = signal<LookupState>('idle');
  protected readonly selectedSim = signal<Sim | null>(null);
  protected readonly remoteIccidSim = signal<Sim | null>(null);
  protected readonly newSimIccid = signal('');
  protected readonly newSimCompany = signal('');
  protected readonly newSimOtherCompany = signal('');
  protected readonly newSimObservations = signal('');
  protected readonly allSims = signal<Sim[]>([]);
  protected readonly catalogLoading = signal(false);
  protected readonly lineHistory = signal<SimLineaHistorial[]>([]);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  private phoneLookupTimer: ReturnType<typeof setTimeout> | null = null;
  private iccidLookupTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() { this.loadHistory(); }

  ngOnDestroy() {
    if (this.phoneLookupTimer) clearTimeout(this.phoneLookupTimer);
    if (this.iccidLookupTimer) clearTimeout(this.iccidLookupTimer);
  }

  protected normalizedNewNumber() { return normalizeChileanPhone(this.phoneQuery()); }

  protected simSearchResults(): Sim[] {
    return this.selectedSim() ? [] : simSearchMatches(this.allSims(), this.simQuery());
  }

  protected isSelectable(candidate: Sim) { return canSelectExistingSim(candidate, this.sim().codigoInventario); }

  protected hasChanges() { return this.numberMode() === 'CHANGE' || this.simMode() !== 'KEEP'; }

  protected finalButtonLabel() {
    if (this.simMode() === 'NEW') return 'Registrar SIM y asociar';
    if (this.simMode() === 'EXISTING') return this.numberMode() === 'CHANGE' ? 'Asociar SIM y línea' : 'Asociar SIM';
    return this.numberMode() === 'CHANGE' ? 'Actualizar número' : 'Confirmar cambios';
  }

  protected open() {
    this.error.set('');
    this.notice.set('');
    this.numberMode.set('KEEP');
    this.simMode.set('KEEP');
    this.phoneQuery.set(this.sim().lineaMovil?.numeroTelefonico || '');
    this.phoneLookupState.set(this.sim().lineaMovil ? 'found' : 'idle');
    this.phoneLineMatch.set(null);
    this.withoutLine.set(false);
    this.simQuery.set('');
    this.selectedSim.set(null);
    this.remoteIccidSim.set(null);
    this.newSimIccid.set('');
    this.newSimCompany.set('');
    this.newSimOtherCompany.set('');
    this.newSimObservations.set('');
    this.opened.set(true);
    this.loadCatalog();
  }

  protected close() { if (!this.submitting()) this.opened.set(false); }

  protected closeBackdrop(event: MouseEvent) { if (event.target === event.currentTarget) this.close(); }

  protected numberChanged(value: string) {
    const formatted = formatPhoneSearch(value);
    this.phoneQuery.set(formatted);
    this.withoutLine.set(false);
    const normalized = normalizeChileanPhone(formatted);
    const current = phoneOf(this.sim());
    this.numberMode.set(normalized && normalized === current ? 'KEEP' : 'CHANGE');
    this.phoneLineMatch.set(null);
    this.phoneLookupState.set(normalized ? 'checking' : 'idle');
    if (this.phoneLookupTimer) clearTimeout(this.phoneLookupTimer);
    this.phoneLookupTimer = setTimeout(() => this.lookupNumber(), 350);
  }

  protected useAnotherNumber() {
    this.phoneQuery.set('');
    this.phoneLineMatch.set(null);
    this.withoutLine.set(false);
    this.phoneLookupState.set('idle');
    this.numberMode.set('CHANGE');
  }

  protected chooseNoLine() {
    this.withoutLine.set(!this.withoutLine());
    if (this.withoutLine()) {
      this.phoneQuery.set('');
      this.phoneLineMatch.set(null);
      this.phoneLookupState.set('idle');
      this.numberMode.set('CHANGE');
    } else {
      this.numberMode.set(this.sim().lineaMovil ? 'KEEP' : 'CHANGE');
    }
  }

  protected simSearchChanged(value: string) {
    this.simQuery.set(value);
    this.simMode.set('EXISTING');
    this.selectedSim.set(null);
    this.remoteIccidSim.set(null);
    this.simLookupState.set(isValidIccidSearch(value) ? 'checking' : 'idle');
    if (this.iccidLookupTimer) clearTimeout(this.iccidLookupTimer);
    if (isValidIccidSearch(value)) {
      this.newSimIccid.set(normalizeIccidSearch(value));
      this.iccidLookupTimer = setTimeout(() => this.lookupIccid(), 350);
    }
  }

  protected newSimIccidChanged(value: string) {
    this.newSimIccid.set(value);
    this.simQuery.set(value);
    this.simLookupState.set(isValidIccidSearch(value) ? 'checking' : 'idle');
    if (this.iccidLookupTimer) clearTimeout(this.iccidLookupTimer);
    if (isValidIccidSearch(value)) this.iccidLookupTimer = setTimeout(() => this.lookupIccid(), 350);
  }

  protected startInlineRegistration() {
    this.newSimIccid.set(normalizeIccidSearch(this.simQuery()));
    this.newSimCompany.set('');
    this.newSimOtherCompany.set('');
    this.newSimObservations.set('');
    this.simMode.set('NEW');
    this.selectedSim.set(null);
    this.error.set('');
  }

  protected useSim(candidate: Sim) {
    if (!this.isSelectable(candidate)) return;
    this.selectedSim.set(candidate);
    this.simMode.set('EXISTING');
    this.simQuery.set(`ITAM ${candidate.codigoInventario}`);
    this.simLookupState.set('found');
    this.error.set('');
  }

  protected clearSelectedSim() {
    this.selectedSim.set(null);
    this.simQuery.set('');
    this.simLookupState.set('idle');
  }

  protected canSubmit() {
    if (this.submitting() || !this.hasChanges() || this.catalogLoading()) return false;
    if (this.phoneConflict()) return false;
    if (this.numberMode() === 'CHANGE' && !this.normalizedNewNumber() && !(this.simMode() === 'NEW' && this.withoutLine())) return false;
    if (this.simMode() === 'EXISTING' && (!this.selectedSim() || !this.isSelectable(this.selectedSim()!))) return false;
    if (this.simMode() === 'NEW' && (!isValidIccidSearch(this.newSimIccid()) || !this.companyValue())) return false;
    return true;
  }

  protected async detach() {
    if (!this.sim().lineaMovil || !(await this.confirmation.confirm('La SIM quedará sin línea asociada. La línea móvil no será eliminada.', { title: 'Desasociar línea', confirmLabel: 'Desasociar' }))) return;
    this.submitting.set(true);
    this.service.desasociarLinea(this.sim().codigoInventario, { responsable: this.auth.user()?.nombre || 'Usuario autenticado' }).subscribe({ next: () => { this.submitting.set(false); this.changed.emit(); this.loadHistory(); }, error: error => this.fail(error) });
  }

  protected save() {
    if (!canStartLineSimOperation(this.submitting())) return;
    this.error.set('');
    if (!this.hasChanges()) { this.notice.set('No existen cambios para guardar.'); this.close(); return; }
    if (this.phoneConflict()) { this.error.set('Ese número ya pertenece a otro equipo o SIM. Elige otro número antes de continuar.'); return; }
    if (this.numberMode() === 'CHANGE' && !this.normalizedNewNumber() && !(this.simMode() === 'NEW' && this.withoutLine())) { this.error.set('Ingresa un número telefónico chileno válido.'); return; }
    if (this.simMode() === 'EXISTING' && (!this.selectedSim() || !this.isSelectable(this.selectedSim()!))) { this.error.set('Selecciona una SIM disponible y sin custodia.'); return; }
    if (this.simMode() === 'NEW' && (!isValidIccidSearch(this.newSimIccid()) || !this.companyValue())) { this.error.set('Completa un ICCID válido y la compañía de la SIM nueva.'); return; }

    const deviceCode = this.sim().dispositivo?.codigoInventario;
    const normalizedNumber = this.normalizedNewNumber();
    if (!deviceCode) {
      if (this.numberMode() === 'CHANGE' && this.simMode() === 'KEEP') {
        this.submitting.set(true);
        this.service.actualizar(this.sim().codigoInventario, { numeroAsociado: normalizedNumber }).subscribe({ next: () => this.refreshAfterSuccess('Número actualizado correctamente.'), error: error => this.fail(error) });
        return;
      }
      this.error.set('La asociación de una SIM nueva o existente requiere que la SIM actual esté instalada en un dispositivo.');
      return;
    }

    if (this.simMode() === 'NEW') {
      this.submitting.set(true);
      const accionLinea = this.withoutLine()
        ? 'SIN_LINEA' as const
        : this.phoneLineMatch()
          ? 'USAR_LINEA_EXISTENTE' as const
          : 'CREAR_LINEA_NUEVA' as const;
      this.devices.registrarSimNueva(deviceCode, {
        iccidCodigoFabrica: normalizeIccidSearch(this.newSimIccid()),
        compania: this.companyValue(),
        observaciones: this.newSimObservations().trim() || null,
        accionLinea,
        lineaMovilId: accionLinea === 'USAR_LINEA_EXISTENTE' ? Number(this.phoneLineMatch()!.id) : null,
        numeroNuevo: accionLinea === 'CREAR_LINEA_NUEVA' ? normalizedNumber : null
      }).subscribe({
        next: () => this.refreshAfterSuccess('SIM registrada y asociada correctamente.'),
        error: error => this.fail(error)
      });
      return;
    }

    this.submitting.set(true);
    this.runAtomic(deviceCode, this.selectedSim()?.codigoInventario ?? null, normalizedNumber);
  }

  private runAtomic(deviceCode: number, simCode: number | null, normalizedNumber: string | null) {
    const intent = buildAtomicLineSimIntent(
      this.numberMode(),
      this.simMode() === 'NEW' || this.simMode() === 'EXISTING' ? 'EXISTING' : 'KEEP',
      normalizedNumber,
      simCode ? String(simCode) : ''
    );
    this.devices.gestionarLineaSim(deviceCode, { ...intent, observaciones: 'Gestión desde panel SIM / línea' }).subscribe({ next: () => this.refreshAfterSuccess('Línea y SIM actualizadas correctamente.'), error: error => this.fail(error) });
  }

  private lookupNumber() {
    const normalized = this.normalizedNewNumber();
    if (!normalized) { this.phoneLookupState.set('idle'); this.phoneLineMatch.set(null); return; }
    this.phoneLookupState.set('checking');
    this.service.buscarLineaPorNumero(normalized).subscribe({
      next: line => { this.phoneLineMatch.set(line); this.phoneLookupState.set(this.lineBelongsToCurrentDevice(line) ? 'found' : line.dispositivo ? 'conflict' : 'found'); },
      error: error => {
        if ((error as { status?: number })?.status === 404) { this.phoneLineMatch.set(null); this.phoneLookupState.set('available'); return; }
        this.fail(error);
      }
    });
  }

  protected phoneConflict() {
    const line = this.phoneLineMatch();
    return !!line?.dispositivo && !this.lineBelongsToCurrentDevice(line);
  }

  private lineBelongsToCurrentDevice(line: LineaMovilLookup) {
    return line.dispositivo?.id === this.sim().dispositivo?.id || line.sim?.id === this.sim().id;
  }

  private lookupIccid() {
    const iccid = normalizeIccidSearch(this.simMode() === 'NEW' ? this.newSimIccid() : this.simQuery());
    if (!isValidIccidSearch(iccid)) { this.simLookupState.set('idle'); return; }
    this.service.buscarPorIccid(iccid).subscribe({
      next: found => { this.remoteIccidSim.set(found); this.simLookupState.set('found'); },
      error: error => {
        if ((error as { status?: number })?.status === 404) { this.remoteIccidSim.set(null); this.simLookupState.set('available'); return; }
        this.fail(error);
      }
    });
  }

  private loadCatalog() {
    this.catalogLoading.set(true);
    this.service.listar().subscribe({ next: sims => { this.allSims.set(sims); this.catalogLoading.set(false); }, error: error => { this.catalogLoading.set(false); this.fail(error); } });
  }

  private companyValue(): string {
    return this.newSimCompany() === 'Otro' ? this.newSimOtherCompany().trim() : this.newSimCompany();
  }

  private loadHistory() { this.service.historialLineas(this.sim().codigoInventario).subscribe({ next: history => this.lineHistory.set(history), error: error => this.fail(error) }); }

  private refreshAfterSuccess(message: string) {
    forkJoin({ history: this.service.historialLineas(this.sim().codigoInventario) }).subscribe({ next: ({ history }) => this.lineHistory.set(history), error: () => undefined });
    this.submitting.set(false); this.opened.set(false); this.notice.set(message); this.changed.emit();
  }

  private fail(error: unknown) {
    const raw = typeof error === 'string' ? error : errorMessage(error);
    const lower = raw.toLowerCase();
    const message = lower.includes('número') || lower.includes('numero')
      ? 'El número ya está utilizado por otra línea.'
      : lower.includes('dada de baja')
        ? 'La SIM seleccionada está dada de baja.'
        : lower.includes('extraviada')
          ? 'La SIM seleccionada está marcada como extraviada.'
          : lower.includes('instalada') || lower.includes('otra línea') || lower.includes('otra custodia')
            ? 'La SIM seleccionada ya está asociada a otro dispositivo o línea.'
            : lower.includes('sql') || lower.includes('stack')
              ? 'Ocurrió un error al actualizar la línea y la SIM.'
              : raw;
    this.error.set(message); this.submitting.set(false);
  }
}
