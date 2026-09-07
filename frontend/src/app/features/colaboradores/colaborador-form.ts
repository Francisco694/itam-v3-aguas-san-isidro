import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError } from '../../core/models/api.models';
import { Colaborador, ColaboradorInput, Departamento } from '../../core/models/itam.models';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';
import { formatRut, isValidRut, normalizeRut } from '../../shared/utils/rut';

const rutValidator: ValidatorFn = (control) =>
  !control.value || isValidRut(String(control.value)) ? null : { rut: true };

@Component({
  selector: 'app-colaborador-form',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, ViewState],
  template: `
    <app-page-header
      [title]="id ? 'Editar colaborador' : 'Nuevo colaborador'"
      subtitle="Información usada para entregar equipos y líneas corporativas."
    />
    @if (loading()) {
      <section class="card"><app-view-state kind="loading" title="Cargando colaborador" /></section>
    } @else {
      <form class="card form-card" [formGroup]="form" (ngSubmit)="submit()">
        @if (apiError()) { <div class="notice notice--error">{{ apiError() }}</div> }
        @if (existing(); as collaborator) {
          <div class="notice notice--error">
            Ya existe un colaborador registrado con este RUT.
            <a [routerLink]="['/colaboradores', collaborator.id]">Ver {{ collaborator.nombre }}</a>
          </div>
        }
        <div class="form-grid">
          <div class="field">
            <label for="rut">RUT *</label>
            <input
              id="rut"
              formControlName="rut"
              maxlength="12"
              inputmode="text"
              autocomplete="off"
              placeholder="12.345.678-9"
              [class.invalid]="invalid('rut')"
              (input)="formatRutInput()"
              (blur)="checkRut()"
            />
            @if (invalid('rut')) {
              <p class="field-error">Ingrese un RUT chileno válido.</p>
            }
          </div>
          <div class="field">
            <label for="nombre">Nombre *</label>
            <input id="nombre" formControlName="nombre" maxlength="180" [class.invalid]="invalid('nombre')" />
            @if (invalid('nombre')) {
              <p class="field-error">El nombre es obligatorio (máximo 180 caracteres).</p>
            }
          </div>
          <div class="field"><label for="cargo">Cargo</label><input id="cargo" formControlName="cargo" maxlength="150" /></div>
          <div class="field">
            <label for="departamento">Departamento</label>
            <select id="departamento" formControlName="departamentoId">
              <option value="">Sin departamento</option>
              @for (item of departments(); track item.id) { <option [value]="item.id">{{ item.nombre }}</option> }
            </select>
          </div>
          <div class="field span-2"><label for="localidad">Localidad</label><input id="localidad" formControlName="localidad" maxlength="120" /></div>
          <div class="field span-2"><label for="observaciones">Observaciones</label><textarea id="observaciones" formControlName="observaciones"></textarea></div>
          <label class="checkbox span-2"><input type="checkbox" formControlName="activo" /> Persona habilitada</label>
        </div>
        <div class="form-actions">
          <a class="btn btn--secondary" routerLink="/colaboradores">Cancelar</a>
          <button class="btn btn--primary" [disabled]="submitting() || !!existing()" type="submit">
            {{ submitting() ? 'Guardando…' : 'Guardar colaborador' }}
          </button>
        </div>
      </form>
    }
  `,
  styles: [`.form-card{max-width:52rem;padding:1.4rem}.notice a{font-weight:800;margin-left:.35rem}`],
})
export class ColaboradorForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(ColaboradoresService);
  private readonly deptService = inject(DepartamentosService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected id = '';
  protected readonly departments = signal<Departamento[]>([]);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly apiError = signal('');
  protected readonly existing = signal<Colaborador | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    rut: ['', [Validators.required, Validators.maxLength(12), rutValidator]],
    nombre: ['', [Validators.required, Validators.maxLength(180)]],
    cargo: ['', [Validators.maxLength(150)]],
    departamentoId: [''],
    localidad: ['', [Validators.maxLength(120)]],
    activo: [true],
    observaciones: [''],
  });

  ngOnInit(): void {
    this.deptService.listar().subscribe({ next: (items) => this.departments.set(items) });
    this.id = this.route.snapshot.paramMap.get('id') || '';
    if (!this.id) return;
    this.loading.set(true);
    this.service.obtener(this.id).subscribe({
      next: (item) => {
        this.form.patchValue({
          rut: formatRut(item.rut),
          nombre: item.nombre,
          cargo: item.cargo || '',
          departamentoId: item.departamento?.id || '',
          localidad: item.localidad || '',
          activo: item.activo,
          observaciones: item.observaciones || '',
        });
        this.loading.set(false);
      },
      error: (error) => {
        this.apiError.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected invalid(name: 'rut' | 'nombre'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.dirty || control.touched);
  }

  protected formatRutInput(): void {
    const control = this.form.controls.rut;
    const formatted = formatRut(control.value);
    if (formatted !== control.value) control.setValue(formatted, { emitEvent: false });
    this.existing.set(null);
    this.apiError.set('');
  }

  protected checkRut(): void {
    if (this.id || !isValidRut(this.form.controls.rut.value)) return;
    this.findExisting(() => undefined);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.apiError.set('');
    this.existing.set(null);
    const input = this.buildInput();
    if (this.id) {
      this.persist(input);
      return;
    }
    this.findExisting(() => this.persist(input));
  }

  private findExisting(onAvailable: () => void): void {
    const rut = normalizeRut(this.form.controls.rut.value);
    this.service.obtenerPorRut(rut).subscribe({
      next: (collaborator) => {
        if (normalizeRut(this.form.controls.rut.value) !== rut) return;
        this.existing.set(collaborator);
        this.apiError.set('');
        this.submitting.set(false);
      },
      error: (error: unknown) => {
        if (error instanceof ApiError && error.status === 404) {
          onAvailable();
          return;
        }
        this.apiError.set(errorMessage(error));
        this.submitting.set(false);
      },
    });
  }

  private buildInput(): ColaboradorInput {
    const value = this.form.getRawValue();
    return {
      rut: normalizeRut(value.rut),
      nombre: value.nombre.trim(),
      cargo: value.cargo.trim() || null,
      departamentoId: value.departamentoId ? Number(value.departamentoId) : null,
      localidad: value.localidad.trim() || null,
      activo: value.activo,
      observaciones: value.observaciones.trim() || null,
    };
  }

  private persist(input: ColaboradorInput): void {
    const request = this.id
      ? this.service.actualizar(this.id, input)
      : this.service.crear(input);
    request.subscribe({
      next: (item) => void this.router.navigate(['/colaboradores', item.id]),
      error: (error) => {
        this.apiError.set(errorMessage(error));
        this.submitting.set(false);
      },
    });
  }
}
