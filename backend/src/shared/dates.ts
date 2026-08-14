export const toIsoDate = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return value;
};

export const toIsoDateTime = (value: Date | string): string => {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return value;
};
