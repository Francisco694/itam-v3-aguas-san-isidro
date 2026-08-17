import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideHash, LucidePencil, LucidePlus, LucideSave, LucideX } from '@lucide/angular';
import { InventoryCodeFamily } from '../../core/models/itam.models';
import { InventoryCodeService } from '../../core/services/inventory-code.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-familias-codigo-list',
  imports: [ReactiveFormsModule, PageHeader, ViewState, LucideHash,
    LucidePencil, LucidePlus, LucideSave, LucideX],
  template: `
    <app-page-header title="Familias de código"
      subtitle="Administra los prefijos que identifican cada familia patrimonial. Los códigos ya emitidos nunca se recalculan."
      eyebrow="Administración">
      <button class="btn btn--primary" type="button" (click)="openCreate()"><svg lucidePlus></svg>Nueva familia</button>
    </app-page-header>

    @if (loading()) { <section class="card"><app-view-state kind="loading" title="Cargando familias" /></section> }
    @else if (error()) { <section class="card"><app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" /></section> }
    @else { <section class="card family-card">
      @if (!items().length) { <app-view-state kind="empty" title="No hay familias configuradas" message="Cree una familia para habilitar nuevos tipos de activo." /> }
      @else { <div class="table-wrap"><table class="data-table"><thead><tr>
        <th>Familia</th><th>Prefijo</th><th>Estrategia</th><th>Secuencia</th><th>Tipos asociados</th><th>Estado</th><th><span class="sr-only">Acciones</span></th>
      </tr></thead><tbody>@for (item of items(); track item.id) { <tr>
        <td><strong>{{ item.nombreFamilia }}</strong><span class="cell-secondary">{{ item.tipoEntidad }}</span></td>
        <td><span class="prefix">{{ item.prefijo }}</span>@if (item.tieneCodigosEmitidos) { <small class="locked">Prefijo protegido</small> }</td>
        <td><code>{{ item.estrategiaCodigo }}</code><span class="cell-secondary">Versión {{ item.versionEsquema }}</span></td>
        <td><strong>{{ item.ultimoOrdinal }}</strong><span class="cell-secondary">Próximo: {{ item.proximoCodigoEstimado ?? 'No disponible' }}</span></td>
        <td>@if (item.tiposAsociados.length) { <div class="type-list">@for (type of item.tiposAsociados; track type.id) { <span [class.inactive]="!type.activo">{{ type.nombre }}</span> }</div> } @else { <span class="cell-secondary">Sin tipos</span> }</td>
        <td><span class="catalog-status" [class.inactive]="!item.activo">{{ item.activo ? 'Activa' : 'Inactiva' }}</span></td>
        <td><button class="btn btn--secondary btn--small" type="button" (click)="openEdit(item)"><svg lucidePencil></svg>Editar</button></td>
      </tr> }</tbody></table></div> }
    </section> }

    @if (editing()) { <div class="dialog-backdrop" role="presentation" (click)="closeBackdrop($event)">
      <form class="dialog family-dialog" role="dialog" aria-modal="true" aria-labelledby="family-title" [formGroup]="form" (ngSubmit)="submit()">
        <header><span><svg lucideHash></svg></span><div><small>CODIFICACIÓN ITAM</small><h2 id="family-title">{{ editing()!.id ? 'Editar familia' : 'Nueva familia' }}</h2></div>
          <button class="icon-button" type="button" aria-label="Cerrar" (click)="close()"><svg lucideX></svg></button></header>
        @if (formError()) { <div class="notice notice--error">{{ formError() }}</div> }
        <div class="field"><label for="family-name">Nombre *</label><input id="family-name" maxlength="80" formControlName="nombreFamilia" [class.invalid]="invalid('nombreFamilia')" />
          @if (invalid('nombreFamilia')) { <p class="field-error">Ingrese un nombre de hasta 80 caracteres.</p> }</div>
        <div class="field"><label for="prefix">Prefijo *</label><div class="prefix-control"><input class="code" id="prefix" maxlength="1" inputmode="numeric" formControlName="prefijo" [readonly]="editing()!.id && editing()!.tieneCodigosEmitidos" />
          @if (!editing()!.id) { <button class="btn btn--secondary" type="button" [disabled]="suggesting()" (click)="suggestPrefix()">Sugerir</button> }</div>
          @if (editing()!.id && editing()!.tieneCodigosEmitidos) { <p class="hint">El prefijo está bloqueado porque existen códigos emitidos.</p> }
          @if (suggestion()) { <p class="hint">{{ suggestion() }}</p> }
          @if (invalid('prefijo')) { <p class="field-error">Use un único dígito entre 1 y 9.</p> }</div>
        <div class="field"><label for="strategy">Estrategia</label><select id="strategy" formControlName="estrategiaCodigo"><option value="REPEAT_PREFIX">REPEAT_PREFIX</option></select>
          <p class="hint">La estrategia define el formato; no depende del nombre de la familia.</p></div>
        <label class="checkbox"><input type="checkbox" formControlName="activo" />Familia activa</label>
        <footer><button class="btn btn--secondary" type="button" (click)="close()">Cancelar</button>
          <button class="btn btn--primary" type="submit" [disabled]="submitting()"><svg lucideSave></svg>{{ submitting() ? 'Guardando…' : 'Guardar' }}</button></footer>
      </form>
    </div> }
  `,
  styles: [`.family-card{overflow:hidden;padding:0}.family-card strong{display:block}.prefix{align-items:center;background:var(--navy);border-radius:.55rem;color:#fff;display:inline-flex;font-family:var(--font-mono);font-size:1rem;font-weight:900;height:2.2rem;justify-content:center;width:2.2rem}.locked{color:var(--slate-500);display:block;font-size:.65rem;margin-top:.35rem}.type-list{display:flex;flex-wrap:wrap;gap:.3rem}.type-list span{background:var(--cyan-soft);border-radius:99px;color:var(--blue);font-size:.68rem;font-weight:800;padding:.25rem .5rem}.type-list span.inactive{background:var(--gray-100);color:var(--slate-500)}.catalog-status{background:#dcfce7;border-radius:99px;color:#166534;display:inline-flex;font-size:.72rem;font-weight:800;padding:.3rem .65rem}.catalog-status.inactive{background:var(--gray-100);color:var(--slate-500)}.family-dialog{max-width:36rem;padding:0 1.5rem 1.5rem}.family-dialog>header{align-items:center;background:var(--navy);color:#fff;display:flex;gap:.8rem;margin:0 -1.5rem 1.25rem;padding:1.1rem 1.5rem}.family-dialog>header>span{color:var(--cyan)}.family-dialog h2,.family-dialog small{margin:0}.family-dialog h2{font-size:1.15rem}.family-dialog small{color:#bae6fd;font-size:.65rem;font-weight:800;letter-spacing:.12em}.family-dialog .icon-button{margin-left:auto}.family-dialog footer{display:flex;gap:.75rem;justify-content:flex-end;margin-top:1.25rem}.prefix-control{display:flex;gap:.6rem}.prefix-control input{max-width:7rem}.checkbox{align-items:center;display:flex;gap:.55rem;font-weight:700;margin-top:1rem}.checkbox input{width:auto}`]
})
export class FamiliasCodigoList implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(InventoryCodeService);
  private readonly toast = inject(ToastService);
  protected readonly items = signal<InventoryCodeFamily[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly editing = signal<InventoryCodeFamily | { id: null; tieneCodigosEmitidos: false } | null>(null);
  protected readonly formError = signal('');
  protected readonly suggestion = signal('');
  protected readonly suggesting = signal(false);
  protected readonly submitting = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    nombreFamilia: ['', [Validators.required, Validators.maxLength(80)]],
    prefijo: ['', [Validators.required, Validators.pattern(/^[1-9]$/)]],
    estrategiaCodigo: ['REPEAT_PREFIX' as const, Validators.required], activo: [true]
  });

  ngOnInit(): void { this.load(); }
  protected load(): void { this.loading.set(true); this.error.set('');
    this.service.listarFamilias().subscribe({ next: (items) => { this.items.set(items); this.loading.set(false); },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); } }); }
  protected openCreate(): void { this.form.reset({ nombreFamilia: '', prefijo: '', estrategiaCodigo: 'REPEAT_PREFIX', activo: true });
    this.formError.set(''); this.suggestion.set(''); this.editing.set({ id: null, tieneCodigosEmitidos: false }); }
  protected openEdit(item: InventoryCodeFamily): void { this.form.reset({ nombreFamilia: item.nombreFamilia, prefijo: item.prefijo,
      estrategiaCodigo: item.estrategiaCodigo, activo: item.activo }); this.formError.set(''); this.suggestion.set(''); this.editing.set(item); }
  protected close(): void { if (!this.submitting()) this.editing.set(null); }
  protected closeBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget) this.close(); }
  protected invalid(name: keyof typeof this.form.controls): boolean { const control = this.form.controls[name]; return control.invalid && (control.touched || control.dirty); }
  protected suggestPrefix(): void { this.suggesting.set(true); this.service.sugerirPrefijo().subscribe({ next: (result) => {
      if (result.prefijo) this.form.controls.prefijo.setValue(result.prefijo); this.suggestion.set(result.mensaje); this.suggesting.set(false); },
    error: (error) => { this.suggestion.set(errorMessage(error)); this.suggesting.set(false); } }); }
  protected submit(): void { if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true); this.formError.set(''); const value = this.form.getRawValue();
    const input = { nombreFamilia: value.nombreFamilia.trim(), prefijo: value.prefijo,
      estrategiaCodigo: value.estrategiaCodigo, activo: value.activo };
    const current = this.editing(); const request = current?.id ? this.service.actualizar(Number(current.id), input) : this.service.crear(input);
    request.subscribe({ next: () => { this.submitting.set(false); this.editing.set(null); this.toast.success('Familia actualizada'); this.load(); },
      error: (error) => { this.formError.set(errorMessage(error)); this.submitting.set(false); } }); }
}
