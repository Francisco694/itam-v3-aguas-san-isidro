import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import { TipoDispositivo, TipoDispositivoInput } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class TiposDispositivoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/tipos-dispositivo`;

  listar(activo?: boolean) {
    const params = activo === undefined
      ? undefined
      : new HttpParams().set('activo', String(activo));
    return this.http.get<ApiCollectionResponse<TipoDispositivo>>(
      this.url, { params }
    ).pipe(map((response) => response.data));
  }

  obtener(id: number) {
    return this.item(this.http.get<ApiItemResponse<TipoDispositivo>>(
      `${this.url}/${id}`
    ));
  }

  crear(input: TipoDispositivoInput) {
    return this.item(this.http.post<ApiItemResponse<TipoDispositivo>>(
      this.url, input
    ));
  }

  actualizar(id: number, input: Partial<TipoDispositivoInput>) {
    return this.item(this.http.patch<ApiItemResponse<TipoDispositivo>>(
      `${this.url}/${id}`, input
    ));
  }

  private item(request: Observable<ApiItemResponse<TipoDispositivo>>) {
    return request.pipe(map((response) => response.data));
  }
}
