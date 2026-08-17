import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';
import { ConfirmationDialog } from '../../shared/components/confirmation-dialog/confirmation-dialog';
import { ToastViewport } from '../../shared/components/toast-viewport/toast-viewport';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Header, Sidebar, ConfirmationDialog, ToastViewport],
  template: `
    <div class="app-shell">
      <app-header (menu)="sidebarOpen.update((value) => !value)" />
      <div class="shell">
        <aside [class.open]="sidebarOpen()"><app-sidebar (navigate)="sidebarOpen.set(false)" /></aside>
        @if (sidebarOpen()) { <button class="backdrop" aria-label="Cerrar menú" (click)="sidebarOpen.set(false)"></button> }
        <section class="workspace"><main><router-outlet /></main></section>
      </div>
      <app-confirmation-dialog /><app-toast-viewport />
    </div>
  `,
  styleUrl: './main-layout.scss'
})
export class MainLayout { protected readonly sidebarOpen = signal(false); }
