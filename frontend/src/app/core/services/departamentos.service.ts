import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import { Departamento, DepartamentoInput, InventarioDepartamento } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class DepartamentosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/departamentos`;
  listar(): Observable<Departamento[]> { return this.http.get<ApiCollectionResponse<Departamento>>(this.url).pipe(map((r) => r.data)); }
  obtener(id: string) { return this.http.get<ApiItemResponse<Departamento>>(`${this.url}/${id}`).pipe(map((r) => r.data)); }
  inventario(id: string) { return this.http.get<ApiItemResponse<InventarioDepartamento>>(`${this.url}/${id}/inventario`).pipe(map((r) => r.data)); }
  crear(input: DepartamentoInput): Observable<Departamento> { return this.http.post<ApiItemResponse<Departamento>>(this.url, input).pipe(map((r) => r.data)); }
  actualizar(id: string, input: Partial<DepartamentoInput>): Observable<Departamento> { return this.http.patch<ApiItemResponse<Departamento>>(`${this.url}/${id}`, input).pipe(map((r) => r.data)); }
}
