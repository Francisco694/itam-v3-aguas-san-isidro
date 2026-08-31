import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import {
  OffboardingProcessDetail,
  OffboardingProcessSummary,
  OffboardingSearchResult,
  StartOffboardingInput,
} from '../models/offboarding.models';

@Injectable({ providedIn: 'root' })
export class OffboardingService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/offboarding`;

  listarAbiertos() {
    return this.http
      .get<ApiCollectionResponse<OffboardingProcessSummary>>(this.url)
      .pipe(map((response) => response.data));
  }

  buscar(query: string) {
    const params = new HttpParams().set('q', query);
    return this.http
      .get<ApiCollectionResponse<OffboardingSearchResult>>(`${this.url}/buscar`, { params })
      .pipe(map((response) => response.data));
  }

  obtener(id: string) {
    return this.http
      .get<ApiItemResponse<OffboardingProcessDetail>>(`${this.url}/${id}`)
      .pipe(map((response) => response.data));
  }

  iniciar(input: StartOffboardingInput) {
    return this.http
      .post<ApiItemResponse<OffboardingProcessDetail>>(this.url, input)
      .pipe(map((response) => response.data));
  }

  cerrar(id: string) {
    return this.http
      .post<ApiItemResponse<OffboardingProcessDetail>>(`${this.url}/${id}/cerrar`, {})
      .pipe(map((response) => response.data));
  }
}
