import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { LucidePrinter } from '@lucide/angular';
import QRCode from 'qrcode';
import { buildItamQrValue } from '../../utils/itam-qr';

@Component({selector:'app-asset-label',imports:[LucidePrinter],template:`
<div class="asset-label-printable" [class.asset-label-printable--detail]="detail" [attr.aria-label]="'Etiqueta ITAM ' + code"><div class="asset-label__company">AGUAS SAN ISIDRO</div><div class="asset-label__content"><canvas #qr class="asset-label__qr" role="img" [attr.aria-label]="'QR del activo ITAM ' + code"></canvas><div class="asset-label__identity"><small>INVENTARIO TI</small><strong>ITAM {{code}}</strong><span>{{assetType.toUpperCase()}}</span>@if(detail){<span class="asset-label__description">{{brandModel || 'Marca y modelo no registrados'}}</span><span class="asset-label__identifier">{{identifierLabel}}: {{identifier || 'No registrado'}}</span>}</div></div></div>
@if(showPrintButton){<button class="btn btn--secondary btn--small asset-label__print" type="button" (click)="print()"><svg lucidePrinter></svg>{{printLabel}}</button>}
`,styleUrl:'./asset-label.scss'})
export class AssetLabel implements AfterViewInit,OnChanges{
 @Input({required:true}) code=0;@Input({required:true}) assetType='';@Input() brandModel='';@Input() identifierLabel='';@Input() identifier='';@Input() detail=false;@Input() showPrintButton=true;@Input() printLabel='Imprimir etiqueta';@ViewChild('qr') private qr?:ElementRef<HTMLCanvasElement>;
 ngAfterViewInit(){void this.renderQr()}ngOnChanges(){queueMicrotask(()=>void this.renderQr())}protected print(){document.body.classList.add('printing-asset-label');try{window.print()}finally{document.body.classList.remove('printing-asset-label')}}
 private qrValue():string{return buildItamQrValue(this.code)}
 private async renderQr(){if(!this.qr||!this.code)return;await QRCode.toCanvas(this.qr.nativeElement,this.qrValue(),{errorCorrectionLevel:'M',margin:1,width:104,color:{dark:'#03045E',light:'#FFFFFF'}})}
}
