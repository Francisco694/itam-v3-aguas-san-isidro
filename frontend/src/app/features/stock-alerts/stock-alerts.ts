import { Component, OnInit, inject, signal } from '@angular/core';
import {
  LucideBell,
  LucideCircleAlert,
  LucideCircleCheck,
  LucideDynamicIcon,
  LucideLaptop,
  LucideMonitor,
  LucidePackage,
  LucidePrinter,
  LucideSave,
  LucideSmartphone,
  type LucideIconInput,
} from '@lucide/angular';
import { forkJoin } from 'rxjs';
import { StockAlertConfiguration } from '../../core/models/itam.models';
import { AuthService } from '../../core/services/auth.service';
import { StockAlertsService } from '../../core/services/stock-alerts.service';
import { ToastService } from '../../core/services/toast.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

interface StockAlertDraft extends StockAlertConfiguration {
  saving?: boolean;
}

@Component({
  selector: 'app-stock-alerts',
  imports: [
    PageHeader,
    ViewState,
    LucideBell,
    LucideCircleAlert,
    LucideCircleCheck,
    LucideDynamicIcon,
    LucideSave,
  ],
  template: `
    <app-page-header
      title="Alertas de stock"
      subtitle="Control de mínimos para la reposición de equipos."
      eyebrow="Inventario"
    />

    <section class="stock-help" aria-label="Cómo funcionan las alertas">
      <span class="stock-help__icon"><svg lucideBell></svg></span>
      <div>
        <strong>¿Cuándo aparece una alerta?</strong>
        <p>La alerta aparece cuando los equipos disponibles son iguales o inferiores al mínimo configurado. Un mínimo de 0 avisa cuando ya no queda ninguno.</p>
      </div>
    </section>

    @if (successMessage()) {
      <div class="notice notice--success save-feedback" role="status">
        <svg lucideCircleCheck></svg><span>{{ successMessage() }}</span>
      </div>
    }
    @if (!canEdit()) {
      <div class="notice notice--info">Puede consultar la configuración. Solo el perfil SUPER_USUARIO puede modificarla.</div>
    }
    @if (loading()) {
      <section class="card"><app-view-state kind="loading" title="Cargando alertas de stock" /></section>
    } @else if (error()) {
      <section class="card"><app-view-state kind="error" title="No se pudieron cargar las alertas" [message]="error()" (retry)="load()" /></section>
    } @else if (!items().length) {
      <section class="card"><app-view-state kind="empty" title="Sin tipos configurados" message="No hay tipos de dispositivo para configurar." /></section>
    } @else {
      <section class="card stock-table" aria-label="Configuración de alertas por tipo">
        <header class="stock-table__head">
          <span>Control de alerta</span>
          <span>Tipo de dispositivo</span>
          <span>Stock disponible</span>
          <span>Mínimo para avisar</span>
          <span>Acción</span>
        </header>

        <div class="stock-table__body">
          @for (item of items(); track item.tipoDispositivo.id) {
            <article
              class="stock-row"
              [class.stock-row--alert]="item.enAlerta"
              [class.stock-row--inactive]="!item.alertaActiva"
            >
              <div class="stock-control" data-label="Control de alerta">
                <label class="stock-switch">
                  <input
                    type="checkbox"
                    [checked]="item.alertaActiva"
                    (change)="changeActive(item, $any($event.target).checked)"
                    [disabled]="!canEdit() || !!item.saving || savingAll()"
                  />
                  <span class="stock-switch__track" aria-hidden="true"><span></span></span>
                  <span class="stock-switch__state">{{ item.alertaActiva ? 'Activa' : 'Inactiva' }}</span>
                  <span class="sr-only">Controlar stock de {{ item.tipoDispositivo.nombre }}</span>
                </label>
              </div>

              <div class="stock-device" data-label="Tipo de dispositivo">
                <span class="stock-device__icon" aria-hidden="true">
                  <svg [lucideIcon]="deviceIcon(item.tipoDispositivo.nombre)"></svg>
                </span>
                <div>
                  <strong>{{ item.tipoDispositivo.nombre }}</strong>
                  @if (item.enAlerta) {
                    <span class="stock-device__warning"><svg lucideCircleAlert></svg>Bajo el mínimo</span>
                  }
                </div>
              </div>

              <div
                class="stock-available"
                [class.stock-available--empty]="item.disponibles === 0"
                data-label="Stock disponible"
              >
                <strong>{{ item.disponibles }}</strong>
                <span>{{ item.disponibles === 0 ? 'AGOTADO' : 'DISPONIBLES' }}</span>
              </div>

              <label class="stock-minimum" data-label="Mínimo para avisar">
                <span>Avisar al llegar a:</span>
                <input
                  type="number"
                  min="0"
                  step="1"
                  [value]="item.minimoDisponible"
                  (input)="changeMinimum(item, $any($event.target).value)"
                  [disabled]="!canEdit() || !!item.saving || savingAll() || !item.alertaActiva"
                  [attr.aria-label]="'Mínimo para ' + item.tipoDispositivo.nombre"
                />
              </label>

              <div class="stock-action" data-label="Acción">
                <button
                  class="btn btn--primary btn--small"
                  type="button"
                  (click)="save(item)"
                  [disabled]="!canEdit() || !!item.saving || savingAll() || !item.alertaActiva"
                >
                  <svg lucideSave></svg>{{ item.saving ? 'Guardando…' : 'Guardar' }}
                </button>
              </div>
            </article>
          }
        </div>

        <footer class="stock-table__footer">
          <p>Los cambios se aplican únicamente a los tipos seleccionados.</p>
          <button
            class="btn btn--primary save-all"
            type="button"
            (click)="saveAll()"
            [disabled]="!canEdit() || savingAll()"
          >
            <svg lucideSave></svg>{{ savingAll() ? 'Guardando cambios…' : 'Guardar todos los cambios' }}
          </button>
        </footer>
      </section>
    }
  `,
  styleUrl: './stock-alerts.scss',
})
export class StockAlerts implements OnInit {
  private readonly service = inject(StockAlertsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly items = signal<StockAlertDraft[]>([]);
  protected readonly loading = signal(true);
  protected readonly savingAll = signal(false);
  protected readonly error = signal('');
  protected readonly successMessage = signal('');

  protected canEdit(): boolean {
    return this.auth.user()?.rol === 'SUPER_USUARIO';
  }

  protected changeMinimum(item: StockAlertDraft, value: string): void {
    item.minimoDisponible = Number(value);
    this.successMessage.set('');
  }

  protected changeActive(item: StockAlertDraft, value: boolean): void {
    item.alertaActiva = value;
    this.successMessage.set('');
    this.items.update((items) => [...items]);
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.successMessage.set('');
    this.service.listar().subscribe({
      next: (items) => {
        this.items.set(this.sortItems(items));
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(errorMessage(error));
        this.loading.set(false);
      },
    });
  }

  protected save(item: StockAlertDraft): void {
    if (!this.isValid(item)) return;

    this.successMessage.set('');
    item.saving = true;
    this.items.update((items) => [...items]);
    this.service.actualizar(Number(item.tipoDispositivo.id), {
      minimoDisponible: item.minimoDisponible,
      alertaActiva: item.alertaActiva,
    }).subscribe({
      next: (updated) => {
        this.items.update((items) => items.map((current) =>
          current.tipoDispositivo.id === updated.tipoDispositivo.id ? updated : current
        ));
        this.successMessage.set(`La configuración de ${updated.tipoDispositivo.nombre} se guardó correctamente.`);
        this.toast.success('Alerta de stock actualizada');
      },
      error: (error) => {
        item.saving = false;
        this.items.update((items) => [...items]);
        this.toast.error('No se pudo guardar', errorMessage(error));
      },
    });
  }

  protected saveAll(): void {
    const items = this.items();
    if (!items.length || !items.every((item) => this.isValid(item))) return;

    this.successMessage.set('');
    this.savingAll.set(true);
    this.items.update((current) => current.map((item) => ({ ...item, saving: true })));
    forkJoin(items.map((item) => this.service.actualizar(Number(item.tipoDispositivo.id), {
      minimoDisponible: item.minimoDisponible,
      alertaActiva: item.alertaActiva,
    }))).subscribe({
      next: (updated) => {
        this.items.set(this.sortItems(updated));
        this.savingAll.set(false);
        this.successMessage.set('Todos los cambios se guardaron correctamente.');
        this.toast.success('Configuración de alertas actualizada');
      },
      error: (error) => {
        this.savingAll.set(false);
        this.items.update((current) => current.map((item) => ({ ...item, saving: false })));
        this.toast.error('No se pudieron guardar todos los cambios', errorMessage(error));
      },
    });
  }

  protected deviceIcon(name: string): LucideIconInput {
    const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (/(SMARTPHONE|TELEFONO|CELULAR)/.test(normalized)) return LucideSmartphone;
    if (/(NOTEBOOK|LAPTOP|PORTATIL)/.test(normalized)) return LucideLaptop;
    if (/(MONITOR|PANTALLA|COMPUTADOR|COMPUTADORA|\bPC\b)/.test(normalized)) return LucideMonitor;
    if (/IMPRESORA/.test(normalized)) return LucidePrinter;
    return LucidePackage;
  }

  private isValid(item: StockAlertDraft): boolean {
    if (Number.isSafeInteger(item.minimoDisponible) && item.minimoDisponible >= 0) return true;
    this.toast.error('Mínimo no válido', `Ingrese para ${item.tipoDispositivo.nombre} un número entero igual o mayor que cero.`);
    return false;
  }

  private sortItems(items: StockAlertConfiguration[]): StockAlertDraft[] {
    const priority = (name: string) => {
      const normalized = name.trim().toLocaleUpperCase('es');
      return normalized === 'SMARTPHONE' ? 0 : normalized === 'NOTEBOOK' ? 1 : 2;
    };
    return [...items].sort((left, right) =>
      priority(left.tipoDispositivo.nombre) - priority(right.tipoDispositivo.nombre)
      || left.tipoDispositivo.nombre.localeCompare(right.tipoDispositivo.nombre, 'es')
    );
  }
}
