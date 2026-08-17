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

@Component({ selector:'app-departamentos-list', imports:[DatePipe,FormsModule,RouterLink,PageHeader,StatusBadge,ViewState], template:`
  <app-page-header title="Departamentos" subtitle="Áreas responsables y unidades de custodia del inventario."><a class="btn btn--primary" routerLink="nuevo">+ Nuevo departamento</a></app-page-header>
  @if(notice()){<div class="notice notice--success">{{notice()}}</div>}@if(actionError()){<div class="notice notice--error">{{actionError()}}</div>}
  <section class="card"><div class="toolbar"><div class="field"><label for="search">Buscar</label><input id="search" [(ngModel)]="query" placeholder="Nombre u observaciones" /></div><div class="field"><label for="status">Estado</label><select id="status" [(ngModel)]="status"><option value="">Todos</option><option value="active">Activos</option><option value="inactive">Inactivos</option></select></div></div>
  @if(loading()){<app-view-state kind="loading" title="Cargando departamentos" />}@else if(error()){<app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" />}@else if(!filtered().length){<app-view-state kind="empty" title="Sin resultados" message="No hay departamentos que coincidan con los filtros." />}@else{
  <div class="table-wrap"><table class="data-table"><thead><tr><th>Departamento</th><th>Observaciones</th><th>Estado</th><th>Actualización</th><th></th></tr></thead><tbody>@for(item of filtered();track item.id){<tr><td class="cell-primary">{{item.nombre}}</td><td class="text-muted">{{item.observaciones||'Sin observaciones'}}</td><td><app-status-badge [code]="item.activo" [label]="item.activo?'Activo':'Inactivo'" /></td><td><span class="cell-secondary">{{item.actualizadoEn|date:'dd-MM-yyyy HH:mm'}}</span></td><td><div class="actions"><a class="btn btn--secondary btn--small" [routerLink]="[item.id]">Ver activos</a><a class="btn btn--ghost btn--small" [routerLink]="[item.id,'editar']">Editar</a>@if(item.activo){<button class="btn btn--danger btn--small" type="button" (click)="deactivate(item)">Desactivar</button>}</div></td></tr>}</tbody></table></div>}
  </section>` })
export class DepartamentosList implements OnInit {
  private readonly service=inject(DepartamentosService);private readonly confirmation=inject(ConfirmationService);
  protected readonly items=signal<Departamento[]>([]);protected readonly loading=signal(true);protected readonly error=signal('');protected readonly actionError=signal('');protected readonly notice=signal('');protected query='';protected status='';
  protected filtered(){const q=this.query.toLowerCase().trim();return this.items().filter(i=>(!q||i.nombre.toLowerCase().includes(q)||(i.observaciones||'').toLowerCase().includes(q))&&(!this.status||(this.status==='active')===i.activo))}
  ngOnInit(){this.load()} protected load(){this.loading.set(true);this.service.listar().subscribe({next:i=>{this.items.set(i);this.loading.set(false)},error:e=>{this.error.set(errorMessage(e));this.loading.set(false)}})}
  protected async deactivate(item:Departamento){if(!await this.confirmation.confirm(`¿Desactivar el departamento ${item.nombre}?`,{title:'Desactivar departamento',confirmLabel:'Desactivar',tone:'danger'}))return;this.actionError.set('');this.service.actualizar(item.id,{activo:false}).subscribe({next:updated=>{this.items.update(items=>items.map(i=>i.id===updated.id?updated:i));this.notice.set('Departamento desactivado correctamente.')},error:e=>this.actionError.set(errorMessage(e))})}
}
