import { Component,inject,signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideDownload,LucideFileText } from '@lucide/angular';
import { ReporteInventario } from '../../core/models/itam.models';
import { ReportesService } from '../../core/services/reportes.service';
import { PageHeader } from '../../shared/components/page-header/page-header';
import { ViewState } from '../../shared/components/view-state/view-state';
import { formatClp } from '../../shared/utils/currency';
import { errorMessage } from '../../shared/utils/error-message';
@Component({selector:'app-reportes',imports:[FormsModule,PageHeader,ViewState,LucideDownload,LucideFileText],template:`
<app-page-header title="Reporte de Inventario TI" subtitle="Estado actual y movimientos históricos dentro de un rango de fechas." />
<section class="card report-filter"><div class="field"><label for="desde">Desde</label><input id="desde" type="date" [(ngModel)]="desde"></div><div class="field"><label for="hasta">Hasta</label><input id="hasta" type="date" [(ngModel)]="hasta"></div><button class="btn btn--primary" type="button" (click)="load()">Generar reporte</button></section>
@if(loading()){<app-view-state kind="loading" title="Generando reporte" message="Calculando inventario y movimientos reales…" />}
@else if(error()){<app-view-state kind="error" title="No se pudo generar" [message]="error()" (retry)="load()" />}
@else if(report();as data){
<div class="report-actions"><button class="btn btn--secondary" type="button" (click)="exportCsv(data)"><svg lucideDownload></svg> CSV</button><button class="btn btn--secondary" type="button" (click)="downloadPdf()"><svg lucideFileText></svg> PDF</button></div>
<section class="metric-grid">@for(item of summary(data);track item.label){<article class="card metric"><small>{{item.label}}</small><strong>{{item.value.cantidad}}</strong><span>{{money(item.value.valor)}}</span></article>}</section>
<section class="card"><h2>Movimientos del período</h2><div class="movement-grid">@for(item of movements(data);track item.label){<div><strong>{{item.value}}</strong><span>{{item.label}}</span></div>}</div></section>
<section class="card"><h2>Organización</h2><p class="hint">Cada nivel consolida correctamente los activos de sus unidades descendientes.</p><div class="table-wrap"><table class="data-table"><thead><tr><th>Departamento</th><th>Dependencia</th><th>Activos</th><th>Valor</th></tr></thead><tbody>@for(item of data.organizacion;track item.departamentoId){<tr><td>{{item.departamento}}</td><td>{{item.dependencia||'Nivel principal'}}</td><td>{{item.cantidad}}</td><td>{{money(item.valor)}}</td></tr>}</tbody></table></div></section>
}`,styles:[`:host{display:grid;gap:1.25rem}.report-filter{align-items:end;display:grid;gap:1rem;grid-template-columns:repeat(2,minmax(160px,1fr)) auto}.report-actions{display:flex;gap:.75rem;justify-content:flex-end}.metric-grid{display:grid;gap:1rem;grid-template-columns:repeat(4,minmax(0,1fr))}.metric{display:grid;gap:.35rem}.metric small,.metric span,.hint{color:var(--gray-500)}.metric strong{color:var(--navy);font-size:1.8rem}.movement-grid{display:grid;gap:1rem;grid-template-columns:repeat(6,1fr)}.movement-grid div{display:grid;text-align:center}.movement-grid strong{color:var(--blue);font-size:1.4rem}.movement-grid span{font-size:.78rem}@media(max-width:900px){.metric-grid{grid-template-columns:repeat(2,1fr)}.movement-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:600px){.report-filter{grid-template-columns:1fr}.metric-grid,.movement-grid{grid-template-columns:1fr 1fr}}`]})
export class Reportes{
 private readonly service=inject(ReportesService);protected readonly report=signal<ReporteInventario|null>(null);protected readonly loading=signal(false);protected readonly error=signal('');
 protected hasta=new Date().toISOString().slice(0,10);protected desde=new Date(Date.now()-6*86400000).toISOString().slice(0,10);protected readonly money=formatClp;
 protected load(){if(!this.desde||!this.hasta||this.desde>this.hasta){this.error.set('Seleccione un rango de fechas válido.');return}this.loading.set(true);this.error.set('');this.service.obtener(this.desde,this.hasta).subscribe({next:r=>{this.report.set(r);this.loading.set(false)},error:e=>{this.error.set(errorMessage(e));this.loading.set(false)}})}
 protected summary(r:ReporteInventario){return Object.entries(r.resumen).map(([label,value])=>({label:this.label(label),value}))}
 protected movements(r:ReporteInventario){return Object.entries(r.movimientos).map(([label,value])=>({label:this.label(label),value}))}
 protected downloadPdf(){this.service.pdf(this.desde,this.hasta).subscribe({next:blob=>this.download(blob,`reporte-itam-${this.desde}-${this.hasta}.pdf`),error:e=>this.error.set(errorMessage(e))})}
 protected exportCsv(r:ReporteInventario){const rows=[['Sección','Indicador','Cantidad','Valor'],...this.summary(r).map(x=>['Resumen',x.label,x.value.cantidad,x.value.valor]),...this.movements(r).map(x=>['Movimientos',x.label,x.value,'']),...r.organizacion.map(x=>['Organización',x.departamento,x.cantidad,x.valor])];const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');this.download(new Blob([csv],{type:'text/csv;charset=utf-8'}),`reporte-itam-${this.desde}-${this.hasta}.csv`)}
 private download(blob:Blob,name:string){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
 private label(value:string){return value.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase())}
}
