import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync, } from 'node:fs';
import { dirname, join } from 'node:path';
const structureCache = new Map();
export function clearStructureCache() {
    structureCache.clear();
}
export function detectStructure(namespacePath, primaryLocale) {
    const cacheKey = `${namespacePath}::${primaryLocale}`;
    if (structureCache.has(cacheKey))
        return structureCache.get(cacheKey);
    const folderPath = join(namespacePath, primaryLocale, 'translation.json');
    const structure = existsSync(folderPath) ? 'folder' : 'flat';
    structureCache.set(cacheKey, structure);
    return structure;
}
export function localeFilePath(namespacePath, locale, structure) {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(locale)) {
        throw new Error(`Invalid locale name: '${locale}'. Locale names must contain only letters, digits, hyphens, and underscores.`);
    }
    return structure === 'flat'
        ? join(namespacePath, `${locale}.json`)
        : join(namespacePath, locale, 'translation.json');
}
export function readLocale(namespacePath, locale, structure) {
    const filePath = localeFilePath(namespacePath, locale, structure);
    if (!existsSync(filePath))
        return {};
    const content = readFileSync(filePath, 'utf-8');
    let parsed;
    try {
        parsed = JSON.parse(content);
    }
    catch (err) {
        throw new Error(`Invalid JSON in locale file ${filePath}: ${err.message}`, { cause: err });
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error(`Locale file ${filePath} must contain a JSON object, got: ${typeof parsed}`);
    }
    return parsed;
}
export function writeLocale(namespacePath, locale, structure, data) {
    const filePath = localeFilePath(namespacePath, locale, structure);
    mkdirSync(dirname(filePath), { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
    renameSync(tmpPath, filePath);
}
export function listLocales(namespacePath, structure) {
    if (!existsSync(namespacePath))
        return [];
    if (structure === 'flat') {
        return readdirSync(namespacePath)
            .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
            .map(f => f.slice(0, -5));
    }
    return readdirSync(namespacePath, { withFileTypes: true })
        .filter(entry => entry.isDirectory() &&
        existsSync(join(namespacePath, entry.name, 'translation.json')))
        .map(entry => entry.name);
}
