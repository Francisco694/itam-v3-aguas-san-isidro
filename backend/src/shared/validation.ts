import { ValidationError } from "./errors";

export type JsonObject = Record<string, unknown>;

export const parseBodyObject = (body: unknown): JsonObject => {
  if (
    typeof body !== "object" ||
    body === null ||
    Array.isArray(body)
  ) {
    throw new ValidationError("El cuerpo debe ser un objeto JSON.");
  }

  return body as JsonObject;
};

export const parseRequiredString = (
  value: unknown,
  field: string,
  maxLength?: number
): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new ValidationError(`${field} es obligatorio.`);
  }

  const parsed = value.trim();

  if (maxLength !== undefined && parsed.length > maxLength) {
    throw new ValidationError(
      `${field} no puede superar ${maxLength} caracteres.`
    );
  }

  return parsed;
};

export const parseOptionalString = (
  value: unknown,
  field: string,
  maxLength?: number
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${field} debe ser string.`);
  }

  const parsed = value.trim();

  if (maxLength !== undefined && parsed.length > maxLength) {
    throw new ValidationError(
      `${field} no puede superar ${maxLength} caracteres.`
    );
  }

  return parsed === "" ? null : parsed;
};

export const parsePositiveInteger = (
  value: unknown,
  field: string
): number => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${field} debe ser un entero positivo.`);
  }

  return parsed;
};

export const parseOptionalPositiveInteger = (
  value: unknown,
  field: string
): number | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parsePositiveInteger(value, field);
};

export const parseOptionalBoolean = (
  value: unknown,
  field: string
): boolean | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new ValidationError(`${field} debe ser boolean.`);
};

export const parseEnum = <T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[]
): T => {
  if (
    typeof value !== "string" ||
    !allowedValues.includes(value as T)
  ) {
    throw new ValidationError(
      `${field} debe ser uno de: ${allowedValues.join(", ")}.`
    );
  }

  return value as T;
};

export const parseOptionalEnum = <T extends string>(
  value: unknown,
  field: string,
  allowedValues: readonly T[]
): T | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return parseEnum(value, field, allowedValues);
};

export const requireAtLeastOneDefined = (
  value: JsonObject,
  fields: string[]
): void => {
  const hasDefinedValue = fields.some(
    (field) => value[field] !== undefined
  );

  if (!hasDefinedValue) {
    throw new ValidationError(
      `Debe informar al menos uno de estos campos: ${fields.join(", ")}.`
    );
  }
};
