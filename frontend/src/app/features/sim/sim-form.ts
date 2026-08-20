import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Sim } from '../../core/models/itam.models';
import { SimService } from '../../core/services/sim.service';
import { AssetCreatedDialog } from '../../shared/components/asset-created-dialog/asset-created-dialog';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-sim-form',
  imports: [ReactiveFormsModule, RouterLink, PageHeader, ViewState, AssetCreatedDialog],
  template: `
    <app-page-header
      [title]="codigo ? 'Editar SIM' : 'Registrar Nueva SIM'"
      subtitle="La SIM recibe un código ITAM propio; asociación y asignación se realizan después."
    />
    @if (loading()) {
      <section class="card"><app-view-state kind="loading" title="Cargando SIM" /></section>
    } @else {
      <form class="card form-card" [formGroup]="form" (ngSubmit)="submit()">
        @if (apiError()) {
          <div class="notice notice--error">{{ apiError() }}</div>
        }
        <div class="form-grid">
          <div class="field">
            <label>Código ITAM</label
            ><input
              class="code"
              [value]="codigo || 'Se generará automáticamente al guardar'"
              disabled
            />
            <p class="hint">Código generado automáticamente y no editable.</p>
          </div>
          <div class="field">
            <label for="iccid">ICCID / código de fábrica *</label
            ><input
              id="iccid"
              maxlength="32"
              formControlName="iccidCodigoFabrica"
              [class.invalid]="invalid('iccidCodigoFabrica')"
            />
            @if (invalid('iccidCodigoFabrica')) {
              <p class="field-error">El ICCID es obligatorio (máximo 32 caracteres).</p>
            }
          </div>
          <div class="field">
            <label for="number">Número asociado</label
            ><input id="number" maxlength="30" formControlName="numeroAsociado" />
          </div>
          <div class="field">
            <label for="company">Compañía</label
            ><input id="company" maxlength="100" formControlName="compania" />
          </div>
          <div class="field span-2">
            <label for="notes">Observaciones</label
            ><textarea id="notes" formControlName="observaciones"></textarea>
          </div>
          @if (!codigo) {
            <div class="field span-2">
              <label for="responsible">Responsable del registro *</label
              ><input
                id="responsible"
                maxlength="150"
                formControlName="responsable"
                [class.invalid]="invalid('responsable')"
              />
              @if (invalid('responsable')) {
                <p class="field-error">El responsable es obligatorio.</p>
              }
            </div>
          }
        </div>
        <div class="form-actions">
          <a class="btn btn--secondary" [routerLink]="codigo ? ['/sim', codigo] : ['/sim']"
            >Cancelar</a
          ><button class="btn btn--primary" type="submit" [disabled]="submitting()">
            {{ submitting() ? 'Guardando…' : 'Guardar SIM' }}
          </button>
        </div>
      </form>
    }
    @if (created(); as item) {
      <app-asset-created-dialog
        [code]="item.codigoInventario"
        assetType="SIM"
        entityLabel="SIM"
        [detailLink]="['/sim', item.codigoInventario]"
        (close)="finish(item)"
      />
    }
  `,
  styles: [
    `
      .form-card {
        max-width: 52rem;
        padding: 1.4rem;
      }
    `,
  ],
})
export class SimForm implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly service = inject(SimService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected codigo = 0;
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly apiError = signal('');
  protected readonly created = signal<Sim | null>(null);
  protected readonly form = this.fb.nonNullable.group({
    iccidCodigoFabrica: ['', [Validators.required, Validators.maxLength(32)]],
    numeroAsociado: ['', [Validators.maxLength(30)]],
    compania: ['', [Validators.maxLength(100)]],
    observaciones: [''],
    responsable: ['', [Validators.required, Validators.maxLength(150)]],
  });
  ngOnInit() {
    this.codigo = Number(this.route.snapshot.paramMap.get('codigo') || 0);
    if (this.codigo) {
      this.form.controls.responsable.clearValidators();
      this.loading.set(true);
      this.service.obtener(this.codigo).subscribe({
        next: (i) => {
          this.form.patchValue({
            iccidCodigoFabrica: i.iccidCodigoFabrica,
            numeroAsociado: i.numeroAsociado || '',
            compania: i.compania || '',
            observaciones: i.observaciones || '',
          });
          this.loading.set(false);
        },
        error: (e) => {
          this.apiError.set(errorMessage(e));
          this.loading.set(false);
        },
      });
    }
  }
  protected invalid(name: keyof typeof this.form.controls) {
    const c = this.form.controls[name];
    return c.invalid && (c.dirty || c.touched);
  }
  protected submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    const v = this.form.getRawValue();
    const base = {
      iccidCodigoFabrica: v.iccidCodigoFabrica.trim(),
      numeroAsociado: v.numeroAsociado.trim() || null,
      compania: v.compania.trim() || null,
      observaciones: v.observaciones.trim() || null,
    };
    const request = this.codigo
      ? this.service.actualizar(this.codigo, base)
      : this.service.crear({ ...base, responsable: v.responsable.trim() });
    request.subscribe({
      next: (i) => {
        this.submitting.set(false);
        if (this.codigo) void this.router.navigate(['/sim', i.codigoInventario]);
        else this.created.set(i);
      },
      error: (e) => {
        this.apiError.set(errorMessage(e));
        this.submitting.set(false);
      },
    });
  }
  protected finish(item: Sim) {
    void this.router.navigate(['/sim', item.codigoInventario]);
  }
}
