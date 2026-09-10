import { Component, OnInit, inject, signal } from '@angular/core';
import { LucideBell, LucideCircleAlert, LucideSave } from '@lucide/angular';
import { StockAlertConfiguration } from '../../core/models/itam.models';
import { AuthService } from '../../core/services/auth.service';
import { StockAlertsService } from '../../core/services/stock-alerts.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

interface StockAlertDraft extends StockAlertConfiguration { saving?: boolean; }

@Component({
  selector: 'app-stock-alerts',
  imports: [PageHeader, ViewState, LucideBell, LucideCircleAlert, LucideSave],
  template: `
    <app-page-header title="Alertas de stock" subtitle="Control de mínimos para la reposición de equipos." eyebrow="Inventario" />
    <section class="stock-help"><svg lucideBell></svg><p>La alerta aparece cuando los equipos disponibles son iguales o inferiores al mínimo configurado. Un mínimo de 0 avisa cuando ya no queda ninguno.</p></section>
    @if (!canEdit()) {<div class="notice notice--info">Puede consultar la configuración. Solo el perfil SUPER_USUARIO puede modificarla.</div>}
    @if (loading()) {<section class="card"><app-view-state kind="loading" title="Cargando alertas de stock" /></section>}
    @else if (error()) {<section class="card"><app-view-state kind="error" title="No se pudieron cargar las alertas" [message]="error()" (retry)="load()" /></section>}
    @else if (!items().length) {<section class="card"><app-view-state kind="empty" title="Sin tipos activos" message="No hay tipos de dispositivo activos para configurar." /></section>}
    @else {
      <section class="stock-grid" aria-label="Configuración de alertas por tipo">
        @for (item of items(); track item.tipoDispositivo.id) {
          <article class="card stock-card" [class.stock-card--alert]="item.enAlerta">
            <header><div><span>{{item.tipoDispositivo.nombre}}</span><strong>{{item.disponibles}}</strong><small>disponibles actualmente</small></div><svg lucideCircleAlert [attr.aria-label]="item.enAlerta ? 'Alerta activa' : 'Stock controlado'"></svg></header>
            <div class="stock-state"><span>Estado de la alerta</span><b [class.active]="item.alertaActiva">{{item.alertaActiva ? (item.enAlerta ? 'Reponer stock' : 'Activa') : 'Desactivada'}}</b></div>
            <label class="field"><span>Mínimo configurado</span><input type="number" min="0" step="1" [value]="item.minimoDisponible" (input)="changeMinimum(item, $any($event.target).value)" [disabled]="!canEdit() || !!item.saving" /></label>
            <label class="stock-toggle"><input type="checkbox" [checked]="item.alertaActiva" (change)="changeActive(item, $any($event.target).checked)" [disabled]="!canEdit() || !!item.saving" /><span>Alerta activa</span></label>
            <button class="btn btn--primary" type="button" (click)="save(item)" [disabled]="!canEdit() || !!item.saving"><svg lucideSave></svg>{{item.saving ? 'Guardando…' : 'Guardar'}}</button>
          </article>
        }
      </section>
    }
  `,
  styleUrl: './stock-alerts.scss'
})
export class StockAlerts implements OnInit {
  private readonly service = inject(StockAlertsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  protected readonly items = signal<StockAlertDraft[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected canEdit(): boolean { return this.auth.user()?.rol === 'SUPER_USUARIO'; }
  protected changeMinimum(item: StockAlertDraft, value: string): void { item.minimoDisponible = Number(value); }
  protected changeActive(item: StockAlertDraft, value: boolean): void { item.alertaActiva = value; }
  ngOnInit(): void { this.load(); }
  protected load(): void {
    this.loading.set(true); this.error.set('');
    this.service.listar().subscribe({
      next: (items) => { this.items.set(items); this.loading.set(false); },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); }
    });
  }
  protected save(item: StockAlertDraft): void {
    if (!Number.isSafeInteger(item.minimoDisponible) || item.minimoDisponible < 0) {
      this.toast.error('Mínimo no válido', 'Ingrese un número entero igual o mayor que cero.');
      return;
    }
    item.saving = true; this.items.update((items) => [...items]);
    this.service.actualizar(Number(item.tipoDispositivo.id), {
      minimoDisponible: item.minimoDisponible,
      alertaActiva: item.alertaActiva
    }).subscribe({
      next: (updated) => {
        this.items.update((items) => items.map((current) => current.tipoDispositivo.id === updated.tipoDispositivo.id ? updated : current));
        this.toast.success('Alerta de stock actualizada');
      },
      error: (error) => {
        item.saving = false; this.items.update((items) => [...items]);
        this.toast.error('No se pudo guardar', errorMessage(error));
      }
    });
  }
}
