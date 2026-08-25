import {HttpClient} from '@angular/common/http';
import {inject,Injectable} from '@angular/core';
import {map} from 'rxjs';
import {environment} from '../../../environments/environment';
import {ApiCollectionResponse,ApiItemResponse} from '../models/api.models';
import {ComprobanteDevolucion} from '../models/itam.models';
@Injectable({providedIn:'root'}) export class ComprobantesDevolucionService{private readonly http=inject(HttpClient);private readonly url=`${environment.apiUrl}/comprobantes-devolucion`;
 listar(){return this.http.get<ApiCollectionResponse<ComprobanteDevolucion>>(this.url).pipe(map(r=>r.data));}
 obtener(id:string){return this.http.get<ApiItemResponse<ComprobanteDevolucion>>(`${this.url}/${id}`).pipe(map(r=>r.data));}
 pdfUrl(id:string){return `${this.url}/${id}/pdf`;}}
