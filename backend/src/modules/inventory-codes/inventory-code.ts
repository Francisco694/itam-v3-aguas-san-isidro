const BLOCK_SIZE = 999;

export const formatInventoryCode = (
  prefix: string,
  ordinal: number
): number => {
  if (!/^[1-9]$/.test(prefix)) {
    throw new Error("El prefijo debe ser un dígito entre 1 y 9.");
  }

  if (!Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw new Error("El ordinal debe ser un entero positivo.");
  }

  const block = Math.floor((ordinal - 1) / BLOCK_SIZE) + 1;
  const position = ((ordinal - 1) % BLOCK_SIZE) + 1;
  const codeText = `${prefix.repeat(block)}${String(position).padStart(3, "0")}`;
  const code = Number(codeText);

  if (!Number.isSafeInteger(code) || code > 2_147_483_647) {
    throw new Error("La familia agotó el rango INTEGER disponible.");
  }

  return code;
};
