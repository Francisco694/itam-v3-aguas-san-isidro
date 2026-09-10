import { Component, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideDroplet,
  LucideKeyRound,
  LucideLogOut,
  LucideMenu,
  LucidePackage,
  LucideUserCog,
  LucideUserMinus
} from '@lucide/angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-header',
  imports: [
    RouterLink,
    LucideDroplet,
    LucideKeyRound,
    LucideLogOut,
    LucideMenu,
    LucidePackage,
    LucideUserCog,
    LucideUserMinus
  ],
  template: `
    <header>
      <div class="header-inner">
        <button
          class="menu"
          type="button"
          aria-label="Abrir menu"
          aria-controls="itam-sidebar"
          [attr.aria-expanded]="menuOpen()"
          (click)="menu.emit()"
        >
          <svg lucideMenu></svg>
        </button>
        <a class="brand" routerLink="/dashboard" aria-label="Inicio ITAM">
          <span class="brand__icon"><svg lucideDroplet></svg></span>
          <span>
            <strong>Aguas San Isidro</strong>
            <small>SISTEMA ITAM</small>
          </span>
        </a>
        <nav aria-label="Accesos rapidos">
          <a routerLink="/dispositivos"><svg lucidePackage></svg>Inventario</a>
          <a routerLink="/offboarding"><svg lucideUserMinus></svg>Offboarding</a>
          @if (auth.user()?.rol === 'SUPER_USUARIO') {
            <a routerLink="/administracion/usuarios">
              <svg lucideUserCog></svg>Usuarios
            </a>
          }
        </nav>
        <div class="user-actions">
          <a
            class="avatar"
            routerLink="/mi-acceso"
            [title]="auth.user()?.debeCambiarPin ? 'Debe personalizar su PIN' : 'Mi acceso'"
          >
            {{ initials() }}
          </a>
          <a
            class="logout pin-access"
            routerLink="/mi-acceso"
            aria-label="Administrar mi PIN"
            title="Administrar mi PIN"
          >
            <svg lucideKeyRound></svg>
          </a>
          <button
            class="logout"
            type="button"
            aria-label="Cerrar sesion"
            title="Cerrar sesion"
            (click)="logout()"
          >
            <svg lucideLogOut></svg>
          </button>
        </div>
      </div>
    </header>
  `,
  styleUrls: ['./header.scss', './header-auth.scss']
})
export class Header {
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly menuOpen = input(false);
  readonly menu = output<void>();

  protected initials(): string {
    return (this.auth.user()?.nombre || 'TI')
      .split(/\s+/)
      .slice(0, 2)
      .map((value) => value[0])
      .join('')
      .toUpperCase();
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login'])
    });
  }
}
