import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Departamento } from '../../core/models/itam.models';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { DepartamentosService } from '../../core/services/departamentos.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({
  selector: 'app-departamentos-list',
  imports: [DatePipe, FormsModule, RouterLink, PageHeader, StatusBadge, ViewState],
  template: `
    <app-page-header title="Departamentos" subtitle="Areas responsables y unidades de custodia del inventario.">
      <a class="btn btn--primary" routerLink="nuevo">+ Nuevo departamento</a>
    </app-page-header>
    @if (notice()) { <div class="notice notice--success">{{ notice() }}</div> }
    @if (actionError()) { <div class="notice notice--error">{{ actionError() }}</div> }
    <section class="card">
      <div class="toolbar">
        <div class="field">
          <label for="search">Buscar</label>
          <input id="search" [(ngModel)]="query" placeholder="Departamento o dependencia" />
        </div>
        <div class="field">
          <label for="status">Estado</label>
          <select id="status" [(ngModel)]="status">
            <option value="">Todos</option>
            <option value="active">Activos</option>
            <option value="inactive">Inactivos</option>
          </select>
        </div>
      </div>
      @if (loading()) {
        <app-view-state kind="loading" title="Cargando departamentos" />
      } @else if (error()) {
        <app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" />
      } @else if (!filtered().length) {
        <app-view-state kind="empty" title="Sin resultados" message="No hay departamentos que coincidan con los filtros." />
      } @else {
        <div class="table-wrap desktop-table">
          <table class="data-table">
            <thead><tr><th>Departamento</th><th>Dependencia</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>
              @for (item of filtered(); track item.id) {
                <tr>
                  <td class="cell-primary">{{ item.nombre }}</td>
                  <td>{{ item.dependencia_nombre || 'Nivel principal' }}</td>
                  <td><app-status-badge [code]="item.activo" [label]="item.activo ? 'Activo' : 'Inactivo'" /></td>
                  <td><div class="actions"><a class="btn btn--secondary btn--small" [routerLink]="[item.id]">Ver activos</a><a class="btn btn--ghost btn--small" [routerLink]="[item.id,'editar']">Editar</a>@if (item.activo) { <button class="btn btn--danger btn--small" type="button" (click)="deactivate(item)">Desactivar</button> }</div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mobile-record-list">
          @for (item of filtered(); track item.id) {
            <article class="mobile-record-card">
              <header class="mobile-record-card__top">
                <div><a class="mobile-record-card__title" [routerLink]="[item.id]">{{ item.nombre }}</a><span class="mobile-record-card__subtitle">{{ item.dependencia_nombre || 'Nivel principal' }}</span></div>
                <app-status-badge [code]="item.activo" [label]="item.activo ? 'Activo' : 'Inactivo'" />
              </header>
              <dl class="mobile-record-card__details">
                <div><dt>Dependencia</dt><dd>{{ item.dependencia_nombre || 'Nivel principal' }}</dd></div>
                <div><dt>Actualizacion</dt><dd>{{ item.actualizadoEn | date:'dd-MM-yyyy HH:mm' }}</dd></div>
              </dl>
              <footer class="mobile-record-card__actions department-actions">
                <a class="btn btn--primary" [routerLink]="[item.id]">Ver activos</a>
                <a class="btn btn--secondary" [routerLink]="[item.id,'editar']">Editar</a>
                @if (item.activo) { <button class="btn btn--danger" type="button" (click)="deactivate(item)">Desactivar</button> }
              </footer>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [`@media(max-width:767px){.department-actions:has(.btn--danger){grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:620px){.department-actions:has(.btn--danger){grid-template-columns:1fr}}`]
})
export class DepartamentosList implements OnInit {
  private readonly service = inject(DepartamentosService);
  private readonly confirmation = inject(ConfirmationService);
  protected readonly items = signal<Departamento[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly notice = signal('');
  protected query = '';
  protected status = '';

  protected filtered(): Departamento[] {
    const query = this.query.toLowerCase().trim();
    return this.items().filter((item) =>
      (!query || item.nombre.toLowerCase().includes(query) || (item.dependencia_nombre || '').toLowerCase().includes(query)) &&
      (!this.status || (this.status === 'active') === item.activo)
    );
  }

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.service.listar().subscribe({
      next: (items) => { this.items.set(items); this.loading.set(false); },
      error: (requestError) => { this.error.set(errorMessage(requestError)); this.loading.set(false); }
    });
  }

  protected async deactivate(item: Departamento): Promise<void> {
    if (!await this.confirmation.confirm(`Desactivar el departamento ${item.nombre}?`, { title: 'Desactivar departamento', confirmLabel: 'Desactivar', tone: 'danger' })) return;
    this.actionError.set('');
    this.service.actualizar(item.id, { activo: false }).subscribe({
      next: (updated) => { this.items.update((items) => items.map((current) => current.id === updated.id ? updated : current)); this.notice.set('Departamento desactivado correctamente.'); },
      error: (requestError) => this.actionError.set(errorMessage(requestError))
    });
  }
}
