import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { map, of, Subject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiItemResponse } from '../models/api.models';
import {
  AuthUser,
  SessionEndReason,
  SessionPolicy
} from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/auth`;
  readonly user = signal<AuthUser | null>(null);
  readonly sessionEnded = new Subject<SessionEndReason>();
  private checked = false;

  login(email: string, password: string) {
    return this.authenticate('/login', { email, password });
  }

  loginPin(email: string, pin: string) {
    return this.authenticate('/login-pin', { email, pin });
  }

  me() {
    return this.http
      .get<ApiItemResponse<AuthUser>>(`${this.url}/me`)
      .pipe(
        map((response) => response.data),
        tap((user) => {
          this.user.set(user);
          this.checked = true;
        })
      );
  }

  ensure() {
    return this.checked ? of(this.user()) : this.me();
  }

  changePin(currentPin: string, newPin: string) {
    return this.http
      .post<void>(`${this.url}/change-pin`, { currentPin, newPin })
      .pipe(
        tap(() => {
          const current = this.user();
          if (current) this.user.set({ ...current, debeCambiarPin: false });
        })
      );
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http
      .post<void>(`${this.url}/change-password`, { currentPassword, newPassword })
      .pipe(
        tap(() => {
          const current = this.user();
          if (current) this.user.set({ ...current, debeCambiarPassword: false });
        })
      );
  }

  refreshSession() {
    return this.http
      .post<ApiItemResponse<SessionPolicy>>(
        `${this.url}/refresh-session`,
        {}
      )
      .pipe(map((response) => response.data));
  }

  logout(reason: SessionEndReason = 'logout') {
    return this.http.post<void>(`${this.url}/logout`, {}).pipe(
      tap(() => {
        this.clearLocalSession(reason);
      })
    );
  }

  clearLocalSession(reason: SessionEndReason): void {
    this.user.set(null);
    this.checked = true;
    this.sessionEnded.next(reason);
  }

  private authenticate(
    path: '/login' | '/login-pin',
    credentials: { email: string; password?: string; pin?: string }
  ) {
    return this.http
      .post<ApiItemResponse<AuthUser>>(`${this.url}${path}`, credentials)
      .pipe(
        map((response) => response.data),
        tap((user) => {
          this.user.set(user);
          this.checked = true;
        })
      );
  }
}
