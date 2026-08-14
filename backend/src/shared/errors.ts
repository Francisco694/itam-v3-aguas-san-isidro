export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  public constructor(
    statusCode: number,
    code: string,
    message: string
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  public constructor(message: string) {
    super(400, "VALIDATION_ERROR", message);
  }
}

export class NotFoundError extends AppError {
  public constructor(message: string) {
    super(404, "NOT_FOUND", message);
  }
}

export class ConflictError extends AppError {
  public constructor(message: string) {
    super(409, "CONFLICT", message);
  }
}

export const isUniqueViolation = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
};

export const isForeignKeyViolation = (error: unknown): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23503"
  );
};

export const isDatabaseBusinessRuleViolation = (
  error: unknown
): boolean => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "P0001" || error.code === "23514")
  );
};
