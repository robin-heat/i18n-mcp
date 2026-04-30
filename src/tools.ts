import { minimatch } from 'minimatch';
import { Config } from './config.js';
import { detectStructure, FileStructure, listLocales, readLocale } from './namespace.js';
import { flattenKeys } from './utils.js';

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
