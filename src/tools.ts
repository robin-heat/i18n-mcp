import { minimatch } from 'minimatch';
import { Config } from './config.js';
import { detectStructure, FileStructure, listLocales, readLocale, writeLocale } from './namespace.js';
import { deleteNestedKey, flattenKeys, setNestedValue } from './utils.js';

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: true;
};

function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function err(text: string): ToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

function resolveNamespace(
  config: Config,
  name: string
): { path: string; structure: FileStructure } | null {
  const ns = config.namespaces.find(n => n.name === name);
  if (!ns) return null;
  return { path: ns.path, structure: detectStructure(ns.path, config.primaryLocale) };
}

function namespaceNotFound(config: Config, name: string): ToolResult {
  return err(
    `Namespace '${name}' not found. Available: ${config.namespaces.map(n => n.name).join(', ')}`
  );
}

export function getTranslations(config: Config, namespace: string, query?: string): ToolResult {
  const ns = resolveNamespace(config, namespace);
  if (!ns) return namespaceNotFound(config, namespace);

  const locales = listLocales(ns.path, ns.structure);
  const allKeys = new Set<string>();
  const byLocale: Record<string, Record<string, string>> = {};

  for (const locale of locales) {
    byLocale[locale] = flattenKeys(readLocale(ns.path, locale, ns.structure));
    for (const key of Object.keys(byLocale[locale])) allKeys.add(key);
  }

  let keys = Array.from(allKeys);

  if (query) {
    const lowerQuery = query.toLowerCase();
    keys = keys.filter(key => {
      if (minimatch(key, query)) return true;
      return locales.some(locale =>
        byLocale[locale][key]?.toLowerCase().includes(lowerQuery)
      );
    });
  }

  const result: Record<string, Record<string, string>> = {};
  for (const key of keys) {
    result[key] = {};
    for (const locale of locales) {
      if (byLocale[locale][key] !== undefined) result[key][locale] = byLocale[locale][key];
    }
  }

  return ok(JSON.stringify(result, null, 2));
}

export function addTranslation(
  config: Config,
  namespace: string,
  key: string,
  translations: Record<string, string>
): ToolResult {
  const ns = resolveNamespace(config, namespace);
  if (!ns) return namespaceNotFound(config, namespace);

  for (const [locale, value] of Object.entries(translations)) {
    const data = readLocale(ns.path, locale, ns.structure);
    writeLocale(ns.path, locale, ns.structure, setNestedValue(data, key, value));
  }

  return ok(`Added key '${key}' for locales: ${Object.keys(translations).join(', ')}`);
}

export function addMultipleTranslations(
  config: Config,
  namespace: string,
  entries: Array<{ key: string; translations: Record<string, string> }>
): ToolResult {
  const ns = resolveNamespace(config, namespace);
  if (!ns) return namespaceNotFound(config, namespace);

  const allLocales = new Set<string>();
  for (const { translations } of entries) {
    for (const locale of Object.keys(translations)) allLocales.add(locale);
  }

  const localeData: Record<string, Record<string, unknown>> = {};
  for (const locale of allLocales) {
    localeData[locale] = readLocale(ns.path, locale, ns.structure);
  }

  for (const { key, translations } of entries) {
    for (const [locale, value] of Object.entries(translations)) {
      localeData[locale] = setNestedValue(localeData[locale], key, value);
    }
  }

  for (const locale of allLocales) {
    writeLocale(ns.path, locale, ns.structure, localeData[locale]);
  }

  return ok(`Added ${entries.length} key(s) for locales: ${Array.from(allLocales).join(', ')}`);
}

export function deleteTranslation(config: Config, namespace: string, key: string): ToolResult {
  const ns = resolveNamespace(config, namespace);
  if (!ns) return namespaceNotFound(config, namespace);

  const locales = listLocales(ns.path, ns.structure);
  for (const locale of locales) {
    const data = readLocale(ns.path, locale, ns.structure);
    writeLocale(ns.path, locale, ns.structure, deleteNestedKey(data, key));
  }

  return ok(`Deleted key '${key}' from ${locales.length} locale(s)`);
}

export function checkTranslationIntegrity(config: Config, namespace?: string): ToolResult {
  const namespaces = namespace
    ? config.namespaces.filter(n => n.name === namespace)
    : config.namespaces;

  if (namespace && namespaces.length === 0) {
    return err(`Namespace '${namespace}' not found. Available: ${config.namespaces.map(n => n.name).join(', ')}`);
  }

  const report: Record<string, {
    missingKeys: Record<string, string[]>;
    extraKeys: Record<string, string[]>;
    emptyValues: Record<string, string[]>;
  }> = {};

  for (const ns of namespaces) {
    const structure = detectStructure(ns.path, config.primaryLocale);
    const locales = listLocales(ns.path, structure);
    const primaryFlat = flattenKeys(readLocale(ns.path, config.primaryLocale, structure));
    const primaryKeys = new Set(Object.keys(primaryFlat));

    const missingKeys: Record<string, string[]> = {};
    const extraKeys: Record<string, string[]> = {};
    const emptyValues: Record<string, string[]> = {};

    for (const locale of locales) {
      if (locale === config.primaryLocale) continue;
      const localeFlat = flattenKeys(readLocale(ns.path, locale, structure));
      const localeKeys = new Set(Object.keys(localeFlat));

      const missing = [...primaryKeys].filter(k => !localeKeys.has(k));
      const extra = [...localeKeys].filter(k => !primaryKeys.has(k));
      const empty = [...primaryKeys].filter(k => localeKeys.has(k) && !localeFlat[k]);

      if (missing.length) missingKeys[locale] = missing;
      if (extra.length) extraKeys[locale] = extra;
      if (empty.length) emptyValues[locale] = empty;
    }

    report[ns.name] = { missingKeys, extraKeys, emptyValues };
  }

  return ok(JSON.stringify(report, null, 2));
}
