export const normalizeRut = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value).trim().replace(/[^0-9kK]/g, "").toUpperCase();
};

export const isValidRut = (value: unknown): boolean => {
  const rut = normalizeRut(value);
  if (rut.length < 2 || !/^\d+[0-9K]$/.test(rut)) return false;

  let sum = 0;
  let multiplier = 2;
  for (let index = rut.length - 2; index >= 0; index -= 1) {
    sum += Number(rut[index]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const rawDigit = 11 - (sum % 11);
  const expected = rawDigit === 11 ? "0" : rawDigit === 10 ? "K" : String(rawDigit);
  return expected === rut.at(-1);
};

export const formatRut = (value: unknown): string => {
  const rut = normalizeRut(value);
  const body = rut.slice(0, -1);
  const groups: string[] = [];
  for (let end = body.length; end > 0; end -= 3) {
    groups.unshift(body.slice(Math.max(0, end - 3), end));
  }
  return `${groups.join(".")}-${rut.at(-1) ?? ""}`;
};
