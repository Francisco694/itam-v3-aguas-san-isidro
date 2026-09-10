import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiCollectionResponse, ApiItemResponse } from '../models/api.models';
import { StockAlertConfiguration, StockAlertInput } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class StockAlertsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/alertas-stock`;

  listar() {
    return this.http.get<ApiCollectionResponse<StockAlertConfiguration>>(this.url)
      .pipe(map((response) => response.data));
  }

  actualizar(tipoDispositivoId: number, input: StockAlertInput) {
    return this.http.patch<ApiItemResponse<StockAlertConfiguration>>(
      `${this.url}/${tipoDispositivoId}`,
      input
    ).pipe(map((response) => response.data));
  }
}
