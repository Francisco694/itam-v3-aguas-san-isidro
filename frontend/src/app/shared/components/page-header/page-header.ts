import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <header class="page-heading">
      <div><p class="eyebrow"><span></span>{{ eyebrow() }}</p><h1>{{ title() }}</h1><p class="subtitle">{{ subtitle() }}</p></div>
      <div class="page-actions"><ng-content /></div>
    </header>
  `,
  styleUrl: './page-header.scss'
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly subtitle = input('');
  readonly eyebrow = input('Aguas San Isidro · ITAM v3.0');
}
