import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { LucideEye, LucideEyeOff, LucidePencil } from '@lucide/angular';
import {
  CreateUserInput,
  ManagedUser,
  UpdateUserInput,
  UserRole
} from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-usuarios',
  imports: [
    ReactiveFormsModule,
    LucideEye,
    LucideEyeOff,
    LucidePencil,
    PageHeader,
    ViewState
  ],
  template: `
    <app-page-header
      title="Administraci&oacute;n de usuarios"
      subtitle="Acceso exclusivo del perfil SUPER_USUARIO."
    />
    @if (auth.user()?.rol !== 'SUPER_USUARIO') {
      <app-view-state
        kind="error"
        title="Acceso restringido"
        message="No tiene permisos para administrar usuarios."
      />
    } @else {
      @if (notice()) {
        <div class="notice notice--success">{{ notice() }}</div>
      }
      @if (error()) {
        <div class="notice notice--error">{{ error() }}</div>
      }
      <section class="user-grid">
        <form class="card" [formGroup]="form" (ngSubmit)="save()">
          <h2>{{ editing() ? 'Editar usuario' : 'Crear usuario' }}</h2>
          <div class="field">
            <label for="user-name">Nombre</label>
            <input id="user-name" formControlName="nombre" />
          </div>
          <div class="field">
            <label for="user-email">Correo</label>
            <input id="user-email" type="email" formControlName="email" />
          </div>
          <div class="field">
            <label for="user-position">Cargo</label>
            <input id="user-position" formControlName="cargo" />
          </div>
          <div class="field">
            <label for="user-password">
              {{ editing() ? 'Restablecer contrase&ntilde;a' : 'Contrase&ntilde;a inicial' }}
            </label>
            <div class="secret-field">
              <input
                id="user-password"
                [type]="passwordVisible() ? 'text' : 'password'"
                autocomplete="new-password"
                formControlName="password"
              />
              <button
                type="button"
                [attr.aria-label]="
                  passwordVisible() ? 'Ocultar contrasena' : 'Mostrar contrasena'
                "
                (click)="passwordVisible.update((visible) => !visible)"
              >
                @if (passwordVisible()) {
                  <svg lucideEyeOff></svg>
                } @else {
                  <svg lucideEye></svg>
                }
              </button>
            </div>
            <small>
              {{ editing() ? 'Dejar vacio para conservarla.' : 'Minimo 12 caracteres.' }}
            </small>
          </div>
          <div class="field">
            <label for="user-pin">
              {{ editing() ? 'Restablecer PIN' : 'PIN inicial' }}
            </label>
            <div class="secret-field">
              <input
                id="user-pin"
                [type]="pinVisible() ? 'text' : 'password'"
                inputmode="numeric"
                maxlength="6"
                autocomplete="new-password"
                formControlName="pin"
              />
              <button
                type="button"
                [attr.aria-label]="pinVisible() ? 'Ocultar PIN' : 'Mostrar PIN'"
                (click)="pinVisible.update((visible) => !visible)"
              >
                @if (pinVisible()) {
                  <svg lucideEyeOff></svg>
                } @else {
                  <svg lucideEye></svg>
                }
              </button>
            </div>
            <small>
              {{ editing() ? 'Dejar vacio para conservarlo.' : 'Exactamente 6 digitos.' }}
            </small>
          </div>
          <div class="field">
            <label for="user-role">Perfil</label>
            <select id="user-role" formControlName="rol">
              <option value="USUARIO">Usuario</option>
              <option value="SUPER_USUARIO">Super usuario</option>
            </select>
          </div>
          <label class="check">
            <input type="checkbox" formControlName="activo" />
            Usuario activo
          </label>
          <div class="form-actions">
            @if (editing()) {
              <button class="btn btn--secondary" type="button" (click)="cancelEdit()">
                Cancelar
              </button>
            }
            <button
              class="btn btn--primary"
              [disabled]="!canSave() || saving()"
            >
              {{ saving() ? 'Guardando...' : editing() ? 'Guardar cambios' : 'Crear usuario' }}
            </button>
          </div>
        </form>

        <section class="card users-card">
          <h2>Usuarios</h2>
          @for (user of users(); track user.id) {
            <article class="user-row">
              <div>
                <strong>{{ user.nombre }}</strong>
                <small>{{ user.email }}</small>
                <small>{{ user.cargo || 'Sin cargo' }} &middot; {{ user.rol }}</small>
                <span [class.pending]="!user.pinConfigurado">
                  {{ user.pinConfigurado ? 'PIN configurado' : 'PIN pendiente' }}
                </span>
              </div>
              <div class="row-actions">
                <button
                  class="btn btn--small btn--secondary"
                  type="button"
                  (click)="edit(user)"
                >
                  <svg lucidePencil></svg> Editar
                </button>
                <button
                  class="btn btn--small btn--secondary"
                  type="button"
                  (click)="toggle(user)"
                >
                  {{ user.activo ? 'Desactivar' : 'Activar' }}
                </button>
              </div>
            </article>
          } @empty {
            <app-view-state
              kind="empty"
              title="No hay usuarios"
              message="Cree la primera cuenta del sistema."
            />
          }
        </section>
      </section>
    }
  `,
  styles: [`
    .user-grid{display:grid;gap:1rem;grid-template-columns:minmax(20rem,.78fr) minmax(25rem,1.22fr)}form,.users-card{padding:1.25rem}form{display:grid;gap:.85rem}.secret-field{position:relative}.secret-field input{padding-right:3rem;width:100%}.secret-field button{align-items:center;background:transparent;border:0;color:var(--slate-500);cursor:pointer;display:flex;height:2.5rem;justify-content:center;position:absolute;right:.3rem;top:50%;transform:translateY(-50%);width:2.5rem}.secret-field svg,.row-actions svg{height:1rem;width:1rem}.field small{color:var(--slate-500);display:block;font-size:.75rem;margin-top:.3rem}.check{align-items:center;display:flex;gap:.55rem}.form-actions,.row-actions{display:flex;flex-wrap:wrap;gap:.5rem}.form-actions{justify-content:flex-end}.user-row{align-items:center;border-bottom:1px solid var(--gray-200);display:flex;gap:1rem;justify-content:space-between;padding:.9rem 0}.user-row small{color:var(--gray-500);display:block;margin-top:.2rem}.user-row span{background:#dcfce7;border-radius:999px;color:#166534;display:inline-block;font-size:.7rem;font-weight:700;margin-top:.4rem;padding:.18rem .5rem}.user-row span.pending{background:#fef3c7;color:#92400e}@media(max-width:900px){.user-grid{grid-template-columns:1fr}}@media(max-width:560px){.user-row{align-items:flex-start;flex-direction:column}.row-actions{width:100%}.row-actions .btn{flex:1}}
  `]
})
export class Usuarios implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly service = inject(UsuariosService);
  private readonly fb = inject(FormBuilder);
  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly editing = signal<ManagedUser | null>(null);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly saving = signal(false);
  protected readonly passwordVisible = signal(false);
  protected readonly pinVisible = signal(false);
  protected readonly form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    cargo: ['', Validators.required],
    password: ['', Validators.minLength(12)],
    pin: ['', Validators.pattern(/^\d{6}$/)],
    rol: ['USUARIO' as UserRole, Validators.required],
    activo: [true]
  });

  ngOnInit(): void {
    if (this.auth.user()?.rol === 'SUPER_USUARIO') this.load();
  }

  protected canSave(): boolean {
    if (this.form.invalid) return false;
    if (this.editing()) return true;
    return (
      this.form.controls.password.value.length >= 12 &&
      /^\d{6}$/.test(this.form.controls.pin.value)
    );
  }

  protected save(): void {
    if (!this.canSave()) return;
    this.saving.set(true);
    this.error.set('');
    this.notice.set('');
    const value = this.form.getRawValue();
    const current = this.editing();
    const request = current
      ? this.service.actualizar(current.id, this.updatePayload(value))
      : this.service.crear(value as CreateUserInput);
    request.subscribe({
      next: () => {
        this.notice.set(current ? 'Usuario actualizado.' : 'Usuario creado.');
        this.cancelEdit();
        this.load();
        this.saving.set(false);
      },
      error: (requestError) => {
        this.error.set(errorMessage(requestError));
        this.saving.set(false);
      }
    });
  }

  protected edit(user: ManagedUser): void {
    this.editing.set(user);
    this.error.set('');
    this.notice.set('');
    this.form.reset({
      nombre: user.nombre,
      email: user.email,
      cargo: user.cargo ?? '',
      password: '',
      pin: '',
      rol: user.rol,
      activo: user.activo
    });
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.passwordVisible.set(false);
    this.pinVisible.set(false);
    this.form.reset({
      nombre: '',
      email: '',
      cargo: '',
      password: '',
      pin: '',
      rol: 'USUARIO',
      activo: true
    });
  }

  protected toggle(user: ManagedUser): void {
    this.service.actualizar(user.id, { activo: !user.activo }).subscribe({
      next: () => this.load(),
      error: (requestError) => this.error.set(errorMessage(requestError))
    });
  }

  private load(): void {
    this.service.listar().subscribe({
      next: (users) => this.users.set(users),
      error: (requestError) => this.error.set(errorMessage(requestError))
    });
  }

  private updatePayload(
    value: ReturnType<typeof this.form.getRawValue>
  ): UpdateUserInput {
    const payload: UpdateUserInput = {
      nombre: value.nombre,
      email: value.email,
      cargo: value.cargo,
      rol: value.rol,
      activo: value.activo
    };
    if (value.password) payload.password = value.password;
    if (value.pin) payload.pin = value.pin;
    return payload;
  }
}
