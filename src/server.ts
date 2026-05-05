#!/usr/bin/env node
import { runInstall } from './install.js';

if (process.argv[2] === 'install') {
  runInstall();
  process.exit(0);
}

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { readConfig } from './config.js';
import {
  addMultipleTranslations,
  addTranslation,
  checkTranslationIntegrity,
  checkTranslationQuality,
  deleteTranslation,
  findUntranslatedValues,
  getNamespaceKeys,
  getTranslation,
  getTranslations,
} from './tools.js';

const config = readConfig();

const server = new Server(
  { name: 'i18n-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_translation',
      description:
        'Get the translations for a single key across all locales. ' +
        'Use this for targeted lookups — get_translations returns the entire namespace which is too large for inline spot-checks.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Namespace name from .i18n-mcp.json' },
          key: { type: 'string', description: 'Dot-notation key, e.g. "button.save"' },
        },
        required: ['namespace', 'key'],
      },
    },
    {
      name: 'get_namespace_keys',
      description:
        'Return a sorted list of all dot-notation keys in a namespace without their values. ' +
        'Use this to plan batch translation work — avoids blowing context with full locale values across many locales.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Namespace name from .i18n-mcp.json' },
        },
        required: ['namespace'],
      },
    },
    {
      name: 'get_translations',
      description:
        'Get all translations for a namespace as { key: { locale: value } } pairs. ' +
        'Optional query filters by glob on keys (e.g. "button.*") or substring match on any locale value. ' +
        'Always call this before adding new keys to check for duplicates.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Namespace name from .i18n-mcp.json' },
          query: { type: 'string', description: 'Glob pattern on keys or substring on values' },
        },
        required: ['namespace'],
      },
    },
    {
      name: 'add_translation',
      description:
        'Add or update a single translation key across one or more locales. ' +
        'Key uses dot notation (e.g. "button.save"). ' +
        'Only the provided locales are written — other locales are unchanged.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          key: { type: 'string', description: 'Dot-notation key path, e.g. "button.save"' },
          translations: {
            type: 'object',
            description: 'Map of locale to string, e.g. { "en": "Save", "de": "Speichern" }',
            additionalProperties: { type: 'string' },
          },
        },
        required: ['namespace', 'key', 'translations'],
      },
    },
    {
      name: 'add_multiple_translations',
      description:
        'Add or update multiple translation keys in one operation. ' +
        'More efficient than repeated add_translation calls — writes once per locale file. ' +
        'Prefer this for bulk work.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          entries: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                translations: { type: 'object', additionalProperties: { type: 'string' } },
              },
              required: ['key', 'translations'],
            },
          },
        },
        required: ['namespace', 'entries'],
      },
    },
    {
      name: 'delete_translation',
      description: 'Remove a translation key from all locale files in a namespace.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string' },
          key: { type: 'string', description: 'Dot-notation key path to delete' },
        },
        required: ['namespace', 'key'],
      },
    },
    {
      name: 'find_untranslated_values',
      description:
        'Find keys where the translated value is identical to the primary locale value — ' +
        'i.e. placeholder translations that were never actually translated. ' +
        'Terms in doNotTranslate are excluded. ' +
        'Returns { locale: { key: primaryValue } } for each stale key found.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Namespace name from .i18n-mcp.json' },
          locale: { type: 'string', description: 'Check only this locale (optional — defaults to all non-primary locales)' },
        },
        required: ['namespace'],
      },
    },
    {
      name: 'check_translation_integrity',
      description:
        'Compare all locale files against the primary locale. ' +
        'Returns missing keys, extra keys, and empty values per locale. ' +
        'Omit namespace to check all configured namespaces.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Check only this namespace (optional)' },
        },
        required: [],
      },
    },
    {
      name: 'check_translation_quality',
      description:
        'Check translation quality for specific keys. Returns issues per locale per key: ' +
        '"untranslated" (value identical to primary), "empty" (missing or blank), ' +
        '"short" (less than 30% the length of the primary value for strings longer than 15 chars). ' +
        'Use this for targeted quality checks instead of scanning the full namespace.',
      inputSchema: {
        type: 'object',
        properties: {
          namespace: { type: 'string', description: 'Namespace name from .i18n-mcp.json' },
          keys: {
            type: 'array',
            items: { type: 'string' },
            description: 'Dot-notation keys to check, e.g. ["button.save", "title"]',
          },
        },
        required: ['namespace', 'keys'],
      },
    },
  ],
}));

const safeKey = z.string().min(1).refine(
  k => k.split('.').every(p => p.length > 0 && !['__proto__', 'constructor', 'prototype'].includes(p)),
  { message: 'Key contains reserved or empty segments' }
);

const GetNamespaceKeysInput = z.object({
  namespace: z.string().min(1),
});

const GetTranslationInput = z.object({
  namespace: z.string().min(1),
  key: safeKey,
});

const GetTranslationsInput = z.object({
  namespace: z.string().min(1),
  query: z.string().optional(),
});

const AddTranslationInput = z.object({
  namespace: z.string().min(1),
  key: safeKey,
  translations: z.record(z.string()),
});

const AddMultipleTranslationsInput = z.object({
  namespace: z.string().min(1),
  entries: z.array(z.object({ key: safeKey, translations: z.record(z.string()) })).min(1),
});

const DeleteTranslationInput = z.object({
  namespace: z.string().min(1),
  key: safeKey,
});

const FindUntranslatedInput = z.object({
  namespace: z.string().min(1),
  locale: z.string().optional(),
});

const CheckIntegrityInput = z.object({
  namespace: z.string().optional(),
});

const CheckTranslationQualityInput = z.object({
  namespace: z.string().min(1),
  keys: z.array(safeKey).min(1),
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === 'get_namespace_keys') {
      const parsed = GetNamespaceKeysInput.safeParse(args);
      if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
      return getNamespaceKeys(config, parsed.data.namespace);
    }

    if (name === 'get_translation') {
      const parsed = GetTranslationInput.safeParse(args);
      if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
      return getTranslation(config, parsed.data.namespace, parsed.data.key);
    }

    if (name === 'get_translations') {
      const parsed = GetTranslationsInput.safeParse(args);
      if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
      return getTranslations(config, parsed.data.namespace, parsed.data.query);
    }

    if (name === 'add_translation') {
      const parsed = AddTranslationInput.safeParse(args);
      if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
      return addTranslation(config, parsed.data.namespace, parsed.data.key, parsed.data.translations);
    }

    if (name === 'add_multiple_translations') {
      const parsed = AddMultipleTranslationsInput.safeParse(args);
      if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
      return addMultipleTranslations(config, parsed.data.namespace, parsed.data.entries);
    }

    if (name === 'delete_translation') {
      const parsed = DeleteTranslationInput.safeParse(args);
      if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
      return deleteTranslation(config, parsed.data.namespace, parsed.data.key);
    }

    if (name === 'find_untranslated_values') {
      const parsed = FindUntranslatedInput.safeParse(args);
      if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
      return findUntranslatedValues(config, parsed.data.namespace, parsed.data.locale);
    }

    if (name === 'check_translation_integrity') {
      const parsed = CheckIntegrityInput.safeParse(args);
      if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
      return checkTranslationIntegrity(config, parsed.data.namespace);
    }

    if (name === 'check_translation_quality') {
      const parsed = CheckTranslationQualityInput.safeParse(args);
      if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
      return checkTranslationQuality(config, parsed.data.namespace, parsed.data.keys);
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: 'text', text: msg }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
