import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiItemResponse } from '../models/api.models';
import { CatalogoTecnico } from '../models/itam.models';

@Injectable({ providedIn: 'root' })
export class CatalogoTecnicoService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/dispositivos`;

  obtener(codigo: string | number) {
    return this.http
      .get<ApiItemResponse<CatalogoTecnico | null>>(
        `${this.url}/${codigo}/catalogo-tecnico`
      )
      .pipe(map((response) => response.data));
  }

  reemplazar(codigo: string | number, archivo: File) {
    const body = new FormData();
    body.append('archivo', archivo);
    return this.http
      .put<ApiItemResponse<CatalogoTecnico>>(
        `${this.url}/${codigo}/catalogo-tecnico`,
        body
      )
      .pipe(map((response) => response.data));
  }

  archivoUrl(codigo: string | number, download = false): string {
    return `${this.url}/${codigo}/catalogo-tecnico/archivo${download ? '?download=true' : ''}`;
  }
}
