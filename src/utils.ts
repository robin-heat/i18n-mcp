export function flattenKeys(obj: Record<string, unknown>, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      result[fullKey] = String(value ?? '');
    }
  }
  return result;
}

export function setNestedValue(
  obj: Record<string, unknown>,
  dottedPath: string,
  value: string
): Record<string, unknown> {
  const parts = dottedPath.split('.');
  const result = { ...obj };
  let current: Record<string, unknown> = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] !== undefined && (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part]))) {
      throw new Error(
        `Cannot set '${dottedPath}': '${part}' is not a plain object`
      );
    }
    current[part] = typeof current[part] === 'object' && current[part] !== null && !Array.isArray(current[part])
      ? { ...(current[part] as Record<string, unknown>) }
      : {};
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]] = value;
  return result;
}

export function deleteNestedKey(
  obj: Record<string, unknown>,
  dottedPath: string
): Record<string, unknown> {
  const parts = dottedPath.split('.');
  const result = { ...obj };
  let current: Record<string, unknown> = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part])) return result;
    current[part] = { ...(current[part] as Record<string, unknown>) };
    current = current[part] as Record<string, unknown>;
  }
  delete current[parts[parts.length - 1]];
  return result;
}
