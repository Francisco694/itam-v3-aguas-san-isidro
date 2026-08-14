import { Component, OnInit, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { DispositivosService } from '../../core/services/dispositivos.service';
import { HealthService } from '../../core/services/health.service';
import { SimService } from '../../core/services/sim.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

interface Metric { label: string; value: number; meta: string; }

@Component({
  selector: 'app-dashboard', imports: [PageHeader, ViewState], styleUrl: './dashboard.scss',
  template: `
    <app-page-header title="Resumen operativo" subtitle="Estado actual del inventario tecnológico de Aguas San Isidro." />
    @if (loading()) { <section class="card"><app-view-state kind="loading" title="Consultando inventario" message="Recopilando datos de la API…" /></section> }
    @else if (error()) { <section class="card"><app-view-state kind="error" title="No pudimos cargar el dashboard" [message]="error()" (retry)="load()" /></section> }
    @else {
      <section class="metric-grid" aria-label="Indicadores del inventario">
        @for (metric of metrics(); track metric.label) { <article class="card metric"><span class="metric__label">{{ metric.label }}</span><strong class="metric__value">{{ metric.value }}</strong><p class="metric__meta">{{ metric.meta }}</p></article> }
      </section>
      <section class="dashboard-grid">
        <article class="card summary"><div><p class="eyebrow">Disponibilidad</p><h2>Inventario bajo control</h2><p>Los indicadores se calculan directamente desde los listados vigentes, sin modificar el backend.</p></div><div class="ring"><strong>{{ availability() }}%</strong><span>disponibles</span></div></article>
        <article class="card connectivity"><div class="connectivity__head"><div><p class="eyebrow">Integración</p><h2>Servicios conectados</h2></div><span class="live">En línea</span></div><div class="service-row"><span>API ITAM</span><strong>{{ apiStatus() }}</strong></div><div class="service-row"><span>PostgreSQL</span><strong>{{ databaseStatus() }}</strong></div></article>
      </section>
    }
  `
})
export class Dashboard implements OnInit {
  private readonly dispositivos = inject(DispositivosService); private readonly sims = inject(SimService);
  private readonly colaboradores = inject(ColaboradoresService); private readonly departamentos = inject(DepartamentosService); private readonly health = inject(HealthService);
  protected readonly loading = signal(true); protected readonly error = signal(''); protected readonly metrics = signal<Metric[]>([]);
  protected readonly availability = signal(0); protected readonly apiStatus = signal('—'); protected readonly databaseStatus = signal('—');
  ngOnInit() { this.load(); }
  protected load() {
    this.loading.set(true); this.error.set('');
    forkJoin({ dispositivos: this.dispositivos.listar(), sims: this.sims.listar(), colaboradores: this.colaboradores.listar(), departamentos: this.departamentos.listar(), health: this.health.health(), database: this.health.database() }).subscribe({
      next: ({ dispositivos, sims, colaboradores, departamentos, health, database }) => {
        const available = dispositivos.filter((item) => item.estado.codigo === 'DISPONIBLE').length;
        this.metrics.set([
          { label: 'Total dispositivos', value: dispositivos.length, meta: 'Activos registrados' },
          { label: 'Dispositivos disponibles', value: available, meta: 'Listos para asignación' },
          { label: 'Dispositivos asignados', value: dispositivos.filter((item) => item.estado.codigo === 'ASIGNADO').length, meta: 'Con custodia vigente' },
          { label: 'Dispositivos de baja', value: dispositivos.filter((item) => item.estado.codigo.includes('BAJA')).length, meta: 'Estado terminal' },
          { label: 'Total SIM', value: sims.length, meta: 'Líneas inventariadas' },
          { label: 'SIM asignadas', value: sims.filter((item) => item.estado.codigo === 'ASIGNADA').length, meta: 'Con vínculo vigente' },
          { label: 'Colaboradores activos', value: colaboradores.filter((item) => item.activo).length, meta: 'Disponibles para asignación' },
          { label: 'Departamentos activos', value: departamentos.filter((item) => item.activo).length, meta: 'Áreas operativas' }
        ]);
        this.availability.set(dispositivos.length ? Math.round(available * 100 / dispositivos.length) : 0);
        this.apiStatus.set(health.status); this.databaseStatus.set(database.status); this.loading.set(false);
      },
      error: (error) => { this.error.set(errorMessage(error)); this.loading.set(false); }
    });
  }
}
