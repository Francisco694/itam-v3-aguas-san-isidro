import { ValidationError } from "../../shared/errors";

const formatoTelefonicoChileno = /^(?:\d{9}|56\d{9})$/;

export const normalizarNumeroTelefonicoChileno = (valor: string): string => {
  const limpio = valor.trim().replace(/\D/g, "");

  if (/[^\d.\-()\s+]/.test(valor) || !formatoTelefonicoChileno.test(limpio)) {
    throw new ValidationError(
      "Ingrese 9 dígitos o formato 56XXXXXXXXX."
    );
  }

  return limpio.length === 9 ? `56${limpio}` : limpio;
};

export const normalizarIccid = (valor: string): string => {
  const original = valor.trim();
  if (!/^[0-9\s-]+$/.test(original)) {
    throw new ValidationError("El ICCID solo puede contener dÃ­gitos, espacios o guiones.");
  }

  const normalizado = original.replace(/[\s-]/g, "");
  if (!/^\d{19,20}$/.test(normalizado)) {
    throw new ValidationError("El ICCID debe contener 19 o 20 dÃ­gitos.");
  }

  return normalizado;
};
