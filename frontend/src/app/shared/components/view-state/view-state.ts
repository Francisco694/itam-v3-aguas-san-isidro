import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-view-state',
  template: `
    <div class="state" [class.state--error]="kind() === 'error'" role="status">
      <div class="state__icon">{{ kind() === 'loading' ? '···' : kind() === 'error' ? '!' : '○' }}</div>
      <strong>{{ title() }}</strong><p>{{ message() }}</p>
      @if (kind() === 'error') { <button class="btn btn--secondary" type="button" (click)="retry.emit()">Reintentar</button> }
    </div>
  `,
  styleUrl: './view-state.scss'
})
export class ViewState {
  readonly kind = input.required<'loading' | 'error' | 'empty'>();
  readonly title = input.required<string>();
  readonly message = input('');
  readonly retry = output<void>();
}
