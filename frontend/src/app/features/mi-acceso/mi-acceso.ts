import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideEye, LucideEyeOff } from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-mi-acceso',
  imports: [ReactiveFormsModule, PageHeader, LucideEye, LucideEyeOff],
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
        <div class="secret-field">
          <input id="current-password" [type]="passwordVisibility.current() ? 'text' : 'password'" autocomplete="current-password" formControlName="currentPassword" />
          <button type="button" class="secret-toggle" [attr.aria-label]="passwordVisibility.current() ? 'Ocultar contraseña actual' : 'Mostrar contraseña actual'" [attr.aria-pressed]="passwordVisibility.current()" (click)="passwordVisibility.current.update((visible) => !visible)">
            @if (passwordVisibility.current()) { <svg lucideEyeOff></svg> } @else { <svg lucideEye></svg> }
          </button>
        </div>
      </div>
      <div class="field">
        <label for="new-password">Nueva contrase&ntilde;a</label>
        <div class="secret-field">
          <input id="new-password" [type]="passwordVisibility.new() ? 'text' : 'password'" autocomplete="new-password" formControlName="newPassword" />
          <button type="button" class="secret-toggle" [attr.aria-label]="passwordVisibility.new() ? 'Ocultar nueva contraseña' : 'Mostrar nueva contraseña'" [attr.aria-pressed]="passwordVisibility.new()" (click)="passwordVisibility.new.update((visible) => !visible)">
            @if (passwordVisibility.new()) { <svg lucideEyeOff></svg> } @else { <svg lucideEye></svg> }
          </button>
        </div>
      </div>
      <div class="field">
        <label for="confirm-password">Confirmar nueva contrase&ntilde;a</label>
        <div class="secret-field">
          <input id="confirm-password" [type]="passwordVisibility.confirm() ? 'text' : 'password'" autocomplete="new-password" formControlName="confirmPassword" />
          <button type="button" class="secret-toggle" [attr.aria-label]="passwordVisibility.confirm() ? 'Ocultar confirmación' : 'Mostrar confirmación'" [attr.aria-pressed]="passwordVisibility.confirm()" (click)="passwordVisibility.confirm.update((visible) => !visible)">
            @if (passwordVisibility.confirm()) { <svg lucideEyeOff></svg> } @else { <svg lucideEye></svg> }
          </button>
        </div>
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
        <div class="secret-field">
          <input id="current-pin" [type]="pinVisibility.current() ? 'text' : 'password'" inputmode="numeric" maxlength="6" autocomplete="current-password" formControlName="currentPin" />
          <button type="button" class="secret-toggle" [attr.aria-label]="pinVisibility.current() ? 'Ocultar PIN actual' : 'Mostrar PIN actual'" [attr.aria-pressed]="pinVisibility.current()" (click)="pinVisibility.current.update((visible) => !visible)">
            @if (pinVisibility.current()) { <svg lucideEyeOff></svg> } @else { <svg lucideEye></svg> }
          </button>
        </div>
      </div>
      <div class="field">
        <label for="new-pin">Nuevo PIN</label>
        <div class="secret-field">
          <input id="new-pin" [type]="pinVisibility.new() ? 'text' : 'password'" inputmode="numeric" maxlength="6" autocomplete="new-password" formControlName="newPin" />
          <button type="button" class="secret-toggle" [attr.aria-label]="pinVisibility.new() ? 'Ocultar nuevo PIN' : 'Mostrar nuevo PIN'" [attr.aria-pressed]="pinVisibility.new()" (click)="pinVisibility.new.update((visible) => !visible)">
            @if (pinVisibility.new()) { <svg lucideEyeOff></svg> } @else { <svg lucideEye></svg> }
          </button>
        </div>
      </div>
      <div class="field">
        <label for="confirm-pin">Confirmar nuevo PIN</label>
        <div class="secret-field">
          <input id="confirm-pin" [type]="pinVisibility.confirm() ? 'text' : 'password'" inputmode="numeric" maxlength="6" autocomplete="new-password" formControlName="confirmPin" />
          <button type="button" class="secret-toggle" [attr.aria-label]="pinVisibility.confirm() ? 'Ocultar confirmación de PIN' : 'Mostrar confirmación de PIN'" [attr.aria-pressed]="pinVisibility.confirm()" (click)="pinVisibility.confirm.update((visible) => !visible)">
            @if (pinVisibility.confirm()) { <svg lucideEyeOff></svg> } @else { <svg lucideEye></svg> }
          </button>
        </div>
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
    .access-form{display:grid;gap:1rem;max-width:32rem;padding:1.25rem}.access-form p{color:var(--slate-500);font-size:.8rem;margin:0}.access-form .btn{justify-self:start}.secret-field{position:relative}.secret-field input{padding-right:3rem;width:100%}.secret-field input::-ms-reveal,.secret-field input::-ms-clear{display:none}.secret-field input::-webkit-credentials-auto-fill-button{display:none!important;pointer-events:none;visibility:hidden}.secret-toggle{align-items:center;background:transparent;border:0;color:var(--slate-500);cursor:pointer;display:flex;height:2.5rem;justify-content:center;padding:0;position:absolute;right:.25rem;top:50%;transform:translateY(-50%);width:2.5rem}.secret-toggle:hover{color:var(--navy)}.secret-toggle svg{height:1.1rem;width:1.1rem}
  `]
})
export class MiAcceso {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly pinSaving = signal(false);
  protected readonly passwordSaving = signal(false);
  protected readonly passwordVisibility = {
    current: signal(false),
    new: signal(false),
    confirm: signal(false)
  };
  protected readonly pinVisibility = {
    current: signal(false),
    new: signal(false),
    confirm: signal(false)
  };
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
