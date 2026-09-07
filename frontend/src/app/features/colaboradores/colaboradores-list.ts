import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Colaborador, Departamento } from '../../core/models/itam.models';
import { ColaboradoresService } from '../../core/services/colaboradores.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-colaboradores-list',
  imports: [FormsModule, RouterLink, PageHeader, StatusBadge, ViewState],
  template: `
    <app-page-header
      title="Colaboradores"
      subtitle="Colaboradores habilitados para recibir equipos y líneas corporativas."
    >
      <a class="btn btn--primary" routerLink="nuevo">+ Nuevo colaborador</a>
    </app-page-header>
    @if (notice()) { <div class="notice notice--success">{{ notice() }}</div> }
    @if (actionError()) { <div class="notice notice--error">{{ actionError() }}</div> }

    <section class="card">
      <form class="toolbar" (ngSubmit)="load()">
        <div class="field">
          <label for="name">Nombre</label>
          <input id="name" name="name" [(ngModel)]="filters.nombre" placeholder="Buscar por nombre" />
        </div>
        <div class="field">
          <label for="rut">RUT</label>
          <input id="rut" name="rut" [(ngModel)]="filters.rut" placeholder="12.345.678-9" />
        </div>
        <div class="field">
          <label for="department">Departamento</label>
          <select id="department" name="department" [(ngModel)]="filters.departamentoId">
            <option value="">Todos</option>
            @for (item of departments(); track item.id) {
              <option [value]="item.id">{{ item.nombre }}</option>
            }
          </select>
        </div>
        <div class="field">
          <label for="active">Estado</label>
          <select id="active" name="active" [(ngModel)]="active">
            <option value="">Todos</option>
            <option value="true">Habilitados</option>
            <option value="false">Inactivos</option>
          </select>
        </div>
        <div class="toolbar-actions">
          <button class="btn btn--primary" type="submit">Filtrar</button>
          <button class="btn btn--secondary" type="button" (click)="clear()">Limpiar</button>
        </div>
      </form>

      @if (loading()) {
        <app-view-state kind="loading" title="Cargando colaboradores" />
      } @else if (error()) {
        <app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" />
      } @else if (!items().length) {
        <app-view-state kind="empty" title="Sin resultados" message="No hay colaboradores que coincidan con los filtros." />
      } @else {
        <div class="table-wrap desktop-table">
          <table class="data-table">
            <thead><tr><th>Colaborador</th><th>RUT</th><th>Cargo</th><th>Departamento</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (item of items(); track item.id) {
                <tr>
                  <td><a class="cell-primary link" [routerLink]="[item.id]">{{ item.nombre }}</a><span class="cell-secondary">{{ item.localidad || 'Sin localidad' }}</span></td>
                  <td>{{ item.rut }}</td>
                  <td>{{ item.cargo || 'Sin cargo' }}</td>
                  <td>{{ item.departamento?.nombre || 'Sin departamento' }}</td>
                  <td><app-status-badge [code]="item.activo" [label]="item.activo ? 'Activo' : 'Inactivo'" /></td>
                  <td><div class="actions"><a class="btn btn--ghost btn--small" [routerLink]="[item.id]">Ver</a><a class="btn btn--ghost btn--small" [routerLink]="[item.id,'editar']">Editar</a>@if (item.activo) { <button class="btn btn--danger btn--small" type="button" (click)="deactivate(item)">Desactivar</button> }</div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mobile-record-list">
          @for (item of items(); track item.id) {
            <article class="mobile-record-card">
              <header class="mobile-record-card__top">
                <div><a class="mobile-record-card__title" [routerLink]="[item.id]">{{ item.nombre }}</a><span class="mobile-record-card__subtitle">{{ item.rut }}</span></div>
                <app-status-badge [code]="item.activo" [label]="item.activo ? 'Activo' : 'Inactivo'" />
              </header>
              <dl class="mobile-record-card__details">
                <div><dt>Cargo</dt><dd>{{ item.cargo || 'Sin cargo' }}</dd></div>
                <div><dt>Departamento</dt><dd>{{ item.departamento?.nombre || 'Sin departamento' }}</dd></div>
                <div><dt>Localidad</dt><dd>{{ item.localidad || 'Sin localidad' }}</dd></div>
              </dl>
              <footer class="mobile-record-card__actions">
                <a class="btn btn--primary" [routerLink]="[item.id]">Ver</a>
                <a class="btn btn--secondary" [routerLink]="[item.id,'editar']">Editar</a>
                @if (item.activo) { <button class="btn btn--danger" type="button" (click)="deactivate(item)">Desactivar</button> }
              </footer>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [`.link{color:var(--color-primary);text-decoration:none}@media(max-width:767px){.mobile-record-card__actions:has(.btn--danger){grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:560px){.mobile-record-card__actions:has(.btn--danger){grid-template-columns:1fr}}`]
})
export class ColaboradoresList implements OnInit {
  private readonly service = inject(ColaboradoresService);
  private readonly deptService = inject(DepartamentosService);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly items = signal<Colaborador[]>([]);
  protected readonly departments = signal<Departamento[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly notice = signal('');
  protected readonly actionError = signal('');
  protected filters = { nombre: '', rut: '', departamentoId: '' };
  protected active = '';

  ngOnInit(): void {
    this.deptService.listar().subscribe({ next: (items) => this.departments.set(items.filter((item) => item.activo)) });
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.listar({
      nombre: this.filters.nombre || undefined,
      rut: this.filters.rut || undefined,
      departamentoId: this.filters.departamentoId ? Number(this.filters.departamentoId) : undefined,
      activo: this.active === '' ? undefined : this.active === 'true'
    }).subscribe({
      next: (items) => { this.items.set(items); this.loading.set(false); },
      error: (requestError) => { this.error.set(errorMessage(requestError)); this.loading.set(false); }
    });
  }

  protected clear(): void {
    this.filters = { nombre: '', rut: '', departamentoId: '' };
    this.active = '';
    this.load();
  }

  protected async deactivate(item: Colaborador): Promise<void> {
    if (!await this.confirmation.confirm(`Desactivar a ${item.nombre}?`, { title: 'Desactivar colaborador', confirmLabel: 'Desactivar', tone: 'danger' })) return;
    this.service.actualizar(item.id, { activo: false }).subscribe({
      next: (updated) => { this.items.update((items) => items.map((current) => current.id === updated.id ? updated : current)); this.notice.set('Colaborador desactivado correctamente.'); },
      error: (requestError) => this.actionError.set(errorMessage(requestError))
    });
  }
}
