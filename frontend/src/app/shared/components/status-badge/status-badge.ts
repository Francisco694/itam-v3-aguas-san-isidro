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
    if (['ASIGNADO', 'ASIGNADA'].includes(code)) return 'info';
    if (code.includes('PRESTAMO')) return 'teal';
    if (code.includes('SERVICIO')) return 'warning';
    if (code.includes('RETENIDO') || code.includes('REVISION')) return 'purple';
    if (code.includes('EXTRAVIAD')) return 'dark';
    if (['DADA_BAJA', 'DADO_BAJA', 'FALSE', 'INACTIVO'].includes(code)) return 'danger';
    return 'neutral';
  });
}
