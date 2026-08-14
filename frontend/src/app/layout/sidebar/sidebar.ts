import { Component, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="brand"><span class="brand__mark">ASI</span><div><strong>ITAM</strong><small>Aguas San Isidro</small></div></div>
    <nav aria-label="Navegación principal">
      <p class="nav-label">Inventario TI</p>
      @for (item of items; track item.path) {
        <a [routerLink]="item.path" routerLinkActive="active" (click)="navigate.emit()"><span class="nav-icon">{{ item.icon }}</span>{{ item.label }}</a>
      }
    </nav>
    <div class="sidebar-footer"><span class="status-dot"></span><div><strong>ITAM v3.0</strong><small>Sistema interno</small></div></div>
  `,
  styleUrl: './sidebar.scss'
})
export class Sidebar {
  readonly navigate = output<void>();
  protected readonly items = [
    { path: '/dashboard', label: 'Dashboard', icon: '⌂' },
    { path: '/departamentos', label: 'Departamentos', icon: '▦' },
    { path: '/colaboradores', label: 'Colaboradores', icon: '♙' },
    { path: '/dispositivos', label: 'Dispositivos', icon: '▣' },
    { path: '/sim', label: 'SIM', icon: '▤' },
    { path: '/estados', label: 'Estados', icon: '◉' }
  ];
}
