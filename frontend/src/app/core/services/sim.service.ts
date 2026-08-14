import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import { AsociarDispositivoInput, AsignarSimColaboradorInput, CambiarEstadoInput, HistorialEvento, ResponsableInput, Sim, SimInput } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class SimService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/sim`;
  listar() { return this.http.get<ApiCollectionResponse<Sim>>(this.url).pipe(map((r) => r.data)); }
  obtener(codigo: number) { return this.item(this.http.get<ApiItemResponse<Sim>>(`${this.url}/${codigo}`)); }
  crear(input: SimInput) { return this.item(this.http.post<ApiItemResponse<Sim>>(this.url, input)); }
  actualizar(codigo: number, input: Partial<SimInput>) { return this.item(this.http.patch<ApiItemResponse<Sim>>(`${this.url}/${codigo}`, input)); }
  asociarDispositivo(codigo: number, input: AsociarDispositivoInput) { return this.item(this.http.post<ApiItemResponse<Sim>>(`${this.url}/${codigo}/asociar-dispositivo`, input)); }
  desasociarDispositivo(codigo: number, input: ResponsableInput) { return this.item(this.http.post<ApiItemResponse<Sim>>(`${this.url}/${codigo}/desasociar-dispositivo`, input)); }
  asignarColaborador(codigo: number, input: AsignarSimColaboradorInput) { return this.item(this.http.post<ApiItemResponse<Sim>>(`${this.url}/${codigo}/asignar-colaborador`, input)); }
  desasignarColaborador(codigo: number, input: ResponsableInput) { return this.item(this.http.post<ApiItemResponse<Sim>>(`${this.url}/${codigo}/desasignar-colaborador`, input)); }
  cambiarEstado(codigo: number, input: CambiarEstadoInput) { return this.item(this.http.post<ApiItemResponse<Sim>>(`${this.url}/${codigo}/cambiar-estado`, input)); }
  historial(codigo: number) { return this.http.get<ApiCollectionResponse<HistorialEvento>>(`${this.url}/${codigo}/historial`).pipe(map((r) => r.data)); }
  private item(request: Observable<ApiItemResponse<Sim>>) { return request.pipe(map((response) => response.data)); }
}
