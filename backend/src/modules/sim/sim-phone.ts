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
