import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { LucideDroplet, LucidePrinter, LucideX } from '@lucide/angular';
import { ColaboradorResumen, Dispositivo } from '../../../core/models/itam.models';

@Component({
  selector: 'app-document-preview',
  imports: [DatePipe, LucideDroplet, LucidePrinter, LucideX],
  template: `
    <div class="dialog-backdrop document-backdrop" role="presentation" (click)="onBackdrop($event)">
      <article class="dialog dialog--wide print-document" role="dialog" aria-modal="true" [attr.aria-labelledby]="documentType() === 'receipt' ? 'receipt-title' : 'delivery-title'">
        <div class="document-actions print-hide"><span>Vista previa no persistida</span><div><button class="btn btn--secondary" type="button" (click)="close.emit()"><svg lucideX></svg>Cerrar</button><button class="btn btn--primary" type="button" (click)="print()"><svg lucidePrinter></svg>Imprimir</button></div></div>
        <header class="document-brand"><span class="document-logo"><svg lucideDroplet></svg></span><div><strong>Aguas San Isidro</strong><span>DEPARTAMENTO DE TECNOLOGÍA</span></div></header>
        <div class="document-title">@if(documentType()==='receipt'){<p>COMPROBANTE PRELIMINAR</p><h2 id="receipt-title">COMPROBANTE DE RECEPCIÓN</h2>}@else{<p>DOCUMENTO PRELIMINAR</p><h2 id="delivery-title">ACTA DE ENTREGA DE EQUIPO</h2>}<span>Generado el {{ generatedAt() | date:'dd/MM/yyyy HH:mm' }}</span></div>
        <section class="document-section"><h3>Funcionario responsable</h3><dl><div><dt>Nombre</dt><dd>{{ collaborator()?.nombre || '—' }}</dd></div><div><dt>RUT</dt><dd>{{ collaborator()?.rut || '—' }}</dd></div><div><dt>Cargo</dt><dd>{{ collaborator()?.cargo || '—' }}</dd></div><div><dt>Departamento</dt><dd>{{ departmentName() || device().departamento?.nombre || '—' }}</dd></div></dl></section>
        <section class="document-section"><h3>{{ documentType()==='receipt' ? 'Equipo recibido' : 'Equipo asignado' }}</h3><dl><div><dt>Código</dt><dd class="code">{{ device().codigoInventario }}</dd></div><div><dt>Tipo</dt><dd>{{ device().tipo.nombre }}</dd></div><div><dt>Marca / Modelo</dt><dd>{{ device().marca || '—' }} {{ device().modelo || '' }}</dd></div><div><dt>Serie</dt><dd>{{ device().numeroSerie || '—' }}</dd></div><div><dt>IMEI</dt><dd>{{ device().imei || '—' }}</dd></div><div><dt>Estado resultante</dt><dd>{{ device().estado.nombre }}</dd></div></dl></section>
        <section class="document-notes"><h3>Observaciones</h3><p>{{ observations() || 'Sin observaciones registradas.' }}</p></section>
        <p class="document-disclaimer">Este comprobante es una vista preliminar generada a partir de una operación real del inventario. No posee numeración ni persistencia documental en la API actual.</p>
        <footer class="signatures"><div><span></span><strong>Firma funcionario</strong></div><div><span></span><strong>Recepción TI</strong></div></footer>
      </article>
    </div>
  `,
  styleUrl: './document-preview.scss'
})
export class DocumentPreview {
  readonly documentType = input.required<'delivery' | 'receipt'>();
  readonly device = input.required<Dispositivo>();
  readonly collaborator = input<ColaboradorResumen | null>(null);
  readonly departmentName = input('');
  readonly observations = input('');
  readonly generatedAt = input(new Date());
  readonly close = output<void>();
  protected print(): void { window.print(); }
  protected onBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget) this.close.emit(); }
}
