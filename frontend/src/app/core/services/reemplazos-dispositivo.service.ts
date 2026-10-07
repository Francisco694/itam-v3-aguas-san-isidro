import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import { CrearReemplazoDispositivoInput, RecibirReemplazoDispositivoInput, ReemplazoDispositivo } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class ReemplazosDispositivoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/reemplazos-dispositivo`;

  crear(input: CrearReemplazoDispositivoInput) {
    return this.http.post<ApiItemResponse<ReemplazoDispositivo>>(this.url, input).pipe(map(response => response.data));
  }

  pendientes() {
    return this.http.get<ApiCollectionResponse<ReemplazoDispositivo>>(`${this.url}/pendientes`).pipe(map(response => response.data));
  }

  porColaborador(colaboradorId: string | number) {
    return this.http.get<ApiCollectionResponse<ReemplazoDispositivo>>(`${this.url}/colaborador/${colaboradorId}`).pipe(map(response => response.data));
  }

  recibir(id: string, input: RecibirReemplazoDispositivoInput) {
    return this.http.post<ApiItemResponse<ReemplazoDispositivo>>(`${this.url}/${id}/recibir`, input).pipe(map(response => response.data));
  }
}
