import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import { InventoryCodeFamily, InventoryCodeFamilyInput, PrefixSuggestion, TipoEntidad } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class InventoryCodeService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/familias-codigo`;
  listarFamilias(filters: { activo?: boolean; tipoEntidad?: TipoEntidad } = {}) {
    const params: Record<string, string> = {};
    if (filters.activo !== undefined) params['activo'] = String(filters.activo);
    if (filters.tipoEntidad) params['tipoEntidad'] = filters.tipoEntidad;
    return this.http.get<ApiCollectionResponse<InventoryCodeFamily>>(this.url, { params }).pipe(map((response) => response.data));
  }
  obtener(id: number) { return this.item(this.http.get<ApiItemResponse<InventoryCodeFamily>>(`${this.url}/${id}`)); }
  sugerirPrefijo() { return this.item(this.http.get<ApiItemResponse<PrefixSuggestion>>(`${this.url}/prefijo-sugerido`)); }
  crear(input: InventoryCodeFamilyInput) { return this.item(this.http.post<ApiItemResponse<InventoryCodeFamily>>(this.url, input)); }
  actualizar(id: number, input: Partial<InventoryCodeFamilyInput>) { return this.item(this.http.patch<ApiItemResponse<InventoryCodeFamily>>(`${this.url}/${id}`, input)); }
  private item<T>(request: import('rxjs').Observable<ApiItemResponse<T>>) { return request.pipe(map((response) => response.data)); }
}
