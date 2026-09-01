export const normalizeRut = (value: unknown): string =>
  String(value ?? '')
    .replace(/[^0-9kK]/g, '')
    .toUpperCase();

export const formatRut = (value: unknown): string => {
  const rut = normalizeRut(value);
  if (rut.length < 2) return rut;

  const body = rut.slice(0, -1);
  const groups: string[] = [];
  for (let end = body.length; end > 0; end -= 3) {
    groups.unshift(body.slice(Math.max(0, end - 3), end));
  }

  return `${groups.join('.')}-${rut.at(-1) ?? ''}`;
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

  const raw = 11 - (sum % 11);
  const expected = raw === 11 ? '0' : raw === 10 ? 'K' : String(raw);
  return expected === rut.at(-1);
};

export const formattedRutCaret = (formatted: string, canonicalCharacters: number): number => {
  if (canonicalCharacters <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/[0-9K]/.test(formatted[index] ?? '')) seen += 1;
    if (seen === canonicalCharacters) return index + 1;
  }
  return formatted.length;
};
