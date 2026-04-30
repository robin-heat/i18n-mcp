export function flattenKeys(obj, prefix = '') {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenKeys(value, fullKey));
        }
        else {
            result[fullKey] = String(value ?? '');
        }
    }
    return result;
}
export function setNestedValue(obj, dottedPath, value) {
    const parts = dottedPath.split('.');
    const result = { ...obj };
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current[part] !== undefined && (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part]))) {
            throw new Error(`Cannot set '${dottedPath}': '${part}' is not a plain object`);
        }
        current[part] = typeof current[part] === 'object' && current[part] !== null && !Array.isArray(current[part])
            ? { ...current[part] }
            : {};
        current = current[part];
    }
    current[parts[parts.length - 1]] = value;
    return result;
}
export function deleteNestedKey(obj, dottedPath) {
    const parts = dottedPath.split('.');
    const result = { ...obj };
    let current = result;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (typeof current[part] !== 'object' || current[part] === null || Array.isArray(current[part]))
            return result;
        current[part] = { ...current[part] };
        current = current[part];
    }
    delete current[parts[parts.length - 1]];
    return result;
}
