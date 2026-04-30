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
  deleteTranslation,
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
  ],
}));

const safeKey = z.string().min(1).refine(
  k => k.split('.').every(p => p.length > 0 && !['__proto__', 'constructor', 'prototype'].includes(p)),
  { message: 'Key contains reserved or empty segments' }
);

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

const CheckIntegrityInput = z.object({
  namespace: z.string().optional(),
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
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

  if (name === 'check_translation_integrity') {
    const parsed = CheckIntegrityInput.safeParse(args);
    if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
    return checkTranslationIntegrity(config, parsed.data.namespace);
  }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { content: [{ type: 'text', text: msg }], isError: true };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
