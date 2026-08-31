import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideDownload, LucideExternalLink, LucideFileText, LucideMapPin, LucidePackagePlus, LucideSave, LucideTrash2 } from '@lucide/angular';
import { forkJoin, map, of, switchMap } from 'rxjs';
import { CampoEspecificoFormulario, Dispositivo, FacturaDocumento, TipoDispositivo } from '../../core/models/itam.models';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { AuthService } from '../../core/services/auth.service';
import { FacturasAdquisicionService } from '../../core/services/facturas-adquisicion.service';
import { TiposDispositivoService } from '../../core/services/tipos-dispositivo.service';
import { AssetCreatedDialog } from '../../shared/components/asset-created-dialog/asset-created-dialog';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

export const COMMERCIAL_VALUE_PATTERN = /^\d+$/;

export const allowsDeviceCreation = (type: TipoDispositivo): boolean =>
  type.activo && !!type.familiaCodigoInventario?.activo;

export const requiresImei = (type: TipoDispositivo | null): boolean =>
  type?.requiereImei ?? false;

export const assetFieldVisibility = (type: TipoDispositivo | null) => ({
  marca: type?.configuracionFormulario.mostrarMarca ?? false,
  modelo: type?.configuracionFormulario.mostrarModelo ?? false,
  numeroSerie: type?.configuracionFormulario.mostrarNumeroSerie ?? false,
  imei: requiresImei(type),
  camposEspecificos: type?.configuracionFormulario.camposEspecificos ?? []
});

export const operationalTypeOptions = (
  types: TipoDispositivo[],
  existingTypeId = ''
): { value: string; label: string }[] => {
  const selectable = (type: TipoDispositivo) => allowsDeviceCreation(type) || type.id === existingTypeId;
  const direct = types.filter((type) => selectable(type) && !type.familiaCodigoInventario?.agrupaTipos)
    .map((type) => ({ value: type.id, label: type.nombre }));
  const groups = new Map<string, string>();
  types.filter((type) => selectable(type) && type.familiaCodigoInventario?.agrupaTipos)
    .forEach((type) => { const family = type.familiaCodigoInventario!;
      groups.set(family.id, family.etiquetaOperativa || family.nombre); });
  return [...direct, ...[...groups].map(([id, label]) => ({ value: `group:${id}`, label }))]
    .sort((a, b) => a.label.localeCompare(b.label));
};

export const typesForOperationalGroup = (
  types: TipoDispositivo[],
  familyId: string,
  existingTypeId = ''
): TipoDispositivo[] => types
  .filter((type) => (allowsDeviceCreation(type) || type.id === existingTypeId) && type.familiaCodigoInventario?.id === familyId)
  .sort((a, b) => a.nombre.localeCompare(b.nombre));

