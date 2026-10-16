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
      .get<ApiItemResponse<CatalogoTecnico[]>>(
        `${this.url}/${codigo}/catalogo-tecnico`
      )
      .pipe(map((response) => response.data));
  }

  agregar(codigo: string | number, archivos: File[]) {
    const body = new FormData();
    archivos.forEach((archivo) => body.append('archivos', archivo));
    return this.http
      .post<ApiItemResponse<CatalogoTecnico[]>>(
        `${this.url}/${codigo}/catalogo-tecnico`,
        body
      )
      .pipe(map((response) => response.data));
  }

  reemplazar(codigo: string | number, catalogoId: string, archivo: File) {
    const body = new FormData();
    body.append('archivos', archivo);
    return this.http
      .put<ApiItemResponse<CatalogoTecnico>>(
        `${this.url}/${codigo}/catalogo-tecnico/${catalogoId}`,
        body
      )
      .pipe(map((response) => response.data));
  }

  eliminar(codigo: string | number, catalogoId: string) {
    return this.http
      .delete<ApiItemResponse<CatalogoTecnico>>(
        `${this.url}/${codigo}/catalogo-tecnico/${catalogoId}`
      )
      .pipe(map((response) => response.data));
  }

  archivoUrl(codigo: string | number, catalogoId: string, download = false): string {
    return `${this.url}/${codigo}/catalogo-tecnico/${catalogoId}/archivo${download ? '?download=true' : ''}`;
  }
}
