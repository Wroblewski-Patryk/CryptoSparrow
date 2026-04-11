export const uniqueSortedSymbols = (values: string[]) =>
  [...new Set(values.map((item) => item.trim().toUpperCase()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
