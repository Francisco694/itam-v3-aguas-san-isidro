export interface ApiItemResponse<T> { success: true; data: T; }
export interface ApiCollectionResponse<T> { success: true; count: number; data: T[]; }
export interface ApiErrorBody { success: false; error: { code: string; message: string; }; }

export class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HealthResponse { success: true; service: string; status: string; timestamp: string; }
export interface DatabaseHealthResponse { success: true; service: string; status: string; database: string; user: string; databaseTime: string; }
