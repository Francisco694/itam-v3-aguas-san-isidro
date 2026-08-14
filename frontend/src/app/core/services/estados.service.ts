import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse } from '../models/api.models';
import { Estado, TipoEntidad } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class EstadosService {
  private readonly http = inject(HttpClient);
  listar(tipoEntidad?: TipoEntidad) {
    const params = tipoEntidad ? new HttpParams().set('tipoEntidad', tipoEntidad) : undefined;
    return this.http.get<ApiCollectionResponse<Estado>>(`${environment.apiUrl}/estados`, { params }).pipe(map((response) => response.data));
  }
}
