import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ApiCollectionResponse,
  ApiItemResponse
} from '../models/api.models';
import {
  CreateUserInput,
  ManagedUser,
  UpdateUserInput
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class UsuariosService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/usuarios`;

  listar() {
    return this.http
      .get<ApiCollectionResponse<ManagedUser>>(this.url)
      .pipe(map((response) => response.data));
  }

  crear(input: CreateUserInput) {
    return this.http
      .post<ApiItemResponse<ManagedUser>>(this.url, input)
      .pipe(map((response) => response.data));
  }

  actualizar(id: string, input: UpdateUserInput) {
    return this.http
      .patch<ApiItemResponse<ManagedUser>>(`${this.url}/${id}`, input)
      .pipe(map((response) => response.data));
  }
}
