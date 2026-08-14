import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import { AsignarDispositivoColaboradorInput, AsignarDispositivoDepartamentoInput, CambiarEstadoInput, Dispositivo, DispositivoFilters, DispositivoInput, HistorialEvento, ResponsableInput } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class DispositivosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/dispositivos`;
  listar(filters: DispositivoFilters = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params = params.set(key, String(value)); });
    return this.http.get<ApiCollectionResponse<Dispositivo>>(this.url, { params }).pipe(map((r) => r.data));
  }
  obtener(codigo: number) { return this.item(this.http.get<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}`)); }
  crear(input: DispositivoInput) { return this.item(this.http.post<ApiItemResponse<Dispositivo>>(this.url, input)); }
  actualizar(codigo: number, input: Partial<DispositivoInput>) { return this.item(this.http.patch<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}`, input)); }
  asignarColaborador(codigo: number, input: AsignarDispositivoColaboradorInput) { return this.item(this.http.post<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}/asignar-colaborador`, input)); }
  asignarDepartamento(codigo: number, input: AsignarDispositivoDepartamentoInput) { return this.item(this.http.post<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}/asignar-departamento`, input)); }
  devolver(codigo: number, input: ResponsableInput) { return this.item(this.http.post<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}/devolver`, input)); }
  cambiarEstado(codigo: number, input: CambiarEstadoInput) { return this.item(this.http.post<ApiItemResponse<Dispositivo>>(`${this.url}/${codigo}/cambiar-estado`, input)); }
  historial(codigo: number) { return this.http.get<ApiCollectionResponse<HistorialEvento>>(`${this.url}/${codigo}/historial`).pipe(map((r) => r.data)); }
  private item(request: Observable<ApiItemResponse<Dispositivo>>) { return request.pipe(map((response) => response.data)); }
}
