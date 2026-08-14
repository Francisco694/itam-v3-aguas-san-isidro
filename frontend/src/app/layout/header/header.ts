import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-header',
  template: `
    <button class="menu" type="button" aria-label="Abrir menú" (click)="menu.emit()">☰</button>
    <div class="context"><span class="context__dot"></span><span>Plataforma operativa</span></div>
    <div class="header-end"><span class="date">{{ today }}</span><div class="avatar">TI</div></div>
  `,
  styleUrl: './header.scss'
})
export class Header {
  readonly open = input(false);
  readonly menu = output<void>();
  protected readonly today = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date());
}
