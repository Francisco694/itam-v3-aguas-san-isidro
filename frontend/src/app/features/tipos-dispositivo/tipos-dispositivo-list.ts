import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucidePencil, LucidePlus, LucidePower, LucideSave, LucideTags, LucideX } from '@lucide/angular';
import { forkJoin } from 'rxjs';
import { InventoryCodeFamily, TipoDispositivo } from '../../core/models/itam.models';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { InventoryCodeService } from '../../core/services/inventory-code.service';
import { TiposDispositivoService } from '../../core/services/tipos-dispositivo.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-tipos-dispositivo-list',
  imports: [ReactiveFormsModule, PageHeader, ViewState, LucidePencil,
    LucidePlus, LucidePower, LucideSave, LucideTags, LucideX],
  template: `
    <app-page-header title="Tipos de Dispositivo"
      subtitle="Catálogo normalizado y relación con las familias que generan códigos ITAM."
      eyebrow="Administración">
      <button class="btn btn--primary" type="button" (click)="openCreate()"><svg lucidePlus></svg>Nuevo tipo</button>
    </app-page-header>

    @if (loading()) { <section class="card"><app-view-state kind="loading" title="Cargando catálogo" /></section> }
    @else if (error()) { <section class="card"><app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" /></section> }
    @else {
      <section class="card catalog-card">
        @if (!items().length) { <app-view-state kind="empty" title="No hay tipos registrados" message="Cree el primer tipo para clasificar dispositivos." /> }
        @else { <div class="table-wrap"><table class="data-table"><thead><tr>
          <th>Tipo</th><th>Familia de código</th><th>Estado</th><th><span class="sr-only">Acciones</span></th>
        </tr></thead><tbody>
          @for (item of items(); track item.id) { <tr>
            <td><strong>{{ item.nombre }}</strong><span class="cell-secondary">{{ item.descripcion || 'Sin descripción' }}</span></td>
            <td>@if (item.familiaCodigoInventario; as family) { <span class="family-code">{{ family.prefijo }}</span><strong>{{ family.nombre }}</strong>
              @if (!family.activo) { <span class="cell-secondary warning">Familia inactiva</span> }
            } @else { <span class="unconfigured">Sin familia configurada</span> }</td>
            <td><span class="catalog-status" [class.inactive]="!item.activo">{{ item.activo ? 'Activo' : 'Inactivo' }}</span></td>
            <td><div class="actions"><button class="btn btn--secondary btn--small" type="button" (click)="openEdit(item)"><svg lucidePencil></svg>Editar</button>
              @if (item.activo) { <button class="btn btn--ghost btn--small" type="button" (click)="deactivate(item)"><svg lucidePower></svg>Desactivar</button> }
            </div></td>
          </tr> }
        </tbody></table></div> }
      </section>
    }

    @if (editing()) { <div class="dialog-backdrop" role="presentation" (click)="closeBackdrop($event)">
      <form class="dialog type-dialog" role="dialog" aria-modal="true" aria-labelledby="type-title" [formGroup]="form" (ngSubmit)="submit()">
        <header><span><svg lucideTags></svg></span><div><small>CATÁLOGO</small><h2 id="type-title">{{ editing()!.id ? 'Editar tipo' : 'Nuevo tipo de dispositivo' }}</h2></div>
          <button class="icon-button" type="button" aria-label="Cerrar" (click)="close()"><svg lucideX></svg></button></header>
        @if (formError()) { <div class="notice notice--error">{{ formError() }}</div> }
        <div class="field"><label for="name">Nombre *</label><input id="name" maxlength="80" formControlName="nombre" [class.invalid]="invalid('nombre')" />
          @if (invalid('nombre')) { <p class="field-error">El nombre es obligatorio y admite hasta 80 caracteres.</p> }</div>
        <div class="field"><label for="description">Descripción</label><textarea id="description" formControlName="descripcion"></textarea></div>
        <div class="field"><label for="family">Familia de código</label><select id="family" formControlName="familiaCodigoInventarioId">
          <option value="">Sin familia</option>@for (family of deviceFamilies(); track family.id) {
            <option [value]="family.id">Prefijo {{ family.prefijo }} · {{ family.nombreFamilia }}</option>
          }
        </select><p class="hint">Sin una familia activa, el tipo se puede catalogar pero no permite crear dispositivos.</p></div>
        <label class="checkbox"><input type="checkbox" formControlName="requiereImei" />Solicitar campo IMEI al registrar activos</label>
        <label class="checkbox"><input type="checkbox" formControlName="activo" />Tipo activo</label>
        <footer><button class="btn btn--secondary" type="button" (click)="close()">Cancelar</button>
          <button class="btn btn--primary" type="submit" [disabled]="submitting()"><svg lucideSave></svg>{{ submitting() ? 'Guardando…' : 'Guardar' }}</button></footer>
      </form>
    </div> }
  `,
  styles: [`.catalog-card{overflow:hidden;padding:0}.catalog-card strong{display:block}.family-code{align-items:center;background:var(--cyan-soft);border-radius:.45rem;color:var(--blue);display:inline-flex;font-family:var(--font-mono);font-weight:800;height:1.8rem;justify-content:center;margin-right:.55rem;width:1.8rem}.unconfigured,.warning{color:#b45309;font-size:.75rem;font-weight:700}.catalog-status{background:#dcfce7;border-radius:99px;color:#166534;display:inline-flex;font-size:.72rem;font-weight:800;padding:.3rem .65rem}.catalog-status.inactive{background:var(--gray-100);color:var(--slate-500)}.type-dialog{max-width:36rem;padding:0 1.5rem 1.5rem}.type-dialog>header{align-items:center;background:var(--navy);color:#fff;display:flex;gap:.8rem;margin:0 -1.5rem 1.25rem;padding:1.1rem 1.5rem}.type-dialog>header>span{color:var(--cyan)}.type-dialog h2,.type-dialog small{margin:0}.type-dialog h2{font-size:1.15rem}.type-dialog small{color:#bae6fd;font-size:.65rem;font-weight:800;letter-spacing:.12em}.type-dialog .icon-button{margin-left:auto}.type-dialog footer{display:flex;gap:.75rem;justify-content:flex-end;margin-top:1.25rem}.checkbox{align-items:center;display:flex;gap:.55rem;font-weight:700;margin-top:1rem}.checkbox input{width:auto}`]
})
export class TiposDispositivoList implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(TiposDispositivoService);
  private readonly codeService = inject(InventoryCodeService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(ToastService);
  protected readonly items = signal<TipoDispositivo[]>([]);
  protected readonly families = signal<InventoryCodeFamily[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly editing = signal<TipoDispositivo | { id: null } | null>(null);
  protected readonly formError = signal('');
  protected readonly submitting = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.maxLength(80)]],
    descripcion: [''], familiaCodigoInventarioId: [''], requiereImei: [false], activo: [true]
  });

  ngOnInit(): void { this.load(); }
  protected load(): void {
    this.loading.set(true); this.error.set('');
    forkJoin({ items: this.service.listar(), families: this.codeService.listarFamilias() }).subscribe({
      next: ({ items, families }) => { this.items.set(items); this.families.set(families); this.loading.set(false); },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); }
    });
  }
  protected deviceFamilies(): InventoryCodeFamily[] {
    return this.families().filter((family) => family.tipoEntidad === 'DISPOSITIVO');
  }
  protected openCreate(): void {
    this.form.reset({ nombre: '', descripcion: '', familiaCodigoInventarioId: '', requiereImei: false, activo: true });
    this.formError.set(''); this.editing.set({ id: null });
  }
  protected openEdit(item: TipoDispositivo): void {
    this.form.reset({ nombre: item.nombre, descripcion: item.descripcion || '',
      familiaCodigoInventarioId: item.familiaCodigoInventario?.id || '', requiereImei: item.requiereImei, activo: item.activo });
    this.formError.set(''); this.editing.set(item);
  }
  protected close(): void { if (!this.submitting()) this.editing.set(null); }
  protected closeBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget) this.close(); }
  protected invalid(name: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[name]; return control.invalid && (control.touched || control.dirty);
  }
  protected submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true); this.formError.set('');
    const value = this.form.getRawValue();
    const input = { nombre: value.nombre.trim(), descripcion: value.descripcion.trim() || null,
      familiaCodigoInventarioId: value.familiaCodigoInventarioId
        ? Number(value.familiaCodigoInventarioId) : null, requiereImei: value.requiereImei, activo: value.activo };
    const current = this.editing();
    const request = current && current.id ? this.service.actualizar(Number(current.id), input) : this.service.crear(input);
    request.subscribe({ next: () => { this.submitting.set(false); this.editing.set(null);
      this.toast.success('Catálogo actualizado'); this.load(); },
      error: (error) => { this.formError.set(errorMessage(error)); this.submitting.set(false); } });
  }
  protected async deactivate(item: TipoDispositivo): Promise<void> {
    const accepted = await this.confirmation.confirm(
      `¿Desactivar el tipo ${item.nombre}? Los dispositivos existentes conservarán su relación.`,
      { title: 'Desactivar tipo', confirmLabel: 'Desactivar', tone: 'danger' }
    );
    if (!accepted) return;
    this.service.actualizar(Number(item.id), { activo: false }).subscribe({
      next: () => { this.toast.success('Tipo desactivado'); this.load(); },
      error: (error) => this.toast.error('No se pudo desactivar', errorMessage(error))
    });
  }
}
