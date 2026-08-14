import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-status-badge',
  template: `<span class="badge" [class]="'badge badge--' + tone()"><span class="dot"></span>{{ label() }}</span>`,
  styleUrl: './status-badge.scss'
})
export class StatusBadge {
  readonly code = input<string | boolean | null>('');
  readonly label = input.required<string>();
  protected readonly tone = computed(() => {
    const code = String(this.code()).toUpperCase();
    if (['DISPONIBLE', 'ACTIVO', 'TRUE', 'OK'].includes(code)) return 'success';
    if (['ASIGNADO', 'ASIGNADA', 'RETENIDO_REVISION'].includes(code)) return 'info';
    if (['DADA_BAJA', 'DADO_BAJA', 'EXTRAVIADA', 'FALSE', 'INACTIVO'].includes(code)) return 'danger';
    return 'neutral';
  });
}
