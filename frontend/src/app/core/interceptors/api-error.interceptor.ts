import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { ApiError, ApiErrorBody } from '../models/api.models';

const isApiErrorBody = (value: unknown): value is ApiErrorBody => {
  if (!value || typeof value !== 'object' || !('error' in value)) return false;
  const apiError = value.error;
  return !!apiError && typeof apiError === 'object' && 'code' in apiError && 'message' in apiError;
};

export const apiErrorInterceptor: HttpInterceptorFn = (request, next) => next(request).pipe(
  catchError((error: HttpErrorResponse) => {
    if (isApiErrorBody(error.error)) {
      return throwError(() => new ApiError(error.error.error.code, error.error.error.message, error.status));
    }
    const message = error.status === 0
      ? 'No fue posible conectar con la API. Verifica que el backend esté disponible.'
      : 'Ocurrió un error inesperado al procesar la solicitud.';
    return throwError(() => new ApiError(error.status === 0 ? 'NETWORK_ERROR' : 'INTERNAL_ERROR', message, error.status));
  })
);
