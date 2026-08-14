import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Estado, TipoEntidad } from '../../core/models/itam.models';
import { EstadosService } from '../../core/services/estados.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { ViewState } from '../../shared/components/view-state/view-state';
import { errorMessage } from '../../shared/utils/error-message';

@Component({ selector: 'app-estados-list', imports: [FormsModule, PageHeader, StatusBadge, ViewState], template: `
  <app-page-header title="Estados" subtitle="Catálogo consultivo de estados habilitados por tipo de entidad." />
  <section class="card"><div class="toolbar"><div class="field"><label for="tipo">Tipo de entidad</label><select id="tipo" [(ngModel)]="tipo" (ngModelChange)="load()"><option value="">Todos</option><option value="DISPOSITIVO">Dispositivo</option><option value="SIM">SIM</option></select></div></div>
  @if(loading()){<app-view-state kind="loading" title="Cargando estados" />}@else if(error()){<app-view-state kind="error" title="No se pudo cargar" [message]="error()" (retry)="load()" />}@else if(!estados().length){<app-view-state kind="empty" title="Sin estados" message="No hay estados para el filtro seleccionado." />}@else{
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Código</th><th>Nombre</th><th>Entidad</th><th>Descripción</th><th>Condición</th></tr></thead><tbody>@for(estado of estados();track estado.id){<tr><td class="cell-primary">{{estado.codigo}}</td><td>{{estado.nombre}}</td><td>{{estado.tipoEntidad}}</td><td class="text-muted">{{estado.descripcion || '—'}}</td><td><app-status-badge [code]="estado.esTerminal ? 'DADA_BAJA' : estado.activo" [label]="estado.esTerminal ? 'Terminal' : (estado.activo ? 'Activo' : 'Inactivo')" /></td></tr>}</tbody></table></div>
  }</section>` })
export class EstadosList implements OnInit {
  private readonly service=inject(EstadosService); protected readonly estados=signal<Estado[]>([]); protected readonly loading=signal(true); protected readonly error=signal(''); protected tipo:TipoEntidad|''='';
  ngOnInit(){this.load()} protected load(){this.loading.set(true);this.error.set('');this.service.listar(this.tipo||undefined).subscribe({next:(items)=>{this.estados.set(items);this.loading.set(false)},error:(e)=>{this.error.set(errorMessage(e));this.loading.set(false)}})}
}
