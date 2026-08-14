import { ApiError } from '../../core/models/api.models';

export const errorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
