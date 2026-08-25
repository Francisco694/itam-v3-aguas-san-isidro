import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideDroplet,
  LucideEye,
  LucideEyeOff,
  LucideKeyRound,
  LucideLockKeyhole,
  LucideLogIn
} from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    LucideDroplet,
    LucideEye,
    LucideEyeOff,
    LucideKeyRound,
    LucideLockKeyhole,
    LucideLogIn
  ],
  template: `
    <main>
      <section class="login-card">
        <header>
          <span><svg lucideDroplet></svg></span>
          <h1>Aguas San Isidro</h1>
          <p>SISTEMA ITAM v3.0</p>
        </header>

        <form [formGroup]="form" (ngSubmit)="submit()">
          @if (error()) {
            <div class="notice notice--error">{{ error() }}</div>
          }

          <div class="field">
            <label for="email">Correo</label>
            <input
              id="email"
              type="email"
              autocomplete="username"
              formControlName="email"
            />
          </div>

          <fieldset class="access-method">
            <legend>M&eacute;todo de acceso</legend>
            <div class="method-tabs">
              <button
                type="button"
                [class.active]="mode() === 'pin'"
                (click)="setMode('pin')"
              >
                <svg lucideKeyRound></svg> PIN
              </button>
              <button
                type="button"
                [class.active]="mode() === 'password'"
                (click)="setMode('password')"
              >
                <svg lucideLockKeyhole></svg> Contrase&ntilde;a
              </button>
            </div>
          </fieldset>

          @if (mode() === 'pin') {
            <div class="field">
              <label for="pin">PIN de 6 d&iacute;gitos</label>
              <div class="password-field">
                <input
                  id="pin"
                  [type]="pinVisible() ? 'text' : 'password'"
                  inputmode="numeric"
                  maxlength="6"
                  pattern="[0-9]{6}"
                  autocomplete="current-password"
                  formControlName="pin"
                />
                <button
                  class="password-toggle"
                  type="button"
                  [attr.aria-label]="pinVisible() ? 'Ocultar PIN' : 'Mostrar PIN'"
                  (click)="pinVisible.update((visible) => !visible)"
                >
                  @if (pinVisible()) {
                    <svg lucideEyeOff aria-hidden="true"></svg>
                  } @else {
                    <svg lucideEye aria-hidden="true"></svg>
                  }
                </button>
              </div>
              <small>Si a&uacute;n no tiene PIN, utilice su contrase&ntilde;a.</small>
            </div>
          } @else {
            <div class="field">
              <label for="password">Contrase&ntilde;a</label>
              <div class="password-field">
                <input
                  id="password"
                  [type]="passwordVisible() ? 'text' : 'password'"
                  autocomplete="current-password"
                  formControlName="password"
                />
                <button
                  class="password-toggle"
                  type="button"
                  [attr.aria-label]="
                    passwordVisible()
                      ? 'Ocultar contrasena'
                      : 'Mostrar contrasena'
                  "
                  (click)="passwordVisible.update((visible) => !visible)"
                >
                  @if (passwordVisible()) {
                    <svg lucideEyeOff aria-hidden="true"></svg>
                  } @else {
                    <svg lucideEye aria-hidden="true"></svg>
                  }
                </button>
              </div>
            </div>
          }

          <button
            class="btn btn--primary submit-button"
            [disabled]="!canSubmit() || loading()"
          >
            <svg lucideLogIn></svg>
            {{ loading() ? 'Ingresando...' : 'Ingresar' }}
          </button>
        </form>
      </section>
    </main>
  `,
  styles: [`
    :host{display:block;min-height:100vh}main{align-items:center;background:linear-gradient(145deg,var(--navy),#0077b6);display:flex;justify-content:center;min-height:100vh;padding:1.5rem}.login-card{background:#fff;border-radius:1.25rem;box-shadow:0 24px 60px rgba(3,4,94,.3);max-width:27rem;overflow:hidden;width:100%}.login-card header{background:var(--navy);color:#fff;padding:2rem;text-align:center}.login-card header span{align-items:center;background:var(--cyan);border-radius:1rem;display:inline-flex;height:3rem;justify-content:center;width:3rem}.login-card header svg{color:var(--navy)}h1{font-size:1.25rem;margin:.8rem 0 .2rem}header p{color:#90e0ef;font-size:.7rem;letter-spacing:.14em;margin:0}form{display:grid;gap:1rem;padding:2rem}.access-method{border:0;margin:0;padding:0}.access-method legend{font-size:.82rem;font-weight:700;margin-bottom:.45rem}.method-tabs{background:var(--gray-100);border-radius:.75rem;display:grid;gap:.25rem;grid-template-columns:1fr 1fr;padding:.25rem}.method-tabs button{align-items:center;background:transparent;border:0;border-radius:.55rem;color:var(--slate-500);cursor:pointer;display:flex;font-weight:700;gap:.4rem;justify-content:center;padding:.65rem}.method-tabs button.active{background:#fff;box-shadow:0 1px 4px rgba(15,23,42,.14);color:var(--navy)}.method-tabs svg{height:1rem;width:1rem}.password-field{position:relative}.password-field input{padding-right:3rem;width:100%}.password-toggle{align-items:center;background:transparent;border:0;color:var(--slate-500);cursor:pointer;display:inline-flex;height:2.5rem;justify-content:center;padding:0;position:absolute;right:.35rem;top:50%;transform:translateY(-50%);width:2.5rem}.password-toggle:hover{color:var(--navy)}.password-toggle:focus-visible{border-radius:.5rem;outline:2px solid var(--cyan);outline-offset:1px}.password-toggle svg{height:1.2rem;width:1.2rem}.field small{color:var(--slate-500);display:block;font-size:.75rem;margin-top:.4rem}.submit-button{justify-content:center;width:100%}
  `]
})
export class Login {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly mode = signal<'pin' | 'password'>('pin');
  protected readonly passwordVisible = signal(false);
  protected readonly pinVisible = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
    pin: ['', Validators.pattern(/^\d{6}$/)]
  });

  protected setMode(mode: 'pin' | 'password'): void {
    this.mode.set(mode);
    this.error.set('');
  }

  protected canSubmit(): boolean {
    if (this.form.controls.email.invalid) return false;
    return this.mode() === 'pin'
      ? /^\d{6}$/.test(this.form.controls.pin.value)
      : this.form.controls.password.value.length > 0;
  }

  protected submit(): void {
    if (!this.canSubmit()) return;
    this.loading.set(true);
    this.error.set('');
    const request =
      this.mode() === 'pin'
        ? this.auth.loginPin(
            this.form.controls.email.value,
            this.form.controls.pin.value
          )
        : this.auth.login(
            this.form.controls.email.value,
            this.form.controls.password.value
          );
    request.subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: (requestError) => {
        this.error.set(errorMessage(requestError));
        this.loading.set(false);
      }
    });
  }
}
