import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ActaEntrega, ComprobanteDevolucion } from '../../core/models/itam.models';
import { ActasEntregaService } from '../../core/services/actas-entrega.service';
import { ComprobantesDevolucionService } from '../../core/services/comprobantes-devolucion.service';
import { ActaPreview } from '../../shared/components/acta-preview/acta-preview';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { ComprobanteDevolucionPreview } from '../../shared/components/document-preview/comprobante-devolucion-preview';
import { formatClp } from '../../shared/utils/currency';
import { errorMessage } from '../../shared/utils/error-message';
@Component({
  selector: 'app-actas',
  imports: [DatePipe, RouterLink, ActaPreview, ComprobanteDevolucionPreview, PageHeader, ViewState],
  template: `<app-page-header
      title="Actas de entrega"
      subtitle="Documentos persistidos y numerados de asignaciones."
      eyebrow="Custodia documental"
      ><a class="btn btn--secondary" routerLink="/servicio-tecnico"
        >Servicio técnico</a
      ></app-page-header
    >
    @if (loading()) {
      <section class="card"><app-view-state kind="loading" title="Cargando actas" /></section>
    } @else if (error()) {
      <section class="card">
        <app-view-state kind="error" title="No se pudieron cargar las actas" [message]="error()" />
      </section>
    } @else if (!items().length) {
      <section class="card">
        <app-view-state
          kind="empty"
          title="Sin actas registradas"
          message="Las actas se generan al asignar equipos."
        />
      </section>
    } @else {
      <section class="card">
        <div class="table-wrap desktop-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Destinatario</th>
                <th>Equipos</th>
                <th>Valor total</th>
                <th>Estado</th>
                <th>Devolución</th>
                <th>Documentos</th>
              </tr>
            </thead>
            <tbody>
              @for (acta of items(); track acta.id) {
                <tr>
                  <td class="code">{{ acta.numeroActa }}</td>
                  <td>{{ acta.fecha | date: 'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ acta.colaborador?.nombre || acta.departamento?.nombre }}</td>
                  <td>{{ acta.dispositivos.length }}</td>
                  <td>{{ clp(acta.valorTotal) }}</td>
                  <td><span class="state-pill">{{ statusLabel(acta.estadoDocumental) }}</span></td>
                  <td>{{ returnedCount(acta) }} de {{ acta.dispositivos.length }}</td>
                  <td><div class="actions">
                    <button
                      class="btn btn--secondary btn--small"
                      type="button"
                      (click)="selected.set(acta)"
                    >
                      Ver acta
                    </button>
                    @for(device of acta.dispositivos;track device.id){@if(device.devolucion){<button class="btn btn--ghost btn--small" type="button" (click)="openReturn(device.devolucion.id)">Ver {{device.devolucion.numeroComprobante}}</button>}@else if(device.devuelto){<small>Sin comprobante histórico</small>}}
                  </div></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mobile-record-list acta-mobile-list">
          @for (acta of items(); track acta.id) {
            <article class="mobile-record-card">
              <header class="mobile-record-card__top">
                <div><strong class="mobile-record-card__title code">{{ acta.numeroActa }}</strong><span class="mobile-record-card__subtitle">{{ acta.fecha | date:'dd/MM/yyyy HH:mm' }}</span></div>
                <span class="state-pill">{{ statusLabel(acta.estadoDocumental) }}</span>
              </header>
              <dl class="mobile-record-card__details">
                <div><dt>Destinatario</dt><dd>{{ acta.colaborador?.nombre || acta.departamento?.nombre }}</dd></div>
                <div><dt>Equipos</dt><dd>{{ acta.dispositivos.length }}</dd></div>
                <div><dt>Valor total</dt><dd>{{ clp(acta.valorTotal) }}</dd></div>
                <div><dt>Devolucion</dt><dd>{{ returnedCount(acta) }} de {{ acta.dispositivos.length }}</dd></div>
              </dl>
              <footer class="mobile-record-card__actions">
                <button class="btn btn--primary" type="button" (click)="selected.set(acta)">Ver acta</button>
                @for(device of acta.dispositivos;track device.id){
                  @if(device.devolucion){
                    <button class="btn btn--secondary" type="button" (click)="openReturn(device.devolucion.id)">Ver {{device.devolucion.numeroComprobante}}</button>
                  }
                }
              </footer>
            </article>
          }
        </div>
      </section>
    }
    @if (selected(); as acta) {
      <app-acta-preview
        [acta]="acta"
        [pdfUrl]="service.pdfUrl(acta.id)"
        (close)="selected.set(null)"
      />
    }
    @if(selectedReturn();as proof){<app-comprobante-devolucion-preview [comprobante]="proof" [pdfUrl]="returns.pdfUrl(proof.id)" (close)="selectedReturn.set(null)" />}`,
})
export class Actas implements OnInit {
  protected readonly service = inject(ActasEntregaService);
  protected readonly returns = inject(ComprobantesDevolucionService);
  protected readonly items = signal<ActaEntrega[]>([]);
  protected readonly selected = signal<ActaEntrega | null>(null);
  protected readonly selectedReturn = signal<ComprobanteDevolucion | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly clp = formatClp;
  protected returnedCount(acta:ActaEntrega){return acta.dispositivos.filter(device=>device.devuelto).length;}
  protected statusLabel(status:ActaEntrega['estadoDocumental']){return {VIGENTE:'Vigente',DEVOLUCION_PARCIAL:'Devolución parcial',CERRADA:'Devuelta',ANULADA:'Anulada'}[status];}
  protected openReturn(id:string){this.returns.obtener(id).subscribe({next:proof=>this.selectedReturn.set(proof),error:e=>this.error.set(errorMessage(e))});}
  ngOnInit() {
    this.service.listar().subscribe({
      next: (items) => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorMessage(e));
        this.loading.set(false);
      },
    });
  }
}
