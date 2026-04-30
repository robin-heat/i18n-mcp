import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';

export type FileStructure = 'flat' | 'folder';

const structureCache = new Map<string, FileStructure>();

export function clearStructureCache(): void {
  structureCache.clear();
}

export function detectStructure(namespacePath: string, primaryLocale: string): FileStructure {
  if (structureCache.has(namespacePath)) return structureCache.get(namespacePath)!;
  const folderPath = join(namespacePath, primaryLocale, 'translation.json');
  const structure: FileStructure = existsSync(folderPath) ? 'folder' : 'flat';
  structureCache.set(namespacePath, structure);
  return structure;
}

export function localeFilePath(
  namespacePath: string,
  locale: string,
  structure: FileStructure
): string {
  return structure === 'flat'
    ? join(namespacePath, `${locale}.json`)
    : join(namespacePath, locale, 'translation.json');
}

export function readLocale(
  namespacePath: string,
  locale: string,
  structure: FileStructure
): Record<string, unknown> {
  const filePath = localeFilePath(namespacePath, locale, structure);
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function writeLocale(
  namespacePath: string,
  locale: string,
  structure: FileStructure,
  data: Record<string, unknown>
): void {
  const filePath = localeFilePath(namespacePath, locale, structure);
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  renameSync(tmpPath, filePath);
}

export function listLocales(namespacePath: string, structure: FileStructure): string[] {
  if (!existsSync(namespacePath)) return [];
  if (structure === 'flat') {
    return readdirSync(namespacePath)
      .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
      .map(f => f.slice(0, -5));
  }
  return readdirSync(namespacePath, { withFileTypes: true })
    .filter(
      entry =>
        entry.isDirectory() &&
        existsSync(join(namespacePath, entry.name, 'translation.json'))
    )
    .map(entry => entry.name);
}
