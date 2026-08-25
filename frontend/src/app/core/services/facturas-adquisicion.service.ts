import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiItemResponse } from '../models/api.models';
import {
  FacturaAdquisicion,
  FacturaAdquisicionInput
} from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class FacturasAdquisicionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/facturas-adquisicion`;

  crear(input: FacturaAdquisicionInput, documento?: File) {
    return this.http
      .post<ApiItemResponse<FacturaAdquisicion>>(
        this.url,
        this.requestBody(input, documento)
      )
      .pipe(map((response) => response.data));
  }

  actualizar(
    id: string,
    input: Partial<FacturaAdquisicionInput>,
    documento?: File
  ) {
    return this.http
      .patch<ApiItemResponse<FacturaAdquisicion>>(
        `${this.url}/${id}`,
        this.requestBody(input, documento)
      )
      .pipe(map((response) => response.data));
  }

  documentoUrl(id: string, download = false): string {
    return `${this.url}/${id}/documento${download ? '?download=true' : ''}`;
  }

  private requestBody(
    input: Partial<FacturaAdquisicionInput>,
    documento?: File
  ): Partial<FacturaAdquisicionInput> | FormData {
    if (!documento) return input;
    const formData = new FormData();
    formData.append('metadata', JSON.stringify(input));
    formData.append('documento', documento);
    return formData;
  }
}
