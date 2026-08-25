import { HttpClient,HttpParams } from '@angular/common/http';
import { Injectable,inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiItemResponse } from '../models/api.models';
import { ReporteInventario } from '../models/itam.models';
@Injectable({providedIn:'root'})
export class ReportesService{
 private readonly http=inject(HttpClient);private readonly url=`${environment.apiUrl}/reportes/inventario`;
 obtener(desde:string,hasta:string){return this.http.get<ApiItemResponse<ReporteInventario>>(this.url,{params:new HttpParams().set('desde',desde).set('hasta',hasta)}).pipe(map(r=>r.data))}
 pdf(desde:string,hasta:string){return this.http.get(`${this.url}/pdf`,{params:new HttpParams().set('desde',desde).set('hasta',hasta),responseType:'blob'})}
}
