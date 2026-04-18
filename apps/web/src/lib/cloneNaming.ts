const normalizeName = (value: string) => value.normalize('NFKC').trim().toLowerCase();

export const buildNextCloneName = (originalName: string, existingNames: Iterable<string>): string => {
  const base = originalName.trim();
  const normalizedExisting = new Set<string>();
  for (const name of existingNames) normalizedExisting.add(normalizeName(name));

  const firstClone = `${base} (clone)`;
  if (!normalizedExisting.has(normalizeName(firstClone))) return firstClone;

  for (let cloneIndex = 2; cloneIndex < 10_000; cloneIndex += 1) {
    const nextClone = `${base} (clone ${cloneIndex})`;
    if (!normalizedExisting.has(normalizeName(nextClone))) return nextClone;
  }

  return `${base} (clone ${Date.now()})`;
};
