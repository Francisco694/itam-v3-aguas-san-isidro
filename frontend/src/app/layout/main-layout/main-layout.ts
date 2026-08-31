import { Component, HostListener, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { ConfirmationDialog } from '../../shared/components/confirmation-dialog/confirmation-dialog';
import { ToastViewport } from '../../shared/components/toast-viewport/toast-viewport';
import { SessionIdleService } from '../../core/services/session-idle.service';
import { SessionIdleDialog } from '../../shared/components/session-idle-dialog/session-idle-dialog';

@Component({
  selector: 'app-main-layout',
  imports: [
    RouterOutlet,
    Header,
    Sidebar,
    ConfirmationDialog,
    ToastViewport,
    SessionIdleDialog
  ],
  template: `
    <div class="app-shell">
      <app-header [menuOpen]="sidebarOpen()" (menu)="sidebarOpen.update((value) => !value)" />
      <div class="shell">
        <aside id="itam-sidebar" [class.open]="sidebarOpen()"><app-sidebar (navigate)="sidebarOpen.set(false)" /></aside>
        @if (sidebarOpen()) { <button class="backdrop" aria-label="Cerrar menú" (click)="sidebarOpen.set(false)"></button> }
        <section class="workspace"><main><router-outlet /></main><footer class="app-footer"><div><strong>ITAM v3.0</strong><span>Information Technology Asset Management</span><span>Gestión de Activos de Tecnología de la Información</span></div><div><span>Sistema desarrollado para Aguas San Isidro.</span><span>Desarrollado por: Francisco Javier Ponce Barril</span><strong>Aguas San Isidro · 2026</strong></div></footer></section>
      </div>
      <app-confirmation-dialog /><app-session-idle-dialog /><app-toast-viewport />
    </div>
  `,
  styleUrl: './main-layout.scss'
})
export class MainLayout {
  private readonly sessionIdle = inject(SessionIdleService);
  protected readonly sidebarOpen = signal(false);

  @HostListener('document:keydown.escape')
  protected closeSidebar(): void {
    this.sidebarOpen.set(false);
  }
}
