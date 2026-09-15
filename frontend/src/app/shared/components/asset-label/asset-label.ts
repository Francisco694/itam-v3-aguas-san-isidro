import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { LucidePrinter } from '@lucide/angular';
import QRCode from 'qrcode';
import type { Dispositivo } from '../../../core/models/itam.models';
import { buildItamQrValue } from '../../utils/itam-qr';

type LabelDevice = Pick<Dispositivo, 'colaborador' | 'departamento' | 'estado' | 'simAsociada' | 'lineaMovil' | 'numeroTelefonico' | 'labelPhone'>;

export const compactResponsibleName = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 3) return parts.join(' ');
  return `${parts[0]} ${parts.slice(1, -1).map((part) => `${part[0].toUpperCase()}.`).join(' ')} ${parts.at(-1)}`;
};

export const assetLabelResponsible = (device: LabelDevice): string => {
  if (device.colaborador?.nombre) return compactResponsibleName(device.colaborador.nombre);
  if (device.departamento?.nombre) return device.departamento.nombre.trim();
  return device.estado.codigo === 'DISPONIBLE' ? 'Bodega TI' : 'Sin responsable actual';
};

export const assetLabelPhone = (device: Pick<LabelDevice, 'simAsociada' | 'lineaMovil' | 'numeroTelefonico' | 'labelPhone'>): string | null =>
  device.lineaMovil?.numeroTelefonico?.trim()
  || device.numeroTelefonico?.trim()
  || device.labelPhone?.trim()
  || device.simAsociada?.lineaMovil?.numeroTelefonico?.trim()
  || device.simAsociada?.numeroAsociado?.trim()
  || null;

@Component({selector:'app-asset-label',standalone:true,imports:[LucidePrinter],template:`
<div class="asset-label-printable" [class.asset-label-printable--detail]="detail" [attr.aria-label]="'Etiqueta ITAM ' + code"><div class="asset-label__company">AGUAS SAN ISIDRO</div><div class="asset-label__content"><canvas #qr class="asset-label__qr" role="img" [attr.aria-label]="'QR del activo ITAM ' + code"></canvas><div class="asset-label__identity"><small>INVENTARIO TI</small><strong>ITAM {{code}}</strong><span>{{assetType.toUpperCase()}}</span>@if(detail){<span class="asset-label__description">{{brandModel || 'Marca y modelo no registrados'}}</span><span class="asset-label__identifier">{{identifierLabel}}: {{identifier || 'No registrado'}}</span>@if(responsible){<span class="asset-label__responsible">Resp: {{responsible}}</span>}@if(phone){<span class="asset-label__phone">Fono: {{phone}}</span>}}</div></div></div>
@if(showPrintButton){<button class="btn btn--secondary btn--small asset-label__print" type="button" (click)="print()"><svg lucidePrinter></svg>{{printLabel}}</button>}
`,styleUrl:'./asset-label.scss'})
export class AssetLabel implements AfterViewInit,OnChanges{
  @Input({ required: true }) code = 0;
  @Input({ required: true }) assetType = '';
  @Input() brandModel = '';
  @Input() identifierLabel = '';
  @Input() identifier = '';
  @Input() responsible = '';
  @Input() phone = '';
  @Input() detail = false;
  @Input() showPrintButton = true;
  @Input() printLabel = 'Imprimir etiqueta';
  @ViewChild('qr') private qr?: ElementRef<HTMLCanvasElement>;

  ngAfterViewInit(): void { void this.renderQr(); }
  ngOnChanges(): void { queueMicrotask(() => void this.renderQr()); }

  protected print(): void {
    document.body.classList.add('printing-asset-label');
    try { window.print(); }
    finally { document.body.classList.remove('printing-asset-label'); }
  }

  private qrValue(): string { return buildItamQrValue(this.code); }

  private async renderQr(): Promise<void> {
    if (!this.qr || !this.code) return;
    await QRCode.toCanvas(this.qr.nativeElement, this.qrValue(), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 104,
      color: { dark: '#03045E', light: '#FFFFFF' },
    });
  }
}
