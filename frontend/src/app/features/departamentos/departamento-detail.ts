import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideBuilding2, LucidePackage, LucideUsers } from '@lucide/angular';
import { Dispositivo, InventarioDepartamento } from '../../core/models/itam.models';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { RutPipe } from '../../shared/pipes/rut.pipe';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-departamento-detail',
  imports: [
    RouterLink,
    PageHeader,
    StatusBadge,
    ViewState,
    LucideBuilding2,
    LucidePackage,
    LucideUsers,
    RutPipe,
  ],
  template: `
    <app-page-header
      title="Detalle operacional del departamento"
      subtitle="Custodia directa y activos personales relacionados, sin mezclar responsabilidades."
      ><a class="btn btn--secondary" routerLink="/departamentos">Volver</a></app-page-header
    >
    @if (loading()) {
      <section class="card">
        <app-view-state kind="loading" title="Cargando inventario del departamento" />
      </section>
    } @else if (error()) {
      <section class="card">
        <app-view-state
          kind="error"
          title="No se pudo cargar"
          [message]="error()"
          (retry)="load()"
        />
      </section>
    } @else if (data(); as info) {
      <section class="department-banner">
        <div>
          <svg lucideBuilding2></svg><span>DEPARTAMENTO</span>
          <h2>{{ info.departamento.nombre }}</h2>
          <p>{{ info.departamento.observaciones || 'Sin observaciones' }}</p>
        </div>
        <app-status-badge
          [code]="info.departamento.activo"
          [label]="info.departamento.activo ? 'Activo' : 'Inactivo'"
        />
      </section>
      <section class="department-metrics">
        <article class="card">
          <span>Custodia directa</span><strong>{{ info.resumen.custodiaDirecta }}</strong>
        </article>
        <article class="card">
          <span>Con colaboradores</span><strong>{{ info.resumen.conColaboradores }}</strong>
        </article>
        <article class="card">
          <span>Total relacionado</span><strong>{{ info.resumen.totalRelacionado }}</strong>
        </article>
      </section>
      <section class="custody-role-guide" aria-label="Roles de la cadena de custodia">
        <article>
          <span>01 · CUSTODIA</span>
          <strong>Departamento</strong>
          <p>Unidad institucional responsable del activo compartido.</p>
        </article>
        <article>
          <span>02 · RECEPCIÓN FÍSICA</span>
          <strong>Persona que recepciona</strong>
          <p>Colaborador que confirma la entrega física para el departamento.</p>
        </article>
        <article>
          <span>03 · REGISTRO</span>
          <strong>Responsable TI</strong>
          <p>Persona de TI que ejecuta la operación y queda registrada en la trazabilidad.</p>
        </article>
      </section>
      <section class="card inventory-section">
        <header>
          <svg lucidePackage></svg>
          <div>
            <h3>Activos asignados directamente al departamento</h3>
            <p>Custodia institucional compartida o general.</p>
          </div>
        </header>
        @if (!info.custodiaDirecta.length) {
          <app-view-state
            kind="empty"
            title="Sin custodia directa"
            message="No hay activos asignados directamente a este departamento."
          />
        } @else {
          <div class="asset-grid">
            @for (device of info.custodiaDirecta; track device.id) {
              <a class="asset-row" [routerLink]="['/dispositivos', device.codigoInventario]"
                ><div>
                  <strong
                    >{{ device.tipo.nombre }} {{ device.marca || '' }}
                    {{ device.modelo || '' }}</strong
                  ><span class="code"
                    >Código {{ device.codigoInventario }} · SN {{ device.numeroSerie || '—' }}</span
                  >
                  <div class="custody-detail">
                    <span><b>Custodio:</b> {{ info.departamento.nombre }}</span>
                    <span
                      ><b>Recepciona:</b> {{ device.recibidoPor?.nombre || 'No informado' }}</span
                    >
                    <span><b>Responsable TI:</b> disponible en la trazabilidad de la ficha</span>
                  </div>
                </div>
                <app-status-badge [code]="device.estado.codigo" [label]="device.estado.nombre"
              /></a>
            }
          </div>
        }
      </section>
      <section class="card inventory-section">
        <header>
          <svg lucideUsers></svg>
          <div>
            <h3>Activos de colaboradores del departamento</h3>
            <p>El custodio directo es cada colaborador; el departamento es un dato derivado.</p>
          </div>
        </header>
        @if (!info.activosColaboradores.length) {
          <app-view-state
            kind="empty"
            title="Sin activos personales"
            message="Los colaboradores del departamento no tienen activos asignados."
          />
        } @else {
          @for (group of grouped(info.activosColaboradores); track group.id) {
            <article class="person-group">
              <header>
                <div>
                  <strong>{{ group.nombre }}</strong
                  ><span>{{ group.rut | rut }}</span>
                </div>
                <b>{{ group.assets.length }} activo{{ group.assets.length === 1 ? '' : 's' }}</b>
              </header>
              <div class="asset-grid">
                @for (device of group.assets; track device.id) {
                  <a class="asset-row" [routerLink]="['/dispositivos', device.codigoInventario]"
                    ><div>
                      <strong
                        >{{ device.tipo.nombre }} {{ device.marca || '' }}
                        {{ device.modelo || '' }}</strong
                      ><span class="code"
                        >Código {{ device.codigoInventario }} · SN
                        {{ device.numeroSerie || '—' }}</span
                      >
                    </div>
                    <app-status-badge [code]="device.estado.codigo" [label]="device.estado.nombre"
                  /></a>
                }
              </div>
            </article>
          }
        }
      </section>
    }
  `,
  styles: [
    `
      .department-banner {
        align-items: center;
        background: linear-gradient(135deg, var(--navy), #07147c);
        border-bottom: 4px solid var(--cyan);
        border-radius: 1rem;
        color: #fff;
        display: flex;
        justify-content: space-between;
        margin-bottom: 1rem;
        padding: 1.4rem;
      }
      .department-banner svg {
        color: var(--cyan);
        height: 1.4rem;
      }
      .department-banner span {
        display: block;
        font-size: 0.65rem;
        font-weight: 800;
        letter-spacing: 0.1em;
        margin-top: 0.5rem;
      }
      .department-banner h2 {
        margin: 0.2rem 0;
      }
      .department-banner p {
        color: #cbd5e1;
        margin: 0;
      }
      .department-metrics {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(3, 1fr);
        margin-bottom: 1rem;
      }
      .department-metrics article {
        border-bottom: 4px solid var(--cyan);
        padding: 1rem;
      }
      .department-metrics span {
        color: var(--slate-500);
        font-size: 0.72rem;
        font-weight: 750;
      }
      .department-metrics strong {
        display: block;
        font-size: 1.8rem;
        margin-top: 0.3rem;
      }
      .custody-role-guide {
        display: grid;
        gap: 0.8rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-bottom: 1rem;
      }
      .custody-role-guide article {
        background: #fff;
        border: 1px solid var(--gray-200);
        border-left: 3px solid var(--cyan);
        border-radius: 0.8rem;
        padding: 0.9rem;
      }
      .custody-role-guide span {
        color: var(--blue);
        display: block;
        font-size: 0.58rem;
        font-weight: 850;
        letter-spacing: 0.09em;
      }
      .custody-role-guide strong {
        display: block;
        font-size: 0.82rem;
        margin-top: 0.25rem;
      }
      .custody-role-guide p {
        color: var(--slate-500);
        font-size: 0.68rem;
        line-height: 1.45;
        margin: 0.25rem 0 0;
      }
      .inventory-section {
        margin-bottom: 1rem;
        padding: 1.2rem;
      }
      .inventory-section > header {
        align-items: center;
        border-bottom: 1px solid var(--gray-200);
        display: flex;
        gap: 0.7rem;
        margin: -1.2rem -1.2rem 1rem;
        padding: 1rem 1.2rem;
      }
      .inventory-section > header svg {
        color: var(--blue);
        height: 1.2rem;
      }
      .inventory-section h3 {
        font-size: 1rem;
        margin: 0;
      }
      .inventory-section header p {
        color: var(--slate-500);
        font-size: 0.72rem;
        margin: 0.2rem 0 0;
      }
      .asset-grid {
        display: grid;
        gap: 0.55rem;
      }
      .asset-row {
        align-items: center;
        border: 1px solid var(--gray-200);
        border-radius: 0.75rem;
        color: inherit;
        display: flex;
        justify-content: space-between;
        padding: 0.8rem;
        text-decoration: none;
      }
      .asset-row:hover {
        background: var(--gray-50);
        border-color: #bae6fd;
      }
      .asset-row strong,
      .asset-row span {
        display: block;
      }
      .asset-row span {
        color: var(--slate-500);
        font-size: 0.7rem;
        margin-top: 0.2rem;
      }
      .asset-row .custody-detail {
        display: flex;
        flex-wrap: wrap;
        gap: 0.2rem 0.8rem;
        margin-top: 0.45rem;
      }
      .asset-row .custody-detail span {
        margin: 0;
      }
      .custody-detail b {
        color: var(--slate-700);
      }
      .person-group {
        border-top: 1px solid var(--gray-200);
        padding-top: 1rem;
      }
      .person-group:first-of-type {
        border-top: 0;
      }
      .person-group > header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 0.6rem;
      }
      .person-group header span {
        color: var(--slate-500);
        display: block;
        font-size: 0.7rem;
      }
      @media (max-width: 700px) {
        .department-metrics,
        .custody-role-guide {
          grid-template-columns: 1fr;
        }
        .asset-row {
          align-items: flex-start;
          gap: 0.5rem;
        }
      }
    `,
  ],
})
export class DepartamentoDetail implements OnInit {
  private readonly service = inject(DepartamentosService);
  private readonly route = inject(ActivatedRoute);
  protected readonly data = signal<InventarioDepartamento | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  private id = '';
  ngOnInit() {
    this.id = this.route.snapshot.paramMap.get('id') || '';
    this.load();
  }
  protected load() {
    this.loading.set(true);
    this.error.set('');
    this.service.inventario(this.id).subscribe({
      next: (value) => {
        this.data.set(value);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
  protected grouped(items: Dispositivo[]) {
    const groups = new Map<
      string,
      { id: string; nombre: string; rut: string; assets: Dispositivo[] }
    >();
    for (const item of items) {
      if (!item.colaborador) continue;
      const current = groups.get(item.colaborador.id) ?? {
        id: item.colaborador.id,
        nombre: item.colaborador.nombre,
        rut: item.colaborador.rut,
        assets: [],
      };
      current.assets.push(item);
      groups.set(current.id, current);
    }
    return [...groups.values()];
  }
}
