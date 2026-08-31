import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import {
  LucideCircleCheck,
  LucidePackageCheck,
  LucideRotateCcw,
} from '@lucide/angular';
import {
  OffboardingAsset,
  OffboardingProcessDetail,
} from '../../core/models/offboarding.models';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { formatClp } from '../../shared/utils/currency';

@Component({
  selector: 'app-offboarding-process-detail',
  imports: [DatePipe, StatusBadge, LucideCircleCheck, LucidePackageCheck, LucideRotateCcw],
  template: `
    <section class="process-detail" aria-label="Detalle del proceso de salida">
      <header class="process-detail__header">
        <div>
          <span>PROCESO DE SALIDA</span>
          <h3>Recuperar equipos de {{ process().colaborador.nombre }}</h3>
          <p>
            {{ process().colaborador.rut }} ·
            {{ process().colaborador.departamento?.nombre || 'Sin departamento' }}
          </p>
        </div>
        <app-status-badge code="ABIERTO" label="En proceso" />
      </header>

      <div class="process-detail__meta">
        <span>Iniciado por {{ process().usuarioInicio.nombre }}</span>
        <span>{{ process().fechaInicio | date: 'dd/MM/yyyy HH:mm' }}</span>
      </div>

      <div class="process-values">
        <div><span>Equipos por recuperar</span><strong>{{ process().equiposPendientes }}</strong></div>
        <div><span>Valor total</span><strong>{{ clp(process().valorTotal) }}</strong></div>
        <div><span>Valor recuperado</span><strong>{{ clp(process().valorRecuperado) }}</strong></div>
        <div><span>Valor pendiente</span><strong>{{ clp(process().valorPendiente) }}</strong></div>
      </div>

      @if (process().activosPendientes.length) {
        <div class="asset-list">
          @for (asset of process().activosPendientes; track asset.id) {
            <article class="asset-card">
              <span class="asset-card__icon"><svg lucidePackageCheck></svg></span>
              <div class="asset-card__identity">
                <small>{{ asset.tipo.nombre }}</small>
                <strong>{{ asset.marca || 'Sin marca' }} {{ asset.modelo || '' }}</strong>
                <span class="code">Código ITAM {{ asset.codigoInventario }}</span>
                @if (asset.imei) {
                  <span>IMEI {{ asset.imei }}</span>
                } @else if (asset.numeroSerie) {
                  <span>Serie {{ asset.numeroSerie }}</span>
                }
              </div>
              <div class="asset-card__status">
                <app-status-badge [code]="asset.estado.codigo" [label]="asset.estado.nombre" />
                <strong>{{ clp(asset.valorComercial) }}</strong>
              </div>
              <button class="btn btn--primary btn--small" type="button" (click)="resolve.emit(asset)">
                <svg lucideRotateCcw></svg>Resolver activo
              </button>
            </article>
          }
        </div>
        <p class="close-help">Para completar el proceso primero deben resolverse todos los equipos.</p>
      } @else {
        <div class="resolved-state">
          <svg lucideCircleCheck></svg>
          <div><strong>Sin equipos pendientes</strong><span>El proceso ya puede completarse.</span></div>
        </div>
      }

      <footer>
        <button
          class="btn btn--primary"
          type="button"
          [disabled]="process().equiposPendientes > 0 || closing()"
          (click)="complete.emit()"
        >
          <svg lucideCircleCheck></svg>{{ closing() ? 'Completando…' : 'Completar proceso' }}
        </button>
      </footer>
    </section>
  `,
  styleUrl: './offboarding-process-detail.scss',
})
export class OffboardingProcessDetailComponent {
  readonly process = input.required<OffboardingProcessDetail>();
  readonly closing = input(false);
  readonly resolve = output<OffboardingAsset>();
  readonly complete = output<void>();
  protected readonly clp = formatClp;
}
