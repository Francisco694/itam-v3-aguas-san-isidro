import { AfterViewInit, Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { LucidePrinter } from '@lucide/angular';
import JsBarcode from 'jsbarcode';

@Component({selector:'app-asset-label',imports:[LucidePrinter],template:`
<div class="asset-label-printable" [attr.aria-label]="'Etiqueta ITAM ' + code"><div class="asset-label__company">AGUAS SAN ISIDRO</div><div class="asset-label__system">INVENTARIO TI · ITAM</div><svg #barcode class="asset-label__barcode" role="img" [attr.aria-label]="'Código de barras ' + code"></svg><strong>{{code}}</strong><span>{{assetType.toUpperCase()}}</span></div>
@if(showPrintButton){<button class="btn btn--secondary btn--small asset-label__print" type="button" (click)="print()"><svg lucidePrinter></svg>{{printLabel}}</button>}
`,styleUrl:'./asset-label.scss'})
export class AssetLabel implements AfterViewInit,OnChanges{
 @Input({required:true}) code=0;@Input({required:true}) assetType='';@Input() showPrintButton=true;@Input() printLabel='Imprimir etiqueta';@ViewChild('barcode') private barcode?:ElementRef<SVGSVGElement>;
 ngAfterViewInit(){this.renderBarcode()}ngOnChanges(){queueMicrotask(()=>this.renderBarcode())}protected print(){document.body.classList.add('printing-asset-label');try{window.print()}finally{document.body.classList.remove('printing-asset-label')}}
 private renderBarcode(){if(!this.barcode||!this.code)return;JsBarcode(this.barcode.nativeElement,String(this.code),{format:'CODE128',displayValue:false,margin:0,height:34,width:1.45,background:'#ffffff',lineColor:'#03045E'})}
}
