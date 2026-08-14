import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from '../header/header';
import { Sidebar } from '../sidebar/sidebar';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, Header, Sidebar],
  template: `
    <div class="shell">
      <aside [class.open]="sidebarOpen()"><app-sidebar (navigate)="sidebarOpen.set(false)" /></aside>
      @if (sidebarOpen()) { <button class="backdrop" aria-label="Cerrar menú" (click)="sidebarOpen.set(false)"></button> }
      <section class="workspace"><app-header (menu)="sidebarOpen.update((value) => !value)" /><main><router-outlet /></main></section>
    </div>
  `,
  styleUrl: './main-layout.scss'
})
export class MainLayout { protected readonly sidebarOpen = signal(false); }
