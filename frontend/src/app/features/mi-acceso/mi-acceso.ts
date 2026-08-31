import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-mi-acceso',
  imports: [ReactiveFormsModule, PageHeader],
  template: `
    <app-page-header
      title="Mi acceso"
      subtitle="Actualice sus credenciales personales de acceso."
    />
    <form class="card access-form" [formGroup]="passwordForm" (ngSubmit)="savePassword()">
      <h2>Cambiar contrase&ntilde;a</h2>
      @if (passwordNotice()) {
        <div class="notice notice--success">{{ passwordNotice() }}</div>
      }
      @if (passwordError()) {
        <div class="notice notice--error">{{ passwordError() }}</div>
      }
      <div class="field">
        <label for="current-password">Contrase&ntilde;a actual</label>
        <input id="current-password" type="password" autocomplete="current-password" formControlName="currentPassword" />
      </div>
      <div class="field">
        <label for="new-password">Nueva contrase&ntilde;a</label>
        <input id="new-password" type="password" autocomplete="new-password" formControlName="newPassword" />
      </div>
      <div class="field">
        <label for="confirm-password">Confirmar nueva contrase&ntilde;a</label>
        <input id="confirm-password" type="password" autocomplete="new-password" formControlName="confirmPassword" />
      </div>
      <p>La contrase&ntilde;a debe contener al menos 12 caracteres.</p>
      <button class="btn btn--primary" [disabled]="!canSavePassword() || passwordSaving()">
        {{ passwordSaving() ? 'Guardando...' : 'Cambiar contrase&ntilde;a' }}
      </button>
    </form>
    <form class="card access-form" [formGroup]="pinForm" (ngSubmit)="savePin()">
      <h2>Cambiar PIN</h2>
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
        [disabled]="!canSavePin() || pinSaving()"
      >
        {{ pinSaving() ? 'Guardando...' : 'Cambiar PIN' }}
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
  private readonly router = inject(Router);
  protected readonly pinSaving = signal(false);
  protected readonly passwordSaving = signal(false);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly passwordError = signal('');
  protected readonly passwordNotice = signal('');
  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(12)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(12)]]
  });
  protected readonly pinForm = this.fb.nonNullable.group({
    currentPin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    newPin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    confirmPin: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]]
  });

  protected canSavePin(): boolean {
    const value = this.pinForm.getRawValue();
    return this.pinForm.valid && value.newPin === value.confirmPin;
  }

  protected savePin(): void {
    if (!this.canSavePin()) return;
    this.pinSaving.set(true);
    this.error.set('');
    this.notice.set('');
    const value = this.pinForm.getRawValue();
    this.auth.changePin(value.currentPin, value.newPin).subscribe({
      next: () => {
        this.pinForm.reset();
        this.notice.set('PIN actualizado correctamente.');
        this.pinSaving.set(false);
        this.finishIfReady();
      },
      error: (requestError) => {
        this.error.set(errorMessage(requestError));
        this.pinSaving.set(false);
      }
    });
  }

  protected canSavePassword(): boolean {
    const value = this.passwordForm.getRawValue();
    return this.passwordForm.valid && value.newPassword === value.confirmPassword;
  }

  protected savePassword(): void {
    if (!this.canSavePassword()) return;
    this.passwordSaving.set(true);
    this.passwordError.set('');
    this.passwordNotice.set('');
    const value = this.passwordForm.getRawValue();
    this.auth.changePassword(value.currentPassword, value.newPassword).subscribe({
      next: () => {
        this.passwordForm.reset();
        this.passwordNotice.set('Contrasena actualizada correctamente.');
        this.passwordSaving.set(false);
        this.finishIfReady();
      },
      error: (requestError) => {
        this.passwordError.set(errorMessage(requestError));
        this.passwordSaving.set(false);
      }
    });
  }

  private finishIfReady(): void {
    const user = this.auth.user();
    if (user && !user.debeCambiarPassword && !user.debeCambiarPin) {
      void this.router.navigate(['/dashboard']);
    }
  }
}
