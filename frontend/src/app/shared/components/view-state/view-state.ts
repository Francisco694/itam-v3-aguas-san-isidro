import { Component, input, output } from '@angular/core';
import { LucideCircleAlert, LucideLoaderCircle, LucidePackageOpen } from '@lucide/angular';

@Component({
  selector: 'app-view-state',
  imports: [LucideCircleAlert, LucideLoaderCircle, LucidePackageOpen],
  template: `
    <div class="state" [class.state--error]="kind() === 'error'" role="status">
      <div class="state__icon">@if(kind()==='loading'){<svg class="spin" lucideLoaderCircle></svg>}@else if(kind()==='error'){<svg lucideCircleAlert></svg>}@else{<svg lucidePackageOpen></svg>}</div>
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
