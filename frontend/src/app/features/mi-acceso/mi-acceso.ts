import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-mi-acceso',
  imports: [ReactiveFormsModule, PageHeader],
  template: `
    <app-page-header
      title="Mi acceso"
      subtitle="Personalice su PIN de acceso rapido sin reemplazar su contrasena."
    />
    <form class="card access-form" [formGroup]="form" (ngSubmit)="save()">
      @if (notice()) {
        <div class="notice notice--success">{{ notice() }}</div>
      }
      @if (error()) {
        <div class="notice notice--error">{{ error() }}</div>
      }
      <div class="field">
        <label for="current-pin">PIN actual</label>
        <input
          id="current-pin"
          type="password"
          inputmode="numeric"
          maxlength="6"
          autocomplete="current-password"
          formControlName="currentPin"
        />
      </div>
      <div class="field">
        <label for="new-pin">Nuevo PIN</label>
        <input
          id="new-pin"
          type="password"
          inputmode="numeric"
          maxlength="6"
          autocomplete="new-password"
          formControlName="newPin"
        />
      </div>
      <div class="field">
        <label for="confirm-pin">Confirmar nuevo PIN</label>
        <input
          id="confirm-pin"
          type="password"
          inputmode="numeric"
          maxlength="6"
          autocomplete="new-password"
          formControlName="confirmPin"
        />
      </div>
      <p>El PIN debe contener exactamente 6 digitos.</p>
      <button
        class="btn btn--primary"
        [disabled]="!canSave() || saving()"
      >
        {{ saving() ? 'Guardando...' : 'Cambiar PIN' }}
      </button>
    </form>
  `,
  styles: [`
    .access-form{display:grid;gap:1rem;max-width:32rem;padding:1.25rem}.access-form p{color:var(--slate-500);font-size:.8rem;margin:0}.access-form .btn{justify-self:start}
  `]
})
export class MiAcceso {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly form = this.fb.nonNullable.group({
    currentPin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    confirmPin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  protected canSave(): boolean {
    const value = this.form.getRawValue();
    return this.form.valid && value.newPin === value.confirmPin;
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    const value = this.form.getRawValue();
    this.auth.changePin(value.currentPin, value.newPin).subscribe({
      next: () => {
        this.form.reset();
        this.notice.set('PIN actualizado correctamente.');
        this.saving.set(false);
      },
      error: (requestError) => {
        this.error.set(errorMessage(requestError));
        this.saving.set(false);
      }
    });
  }
}
