/**
 * Deep merge two objects. Source values override target values.
 * Arrays are not merged — source array replaces target array.
 */
export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result: Record<string, unknown> = { ...target };

  for (const key of Object.keys(source)) {
    const typedKey = key as keyof T;
    const targetVal = target[typedKey];
    const sourceVal = source[typedKey];

    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(targetVal as Record<string, unknown>, sourceVal as Record<string, unknown>);
    } else if (sourceVal !== undefined) {
      result[key] = sourceVal;
    }
  }

  return result as T;
}
