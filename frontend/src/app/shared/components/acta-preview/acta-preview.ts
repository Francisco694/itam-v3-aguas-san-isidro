import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { LucideDownload, LucideDroplet, LucideMail, LucidePrinter, LucideX } from '@lucide/angular';
import { ActaEntrega } from '../../../core/models/itam.models';
import { formatClp } from '../../utils/currency';
import { formatRut } from '../../utils/rut';

export const actaCommercialTotal = (devices: readonly { valorComercial: number }[]): number =>
  devices.reduce((total, device) => total + device.valorComercial, 0);
@Component({
  selector: 'app-acta-preview',
  imports: [DatePipe, LucideDownload, LucideDroplet, LucideMail, LucidePrinter, LucideX],
  template: `<div class="dialog-backdrop" role="presentation" (click)="backdrop($event)">
    <article
      class="dialog dialog--wide acta-document print-document"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acta-title"
    >
      <div class="document-actions print-hide">
        <span>Acta persistida · {{ acta().numeroActa }}</span>
        <div>
          <button class="btn btn--secondary" type="button" (click)="close.emit()">
            <svg lucideX></svg>Cerrar</button
          ><a class="btn btn--secondary" [href]="pdfUrl()" target="_blank"
            ><svg lucideDownload></svg>Descargar PDF</a
          ><button class="btn btn--primary" type="button" (click)="print()">
            <svg lucidePrinter></svg>Imprimir
          </button>
        </div>
      </div>
      <header class="acta-brand">
        <div>
          <span class="brand-mark"><svg lucideDroplet></svg></span>
          <p><strong>AGUAS SAN ISIDRO</strong><small>DEPARTAMENTO DE TECNOLOGÍA</small></p>
        </div>
        <span>CONTROL PATRIMONIAL TI</span>
      </header>
      <section class="acta-title">
        <span>DOCUMENTO DE CUSTODIA</span>
        <h2 id="acta-title">ACTA DE ENTREGA DE EQUIPOS</h2>
      </section>
      <dl class="document-metadata">
        <div>
          <dt>Número de acta</dt>
          <dd>{{ acta().numeroActa }}</dd>
        </div>
        <div>
          <dt>Localidad</dt>
          <dd>{{ acta().localidad || 'No informada' }}</dd>
        </div>
        <div>
          <dt>Fecha</dt>
          <dd>{{ acta().fecha | date: 'dd/MM/yyyy HH:mm' }}</dd>
        </div>
      </dl>
      <section class="declaration">
        <h3>Funcionario responsable</h3>
        <dl>
          <div>
            <dt>Nombre</dt>
            <dd>{{ personName() }}</dd>
          </div>
          <div>
            <dt>RUT</dt>
            <dd>{{ personRut() }}</dd>
          </div>
          <div>
            <dt>Cargo</dt>
            <dd>{{ personCargo() }}</dd>
          </div>
          <div>
            <dt>Departamento</dt>
            <dd>{{ acta().departamento?.nombre || '—' }}</dd>
          </div>
          <div>
            <dt>Responsable TI</dt>
            <dd>{{ acta().responsableTi }}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h3>Equipos entregados</h3>
        <table>
          <thead>
            <tr>
              <th>Código</th>
              <th>Equipo</th>
              <th>Serie / IMEI</th>
              <th>Valor</th>
            </tr>
          </thead>
          <tbody>
            @for (device of acta().dispositivos; track device.id) {
              <tr>
                <td>{{ device.codigoInventario }}</td>
                <td>{{ device.tipo }} · {{ device.marca || '—' }} {{ device.modelo || '' }}</td>
                <td>{{ device.imei || device.numeroSerie || '—' }}</td>
                <td>{{ clp(device.valorComercial) }}</td>
              </tr>
            }
          </tbody>
        </table>
        <p class="total">
          VALOR COMERCIAL TOTAL <strong>{{ clp(acta().valorTotal) }}</strong>
        </p>
      </section>
      <section>
        <h3>Información importante / declaración del funcionario</h3>
        <p>{{ acta().declaracion || 'Texto corporativo pendiente de aprobación formal.' }}</p>
      </section>
      <footer>
        <div><span></span>Firma funcionario</div>
        <div><span></span>Firma responsable TI</div>
      </footer>
      <button
        class="btn btn--secondary print-hide email-disabled"
        type="button"
        disabled
        title="Servicio de correo no configurado"
      >
        <svg lucideMail></svg
        ><span>Enviar copia<small>Servicio de correo no configurado</small></span>
      </button>
    </article>
  </div>`,
  styles: [
    `
      .acta-document {
        background: #fff;
        max-width: 210mm;
        max-height: 94vh;
        overflow: auto;
        padding: 12mm;
        width: min(210mm, calc(100vw - 2rem));
      }
      .document-actions {
        align-items: center;
        border-bottom: 1px solid var(--gray-200);
        display: flex;
        justify-content: space-between;
        margin: -0.4rem 0 1.4rem;
        padding-bottom: 1rem;
      }
      .document-actions div {
        display: flex;
        gap: 0.5rem;
      }
      .acta-brand {
        align-items: center;
        border-bottom: 4px solid var(--cyan);
        display: flex;
        justify-content: space-between;
        padding-bottom: 0.8rem;
      }
      .acta-brand > div {
        align-items: center;
        display: flex;
        gap: 0.65rem;
      }
      .brand-mark {
        align-items: center;
        background: var(--navy);
        border-radius: 0.7rem;
        color: #fff;
        display: flex;
        height: 2.6rem;
        justify-content: center;
        width: 2.6rem;
      }
      .brand-mark svg {
        height: 1.3rem;
      }
      .acta-brand p,
      .acta-brand strong,
      .acta-brand small {
        display: block;
        margin: 0;
      }
      .acta-brand strong {
        color: var(--navy);
        font-size: 1.2rem;
        letter-spacing: 0.04em;
      }
      .acta-brand small,
      .acta-brand > span {
        color: var(--slate-500);
        font-size: 0.62rem;
        font-weight: 750;
        letter-spacing: 0.08em;
      }
      .acta-title {
        margin: 1.5rem 0 1rem;
        text-align: center;
      }
      .acta-title > span {
        color: var(--blue);
        font-size: 0.62rem;
        font-weight: 800;
        letter-spacing: 0.12em;
      }
      .acta-title h2 {
        color: var(--navy);
        font-size: 1.25rem;
        margin: 0.3rem;
      }
      .document-metadata {
        background: var(--gray-50);
        border: 1px solid var(--gray-200);
        display: grid !important;
        grid-template-columns: repeat(3, 1fr) !important;
        margin-bottom: 1.3rem;
      }
      .document-metadata div {
        border: 0 !important;
        border-right: 1px solid var(--gray-200) !important;
        padding: 0.7rem !important;
      }
      .document-metadata div:last-child {
        border-right: 0 !important;
      }
      .acta-document section h3 {
        color: var(--navy);
        font-size: 0.85rem;
        text-transform: uppercase;
      }
      .acta-document dl {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
      }
      .acta-document dl div {
        border: 1px solid var(--gray-200);
        padding: 0.5rem;
      }
      .acta-document dt {
        color: var(--slate-500);
        font-size: 0.65rem;
      }
      .acta-document dd {
        font-weight: 700;
        margin: 0.2rem 0;
      }
      .acta-document table {
        border-collapse: collapse;
        width: 100%;
      }
      .acta-document th,
      .acta-document td {
        border: 1px solid var(--gray-200);
        font-size: 0.72rem;
        padding: 0.5rem;
        text-align: left;
      }
      .acta-document th {
        background: var(--navy);
        color: #fff;
      }
      .acta-document tr {
        break-inside: avoid;
      }
      .total {
        background: var(--gray-50);
        border-bottom: 2px solid var(--navy);
        padding: 0.65rem;
        text-align: right;
      }
      .declaration {
        background: var(--gray-50);
        border-left: 3px solid var(--cyan);
        padding: 0.7rem 0.9rem;
      }
      .acta-document > footer {
        display: grid;
        gap: 3rem;
        grid-template-columns: 1fr 1fr;
        margin: 4rem 0 1.5rem;
        text-align: center;
      }
      .acta-document > footer span {
        border-top: 1px solid;
        display: block;
        margin-bottom: 0.4rem;
      }
      .email-disabled {
        align-items: center;
        display: flex;
        justify-content: center;
        width: 100%;
      }
      .email-disabled span,
      .email-disabled small {
        display: block;
      }
      .email-disabled small {
        font-weight: 500;
        margin-top: 0.1rem;
      }
      @media print {
        .dialog-backdrop {
          background: #fff !important;
          display: block !important;
          position: static !important;
        }
        .acta-document {
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          max-height: none !important;
          max-width: 210mm !important;
          min-height: 297mm;
          padding: 12mm !important;
          print-color-adjust: exact;
          width: 210mm !important;
        }
        .print-hide {
          display: none !important;
        }
      }
      @media (max-width: 650px) {
        .document-actions,
        .acta-brand {
          align-items: flex-start;
          flex-direction: column;
          gap: 0.7rem;
        }
        .document-actions div {
          flex-wrap: wrap;
        }
        .document-metadata {
          grid-template-columns: 1fr !important;
        }
        .document-metadata div {
          border-bottom: 1px solid var(--gray-200) !important;
          border-right: 0 !important;
        }
        .acta-document > footer {
          gap: 2rem;
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ActaPreview {
  readonly acta = input.required<ActaEntrega>();
  readonly pdfUrl = input.required<string>();
  readonly close = output<void>();
  protected readonly clp = formatClp;
  protected personName() {
    return this.acta().colaborador?.nombre || this.acta().recepcionante?.nombre || '—';
  }
  protected personRut() {
    return formatRut(this.acta().colaborador?.rut || this.acta().recepcionante?.rut) || '—';
  }
  protected personCargo() {
    return this.acta().colaborador?.cargo || this.acta().recepcionante?.cargo || '—';
  }
  protected print() {
    window.print();
  }
  protected backdrop(e: MouseEvent) {
    if (e.target === e.currentTarget) this.close.emit();
  }
}
