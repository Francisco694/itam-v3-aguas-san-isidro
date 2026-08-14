import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { DatabaseHealthResponse, HealthResponse } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);
  health() { return this.http.get<HealthResponse>(`${environment.apiUrl}/health`); }
  database() { return this.http.get<DatabaseHealthResponse>(`${environment.apiUrl}/health/database`); }
}