@Component({
  selector: 'app-dispositivo-form',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, ViewState,
    AssetCreatedDialog, LucideDownload, LucideExternalLink, LucideFileText,
    LucideMapPin, LucidePackagePlus, LucideSave, LucideTrash2],
  template: `
    <app-page-header [title]="codigo ? 'Editar Equipo' : 'Registrar Nuevo Equipo'"
      subtitle="Seleccione el activo y complete solamente sus datos técnicos disponibles."
      eyebrow="Inventario tecnológico" />
    @if (loading()) {
      <section class="card"><app-view-state kind="loading" title="Cargando formulario" /></section>
    } @else {
      <form class="card form-card equipment-form" [formGroup]="form" (ngSubmit)="submit()">
        <header class="form-section-heading"><span><svg lucidePackagePlus></svg></span><div>
          <h2>Identificación del activo</h2><p>El código ITAM se asigna automáticamente al guardar.</p>
        </div></header>
        @if (apiError()) { <div class="notice notice--error">{{ apiError() }}</div> }
        <div class="form-grid">
          <div class="field"><label>Código ITAM</label><input class="code" value="Se generará automáticamente al guardar" disabled /></div>
          <div class="field"><label for="asset-type">Tipo de activo *</label>
            <select id="asset-type" formControlName="tipoPrincipal" (change)="onPrimarySelection()" [class.invalid]="invalid('tipoPrincipal')">
              <option value="">Seleccionar tipo</option>
              @for (option of primaryOptions(); track option.value) { <option [value]="option.value">{{ option.label }}</option> }
            </select>
            @if (invalid('tipoPrincipal')) { <p class="field-error">Seleccione el tipo de activo.</p> }
          </div>
          @if (selectedGroupFamilyId()) {
            <div class="field span-2"><label for="peripheral-type">Tipo de periférico *</label>
              <select id="peripheral-type" formControlName="tipoDispositivoId" (change)="onConcreteTypeSelection()" [class.invalid]="typeSelectionInvalid()">
                <option value="">Seleccionar periférico</option>
                @for (type of groupedTypes(); track type.id) { <option [value]="type.id">{{ type.nombre }}</option> }
              </select>
              @if (typeSelectionInvalid()) { <p class="field-error">Seleccione el tipo de periférico.</p> }
            </div>
          }
          @if (selectedType()) {
            @if (visibility().marca) { <div class="field"><label for="marca">Marca</label><input id="marca" maxlength="100" formControlName="marca" /></div> }
            @if (visibility().modelo) { <div class="field"><label for="modelo">Modelo</label><input id="modelo" maxlength="150" formControlName="modelo" /></div> }
            @if (visibility().numeroSerie) { <div class="field"><label for="serie">Número de serie</label><input class="code" id="serie" maxlength="150" formControlName="numeroSerie" /></div> }
            @if (visibility().imei) { <div class="field"><label for="imei">IMEI</label><input class="code" id="imei" maxlength="30" formControlName="imei" /></div> }
            @if (selectedType()?.nombre === 'Impresora') { <div class="field"><label for="printer-state">Estado</label><input id="printer-state" value="Disponible (automático)" disabled /></div> }
            <div class="field"><label for="commercial-value">Valor comercial (CLP)</label><input id="commercial-value" type="number" min="0" step="1" formControlName="valorComercial" /><p class="hint">Ingrese solamente el valor numérico, sin puntos ni signo peso.</p>@if(form.controls.valorComercial.invalid&&form.controls.valorComercial.touched){<p class="field-error">Debe ser un valor entero mayor o igual a cero.</p>}</div>
            <ng-container formGroupName="atributosEspecificos">
              @for (field of visibility().camposEspecificos; track field.clave) {
                <div class="field"><label [for]="'specific-' + field.clave">{{ field.etiqueta }}{{ field.requerido ? ' *' : '' }}</label>
                  @switch (field.tipo) {
                    @case ('select') { <select [id]="'specific-' + field.clave" [formControlName]="field.clave"><option value="">Seleccionar</option>@for (option of field.opciones ?? []; track option) { <option [value]="option">{{ option }}</option> }</select> }
                    @case ('number') { <input type="number" [id]="'specific-' + field.clave" [attr.min]="field.min ?? null" [attr.max]="field.max ?? null" [formControlName]="field.clave" /> }
                    @default { <input [id]="'specific-' + field.clave" [attr.maxlength]="field.maxLength ?? 250" [formControlName]="field.clave" /> }
                  }
                  @if (specificInvalid(field)) { <p class="field-error">{{ field.etiqueta }} es obligatorio o contiene un valor inválido.</p> }
                </div>
              }
            </ng-container>
          } @else if (form.controls.tipoPrincipal.value) {
            <div class="selection-hint span-2">Seleccione el tipo específico para continuar.</div>
          }
        </div>
        <header class="form-section-heading form-section-heading--secondary"><span><svg lucidePackagePlus></svg></span><div>
          <h2>Antecedentes de adquisición</h2><p>Metadatos opcionales. ITAM no gestiona el proceso de compra.</p>
        </div></header>
        <div class="form-grid">
          <div class="field"><label for="invoice-number">Número de factura</label><input id="invoice-number" maxlength="80" formControlName="numeroFactura" /></div>
          <div class="field"><label for="invoice-date">Fecha</label><input id="invoice-date" type="date" formControlName="fechaFactura" /></div>
          <div class="field"><label for="supplier">Proveedor</label><input id="supplier" maxlength="180" formControlName="proveedorFactura" /></div>
          <div class="field"><label for="invoice-total">Monto total (CLP)</label><input id="invoice-total" type="number" min="0" step="1" formControlName="montoFactura" /></div>
          <div class="field span-2 invoice-document-field">
            <label for="invoice-document">Documento de factura (opcional)</label>
            <p class="hint">Adjunte una copia digital de la factura en formato PDF o imagen (JPG, JPEG o PNG).</p>
            <input #invoiceFileInput class="file-input" id="invoice-document" type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              (change)="onInvoiceFileSelected($event)" />
            <div class="file-actions">
              <label class="btn btn--secondary btn--small" for="invoice-document"><svg lucideFileText></svg>Seleccionar archivo</label>
              @if(invoiceFile();as file){<span class="selected-file">{{file.name}}</span><button class="btn btn--ghost btn--small" type="button" (click)="removeInvoiceFile(invoiceFileInput)"><svg lucideTrash2></svg>Quitar selección</button>}
            </div>
            @if(existingInvoiceDocument();as document){<div class="existing-document"><span>Documento actual: <strong>{{document.nombreOriginal}}</strong></span><a class="btn btn--ghost btn--small" [href]="facturas.documentoUrl(existingInvoiceId(),false)" target="_blank" rel="noopener"><svg lucideExternalLink></svg>Ver documento</a><a class="btn btn--ghost btn--small" [href]="facturas.documentoUrl(existingInvoiceId(),true)"><svg lucideDownload></svg>Descargar</a></div>}
            @if(invoiceFile()&&existingInvoiceDocument()){<p class="hint">El archivo seleccionado reemplazará al documento actual al guardar correctamente.</p>}
            @if(invoiceFileError()){<p class="field-error">{{invoiceFileError()}}</p>}
            <p class="hint">Formatos permitidos: PDF, JPG, JPEG, PNG. Tamaño máximo: 10 MB.</p>
          </div>
          <div class="field span-2"><label for="invoice-notes">Observaciones de adquisición</label><textarea id="invoice-notes" formControlName="observacionesFactura"></textarea></div>
        </div>

        <header class="form-section-heading form-section-heading--secondary"><span><svg lucideMapPin></svg></span><div>
          <h2>Ubicación y contexto</h2><p>El alta no asigna custodia.</p>
        </div></header>
        <div class="form-grid">
          <div class="field"><label for="localidad">Localidad</label><input id="localidad" maxlength="120" formControlName="localidad" /></div>
          <div class="field"><label for="ubicacion">Ubicación detallada</label><input id="ubicacion" maxlength="250" formControlName="ubicacionDetalle" /></div>
          <div class="field span-2"><label for="observaciones">Observaciones</label><textarea id="observaciones" formControlName="observaciones"></textarea></div>
          @if (!codigo) { <div class="field span-2"><label for="responsable">Responsable del registro *</label><input id="responsable" maxlength="150" formControlName="responsable" readonly [class.invalid]="invalid('responsable')" />@if (invalid('responsable')) { <p class="field-error">El responsable es obligatorio.</p> }</div> }
        </div>
        <div class="form-actions"><a class="btn btn--secondary" [routerLink]="codigo ? ['/dispositivos', codigo] : ['/dispositivos']">Cancelar</a><button class="btn btn--primary" type="submit" [disabled]="submitting()"><svg lucideSave></svg>{{ submitting() ? 'Guardando…' : 'Guardar Equipo' }}</button></div>
      </form>
    }
    @if (created(); as device) { <app-asset-created-dialog [code]="device.codigoInventario" [assetType]="device.tipo.nombre" [detailLink]="['/dispositivos', device.codigoInventario]" [canAssign]="true" (close)="finish(device)" /> }
  `,
  styles: [`.equipment-form{max-width:62rem;padding:0 1.5rem 1.5rem}.form-section-heading{align-items:center;background:linear-gradient(135deg,var(--navy),#07147c);color:#fff;display:flex;gap:.8rem;margin:0 -1.5rem 1.4rem;padding:1.15rem 1.5rem}.form-section-heading>span{align-items:center;background:rgba(0,180,216,.2);border-radius:.7rem;color:var(--cyan);display:flex;height:2.5rem;justify-content:center;width:2.5rem}.form-section-heading svg{height:1.15rem}.form-section-heading h2{font-size:1rem;margin:0}.form-section-heading p{color:#cbd5e1;font-size:.7rem;margin:.2rem 0 0}.form-section-heading--secondary{background:var(--gray-50);border-block:1px solid var(--gray-200);color:var(--navy);margin-top:1.4rem}.form-section-heading--secondary p{color:var(--slate-500)}.form-section-heading--secondary>span{background:var(--cyan-soft);color:var(--blue)}.selection-hint{background:var(--gray-50);border:1px dashed var(--gray-200);border-radius:.75rem;color:var(--slate-500);font-size:.78rem;padding:.9rem}.file-input{clip:rect(0 0 0 0);clip-path:inset(50%);height:1px;overflow:hidden;position:absolute;white-space:nowrap;width:1px}.file-actions,.existing-document{align-items:center;display:flex;flex-wrap:wrap;gap:.6rem}.selected-file{color:var(--slate-700);font-size:.78rem;font-weight:700;overflow-wrap:anywhere}.existing-document{background:var(--gray-50);border:1px solid var(--gray-200);border-radius:.7rem;margin-top:.7rem;padding:.7rem}.existing-document span{font-size:.74rem;margin-right:auto}.invoice-document-field .hint{margin:.25rem 0 .65rem}`]
})
export class DispositivoForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly service = inject(DispositivosService);
  protected readonly facturas = inject(FacturasAdquisicionService);
  private readonly typeService = inject(TiposDispositivoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected codigo = 0;
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly apiError = signal('');
  protected readonly types = signal<TipoDispositivo[]>([]);
  protected readonly editingTypeId = signal('');
  protected readonly created = signal<Dispositivo | null>(null);
  protected readonly invoiceFile = signal<File | null>(null);
  protected readonly invoiceFileError = signal('');
  protected readonly existingInvoiceDocument = signal<FacturaDocumento | null>(null);
  protected readonly existingInvoiceId = signal('');
  protected readonly attributesForm = this.fb.group({ partNumber: [''], tipoCable: [''], longitud: [''], potencia: [''], tipoAdaptador: [''], cantidadPuertos: [''], nombrePeriferico: [''] });
  protected readonly form = this.fb.nonNullable.group({
    tipoPrincipal: ['', Validators.required], tipoDispositivoId: [''], marca: ['', Validators.maxLength(100)], modelo: ['', Validators.maxLength(150)],
    numeroSerie: ['', Validators.maxLength(150)], imei: ['', Validators.maxLength(30)], valorComercial: [0, [Validators.required,Validators.min(0),Validators.pattern(COMMERCIAL_VALUE_PATTERN)]], localidad: ['', Validators.maxLength(120)], ubicacionDetalle: ['', Validators.maxLength(250)],
    observaciones: [''], responsable: ['', [Validators.required, Validators.maxLength(150)]], atributosEspecificos: this.attributesForm,
    numeroFactura:['',Validators.maxLength(80)],fechaFactura:[''],proveedorFactura:['',Validators.maxLength(180)],montoFactura:[0,Validators.min(0)],observacionesFactura:['']
  });
  protected selectedGroupFamilyId(): string {
    const value = this.form.controls.tipoPrincipal.value;
    return value.startsWith('group:') ? value.slice(6) : '';
  }
  protected visibility() { return assetFieldVisibility(this.selectedType()); }

  protected primaryOptions(): { value: string; label: string }[] {
    return operationalTypeOptions(this.types(), this.editingTypeId());
  }
  protected groupedTypes(): TipoDispositivo[] { return typesForOperationalGroup(this.types(), this.selectedGroupFamilyId(), this.editingTypeId()); }
  protected selectedType(): TipoDispositivo | null { const id = this.form.controls.tipoDispositivoId.value; return this.types().find((type) => type.id === id) ?? null; }

  ngOnInit(): void {
    this.codigo = Number(this.route.snapshot.paramMap.get('codigo') || 0); this.form.controls.responsable.setValue(this.auth.user()?.nombre || ''); if (this.codigo) this.form.controls.responsable.clearValidators(); this.loading.set(true);
    forkJoin({ types: this.typeService.listar(this.codigo ? undefined : true), device: this.codigo ? this.service.obtener(this.codigo) : of(null) }).subscribe({
      next: ({ types, device }) => { this.types.set(types); if (device) this.patchDevice(device); this.loading.set(false); },
      error: (error) => { this.apiError.set(errorMessage(error)); this.loading.set(false); }
    });
  }
  private patchDevice(device: Dispositivo): void {
    this.editingTypeId.set(device.tipo.id);
    const grouped = device.tipo.familiaCodigoInventario?.agrupaTipos;
    this.existingInvoiceDocument.set(device.facturaAdquisicion?.documento ?? null);
    this.existingInvoiceId.set(device.facturaAdquisicion?.id ?? '');
    this.form.patchValue({ tipoPrincipal: grouped ? `group:${device.tipo.familiaCodigoInventario!.id}` : device.tipo.id, tipoDispositivoId: device.tipo.id,
      marca: device.marca || '', modelo: device.modelo || '', numeroSerie: device.numeroSerie || '', imei: device.imei || '', localidad: device.localidad || '',
      ubicacionDetalle: device.ubicacionDetalle || '', valorComercial:device.valorComercial, observaciones: device.observaciones || '', atributosEspecificos: Object.fromEntries(Object.entries(device.atributosEspecificos).map(([key, value]) => [key, value === null ? '' : String(value)])),
      numeroFactura:device.facturaAdquisicion?.numeroFactura||'',fechaFactura:device.facturaAdquisicion?.fechaFactura||'',proveedorFactura:device.facturaAdquisicion?.proveedor||'',montoFactura:device.facturaAdquisicion?.montoTotal||0,observacionesFactura:device.facturaAdquisicion?.observaciones||'' });
    this.configureSpecificValidators();
  }
  protected onPrimarySelection(): void { const value = this.form.controls.tipoPrincipal.value; this.form.controls.tipoDispositivoId.setValue(value.startsWith('group:') ? '' : value); this.clearTechnicalFields(); this.configureSpecificValidators(); }
  protected onConcreteTypeSelection(): void { this.clearTechnicalFields(); this.configureSpecificValidators(); }
  private clearTechnicalFields(): void { this.form.patchValue({ marca: '', modelo: '', numeroSerie: '', imei: '' }); this.attributesForm.reset(); }
  private configureSpecificValidators(): void {
    Object.values(this.attributesForm.controls).forEach((control) => { control.clearValidators(); control.updateValueAndValidity({ emitEvent: false }); });
    for (const field of this.visibility().camposEspecificos) { const control = this.attributesForm.get(field.clave); if (!control) continue; const validators = [];
      if (field.requerido) validators.push(Validators.required); if (field.maxLength) validators.push(Validators.maxLength(field.maxLength));
      if (field.min !== undefined) validators.push(Validators.min(field.min)); if (field.max !== undefined) validators.push(Validators.max(field.max));
      control.setValidators(validators); control.updateValueAndValidity({ emitEvent: false }); }
  }
  protected invalid(name: 'tipoPrincipal' | 'responsable'): boolean { const control = this.form.controls[name]; return control.invalid && (control.dirty || control.touched); }
  protected typeSelectionInvalid(): boolean { const control = this.form.controls.tipoDispositivoId; return !control.value && (control.dirty || control.touched || this.form.touched); }
  protected specificInvalid(field: CampoEspecificoFormulario): boolean { const control = this.attributesForm.get(field.clave); return !!control?.invalid && (control.dirty || control.touched); }
  private specificAttributes(): Record<string, string | number | null> {
    const raw = this.attributesForm.getRawValue(); const result: Record<string, string | number | null> = {};
    for (const field of this.visibility().camposEspecificos) { const value = raw[field.clave as keyof typeof raw]; if (value === null || value === undefined || String(value).trim() === '') continue; result[field.clave] = field.tipo === 'number' ? Number(value) : String(value).trim(); }
    return result;
  }
  protected onInvoiceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.invoiceFileError.set('');
    if (!file) { this.invoiceFile.set(null); return; }
    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const validMime = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type);
    const validExtension = ['.pdf', '.jpg', '.jpeg', '.png'].includes(extension);
    if (!validMime || !validExtension) {
      this.invoiceFile.set(null); input.value = '';
      this.invoiceFileError.set('Formato no permitido. Adjunte un archivo PDF, JPG, JPEG o PNG.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.invoiceFile.set(null); input.value = '';
      this.invoiceFileError.set('El archivo supera el tamaño máximo permitido de 10 MB.');
      return;
    }
    if (file.size === 0) {
      this.invoiceFile.set(null); input.value = '';
      this.invoiceFileError.set('El archivo seleccionado está vacío.');
      return;
    }
    this.invoiceFile.set(file);
  }
  protected removeInvoiceFile(input: HTMLInputElement): void {
    input.value = '';
    this.invoiceFile.set(null);
    this.invoiceFileError.set('');
  }
  protected submit(): void {
    const selected = this.selectedType(); if (this.form.invalid || !selected || (!this.codigo && !allowsDeviceCreation(selected))) { this.form.markAllAsTouched(); this.form.controls.tipoDispositivoId.markAsTouched(); this.apiError.set(!selected ? 'Seleccione un tipo de activo válido.' : ''); return; }
    const value = this.form.getRawValue();
    if (this.invoiceFile() && !value.numeroFactura.trim()) {
      this.invoiceFileError.set('Ingrese el número de factura para asociar el documento.');
      return;
    }
    this.submitting.set(true); this.apiError.set(''); const visible = this.visibility();
    const base = { tipoDispositivoId: Number(selected.id), marca: visible.marca ? value.marca.trim() || null : null, modelo: visible.modelo ? value.modelo.trim() || null : null,
      numeroSerie: visible.numeroSerie ? value.numeroSerie.trim() || null : null, imei: visible.imei ? value.imei.trim() || null : null,
      valorComercial:Number(value.valorComercial),
      atributosEspecificos: this.specificAttributes(), localidad: value.localidad.trim() || null, ubicacionDetalle: value.ubicacionDetalle.trim() || null, observaciones: value.observaciones.trim() || null };
    const deviceRequest = this.codigo ? this.service.actualizar(this.codigo, base) : this.service.crear({ ...base, responsable: value.responsable.trim() });
    const request=deviceRequest.pipe(switchMap((item)=>{
      const numero=value.numeroFactura.trim();if(!numero)return of(item);
      const factura={numeroFactura:numero,fechaFactura:value.fechaFactura||null,proveedor:value.proveedorFactura.trim()||null,montoTotal:Number(value.montoFactura)||null,observaciones:value.observacionesFactura.trim()||null,referenciaDocumental:null,dispositivosCodigos:[item.codigoInventario]};
      const existing=item.facturaAdquisicion;
      return(existing?this.facturas.actualizar(existing.id,factura,this.invoiceFile()??undefined):this.facturas.crear(factura,this.invoiceFile()??undefined)).pipe(map(()=>item));
    }));
    request.subscribe({ next: (item) => { this.submitting.set(false); if (this.codigo) void this.router.navigate(['/dispositivos', item.codigoInventario]); else this.created.set(item); }, error: (error) => { this.apiError.set(errorMessage(error)); this.submitting.set(false); } });
  }
  protected finish(device: Dispositivo): void { void this.router.navigate(['/dispositivos', device.codigoInventario]); }
}
