import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import { Colaborador, ColaboradorFilters, ColaboradorInput, InventarioColaborador, PendienteOffboarding } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class ColaboradoresService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/colaboradores`;
  listar(filters: ColaboradorFilters = {}) {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => { if (value !== undefined && value !== '') params = params.set(key, String(value)); });
    return this.http.get<ApiCollectionResponse<Colaborador>>(this.url, { params }).pipe(map((r) => r.data));
  }
  pendientesOffboarding(){return this.http.get<ApiCollectionResponse<PendienteOffboarding>>(`${this.url}/offboarding-pendientes`).pipe(map(r=>r.data));}
  obtener(id: string) { return this.http.get<ApiItemResponse<Colaborador>>(`${this.url}/${id}`).pipe(map((r) => r.data)); }
  inventario(id:string){return this.http.get<ApiItemResponse<InventarioColaborador>>(`${this.url}/${id}/inventario`).pipe(map(r=>r.data));}
  obtenerPorRut(rut: string) { return this.http.get<ApiItemResponse<Colaborador>>(`${this.url}/rut/${encodeURIComponent(rut)}`).pipe(map((r) => r.data)); }
  crear(input: ColaboradorInput) { return this.http.post<ApiItemResponse<Colaborador>>(this.url, input).pipe(map((r) => r.data)); }
  actualizar(id: string, input: Partial<ColaboradorInput>) { return this.http.patch<ApiItemResponse<Colaborador>>(`${this.url}/${id}`, input).pipe(map((r) => r.data)); }
}
