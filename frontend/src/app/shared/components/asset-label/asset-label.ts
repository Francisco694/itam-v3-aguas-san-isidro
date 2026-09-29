import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { LucidePrinter } from '@lucide/angular';
import QRCode from 'qrcode';
import type { Dispositivo } from '../../../core/models/itam.models';
import { buildItamQrValue } from '../../utils/itam-qr';

type LabelDevice = Pick<Dispositivo, 'colaborador' | 'departamento' | 'estado' | 'simAsociada' | 'lineaMovil' | 'numeroTelefonico' | 'labelPhone'>;

export const PHYSICAL_LABEL_CALL_PHONE = '800 600 250';
export const PHYSICAL_LABEL_WHATSAPP = '+56946659918';

export const compactResponsibleName = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  const firstName = parts[0];
  const firstSurname = parts.at(-2)!;
  const secondSurnameInitial = parts.at(-1)!.charAt(0).toUpperCase();
  return `${firstName} ${firstSurname} ${secondSurnameInitial}.`;
};

export const assetLabelResponsible = (device: LabelDevice): string => {
  if (device.colaborador?.nombre) return compactResponsibleName(device.colaborador.nombre);
  if (device.departamento?.nombre) return device.departamento.nombre.trim();
  return ({
    DISPONIBLE: 'Bodega TI',
    SERVICIO_TECNICO: 'Servicio Técnico',
    EXTRAVIADO: 'Equipo extraviado',
    DADO_BAJA: 'Baja de inventario',
  } as Record<string, string>)[device.estado.codigo] || 'Sin responsable actual';
};

export const assetLabelPhone = (device: Pick<LabelDevice, 'simAsociada' | 'lineaMovil' | 'numeroTelefonico' | 'labelPhone'>): string | null =>
  device.lineaMovil?.numeroTelefonico?.trim()
  || device.numeroTelefonico?.trim()
  || device.labelPhone?.trim()
  || device.simAsociada?.lineaMovil?.numeroTelefonico?.trim()
  || device.simAsociada?.numeroAsociado?.trim()
  || null;

@Component({selector:'app-asset-label',standalone:true,imports:[LucidePrinter],template:`
<div class="asset-label-printable" [class.asset-label-printable--detail]="detail" [attr.aria-label]="'Etiqueta ITAM ' + code"><div class="asset-label__company">AGUAS SAN ISIDRO</div>@if(detail){<div class="asset-label__responsible">Responsable: {{responsible || 'Bodega TI'}}</div>}<div class="asset-label__divider" aria-hidden="true"></div><div class="asset-label__content"><canvas #qr class="asset-label__qr" role="img" [attr.aria-label]="'QR del activo ITAM ' + code"></canvas><div class="asset-label__identity"><small>INVENTARIO TI</small><strong>ITAM {{code}}</strong><span>{{assetType.toUpperCase()}}</span><span class="asset-label__description">{{brandModel || 'Modelo no registrado'}}</span></div></div><div class="asset-label__loss"><strong>EN CASO DE PÉRDIDA</strong><span>Llamar: {{labelCallPhone}}</span><span>WhatsApp: {{labelWhatsapp}}</span></div></div>
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
  protected readonly labelCallPhone = PHYSICAL_LABEL_CALL_PHONE;
  protected readonly labelWhatsapp = PHYSICAL_LABEL_WHATSAPP;
  @ViewChild('qr', { static: true }) private qr?: ElementRef<HTMLCanvasElement>;

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
    this.qr.nativeElement.width = 104;
    this.qr.nativeElement.height = 104;
    await QRCode.toCanvas(this.qr.nativeElement, this.qrValue(), {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 104,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  }
}
