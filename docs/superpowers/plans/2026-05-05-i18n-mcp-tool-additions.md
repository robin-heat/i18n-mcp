# i18n-mcp Tool Additions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add five new tools/enhancements that eliminate the need for Python spot-check scripts when working with translations.

**Architecture:** Each feature is a function added to `src/tools.ts` and registered in `src/server.ts`. Tests live in `tests/tools.test.ts`. All tools follow the existing `ToolResult` / Zod validation pattern. Tasks are independent and can be done in any order except Task 6 (docs), which comes last.

**Tech Stack:** TypeScript, Node.js, `@modelcontextprotocol/sdk`, `zod`, `vitest`

---

## File Map

| File | Changes |
|---|---|
| `src/tools.ts` | Add `getTranslation`, `checkTranslationQuality`, `getNamespaceKeys`, `copyFromPrimary`; modify `addMultipleTranslations` |
| `src/server.ts` | Register new tools in ListTools handler; add Zod schemas; add CallTool branches |
| `tests/tools.test.ts` | Add describe blocks for each new function |
| `README.md` | Document new tools |
| `skills/i18n-usage.md` | Update workflow to reference new tools |

---

## Task 1: `getTranslation` — single key lookup

**Files:**
- Modify: `src/tools.ts` (after `getTranslations`)
- Modify: `src/server.ts` (ListTools array + Zod schemas + CallTool handler)
- Modify: `tests/tools.test.ts`

- [ ] **Step 1: Write the failing tests**

Add this describe block to `tests/tools.test.ts`. First update the import line at the top:

```typescript
import { addMultipleTranslations, addTranslation, checkTranslationIntegrity, deleteTranslation, findUntranslatedValues, getTranslation, getTranslations } from '../src/tools.js';
```

Add the describe block (after the existing `getTranslations` block):

```typescript
describe('getTranslation', () => {
  it('returns translations for a key across all locales', () => {
    const result = getTranslation(config, 'common', 'button.save');
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual({ en: 'Save', de: 'Speichern' });
  });

  it('returns only locales where the key exists', () => {
    addTranslation(config, 'common', 'en.only', { en: 'English only' });
    const result = getTranslation(config, 'common', 'en.only');
    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual({ en: 'English only' });
    expect(data.de).toBeUndefined();
  });

  it('returns not-found message when key does not exist', () => {
    const result = getTranslation(config, 'common', 'nonexistent.key');
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('not found');
  });

  it('returns isError for unknown namespace', () => {
    const result = getTranslation(config, 'unknown', 'button.save');
    expect(result.isError).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 'getTranslation'
```

Expected: FAIL with `getTranslation is not a function` or similar.

- [ ] **Step 3: Implement `getTranslation` in `src/tools.ts`**

Add after the `getTranslations` function:

```typescript
export function getTranslation(
  config: Config,
  namespace: string,
  key: string
): ToolResult {
  const ns = resolveNamespace(config, namespace);
  if (!ns) return namespaceNotFound(config, namespace);

  const locales = listLocales(ns.path, ns.structure);
  const result: Record<string, string> = {};

  for (const locale of locales) {
    const flat = flattenKeys(readLocale(ns.path, locale, ns.structure));
    if (flat[key] !== undefined) result[locale] = flat[key];
  }

  if (Object.keys(result).length === 0) {
    return ok(`Key '${key}' not found in any locale.`);
  }
  return ok(JSON.stringify(result, null, 2));
}
```

- [ ] **Step 4: Register in `src/server.ts` — import**

Update the import from `./tools.js`:

```typescript
import {
  addMultipleTranslations,
  addTranslation,
  checkTranslationIntegrity,
  deleteTranslation,
  findUntranslatedValues,
  getTranslation,
  getTranslations,
} from './tools.js';
```

- [ ] **Step 5: Register in `src/server.ts` — ListTools**

Add to the `tools` array in `ListToolsRequestSchema` handler, before `get_translations`:

```typescript
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
```

- [ ] **Step 6: Register in `src/server.ts` — Zod schema + handler**

Add Zod schema after `GetTranslationsInput`:

```typescript
const GetTranslationInput = z.object({
  namespace: z.string().min(1),
  key: safeKey,
});
```

Add handler branch in `CallToolRequestSchema`, before the `get_translations` branch:

```typescript
if (name === 'get_translation') {
  const parsed = GetTranslationInput.safeParse(args);
  if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
  return getTranslation(config, parsed.data.namespace, parsed.data.key);
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/tools.ts src/server.ts tests/tools.test.ts
git commit -m "feat: add get_translation tool for single-key lookup"
```

---

## Task 2: `checkTranslationQuality` — targeted quality check

**Files:**
- Modify: `src/tools.ts` (after `findUntranslatedValues`)
- Modify: `src/server.ts`
- Modify: `tests/tools.test.ts`

Issues detected per locale per key:
- `"untranslated"` — value identical to primary
- `"empty"` — value is empty string or key is missing
- `"short"` — primary value > 15 chars and translated value < 30% of primary length

- [ ] **Step 1: Write the failing tests**

Update the `tests/tools.test.ts` import:

```typescript
import { addMultipleTranslations, addTranslation, checkTranslationIntegrity, checkTranslationQuality, deleteTranslation, findUntranslatedValues, getTranslation, getTranslations } from '../src/tools.js';
```

Add the describe block:

```typescript
describe('checkTranslationQuality', () => {
  it('returns clean message for fully translated keys', () => {
    const result = checkTranslationQuality(config, 'common', ['button.save', 'title']);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('All specified keys look good.');
  });

  it('flags untranslated values (identical to primary)', () => {
    addTranslation(config, 'common', 'brand', { en: 'Robin', de: 'Robin' });
    const result = checkTranslationQuality(config, 'common', ['brand']);
    const data = JSON.parse(result.content[0].text);
    expect(data['brand']['de'].issue).toBe('untranslated');
    expect(data['brand']['de'].value).toBe('Robin');
    expect(data['brand']['de'].primaryValue).toBe('Robin');
  });

  it('flags empty values', () => {
    addTranslation(config, 'common', 'empty.key', { en: 'Has value', de: '' });
    const result = checkTranslationQuality(config, 'common', ['empty.key']);
    const data = JSON.parse(result.content[0].text);
    expect(data['empty.key']['de'].issue).toBe('empty');
  });

  it('flags missing values as empty', () => {
    addTranslation(config, 'common', 'missing.in.de', { en: 'Only English' });
    const result = checkTranslationQuality(config, 'common', ['missing.in.de']);
    const data = JSON.parse(result.content[0].text);
    expect(data['missing.in.de']['de'].issue).toBe('empty');
  });

  it('flags suspiciously short translations', () => {
    addTranslation(config, 'common', 'long.text', {
      en: 'This is a very long English description text',
      de: 'Kurz',
    });
    const result = checkTranslationQuality(config, 'common', ['long.text']);
    const data = JSON.parse(result.content[0].text);
    expect(data['long.text']['de'].issue).toBe('short');
    expect(data['long.text']['de'].primaryValue).toBe('This is a very long English description text');
  });

  it('does not flag short primary values for length ratio', () => {
    addTranslation(config, 'common', 'word', { en: 'Yes', de: 'Ja' });
    const result = checkTranslationQuality(config, 'common', ['word']);
    expect(result.content[0].text).toBe('All specified keys look good.');
  });

  it('skips keys not found in primary locale', () => {
    const result = checkTranslationQuality(config, 'common', ['nonexistent.key']);
    expect(result.content[0].text).toBe('All specified keys look good.');
  });

  it('returns isError for unknown namespace', () => {
    const result = checkTranslationQuality(config, 'unknown', ['button.save']);
    expect(result.isError).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 'checkTranslationQuality'
```

Expected: FAIL with `checkTranslationQuality is not a function`.

- [ ] **Step 3: Implement `checkTranslationQuality` in `src/tools.ts`**

Add after `findUntranslatedValues`:

```typescript
type QualityIssue = { issue: 'untranslated' | 'empty' | 'short'; value: string; primaryValue: string };

export function checkTranslationQuality(
  config: Config,
  namespace: string,
  keys: string[]
): ToolResult {
  const ns = resolveNamespace(config, namespace);
  if (!ns) return namespaceNotFound(config, namespace);

  const locales = listLocales(ns.path, ns.structure);
  const nonPrimaryLocales = locales.filter(l => l !== config.primaryLocale);
  const primaryFlat = flattenKeys(readLocale(ns.path, config.primaryLocale, ns.structure));

  const localeFlats: Record<string, Record<string, string>> = {};
  for (const locale of nonPrimaryLocales) {
    localeFlats[locale] = flattenKeys(readLocale(ns.path, locale, ns.structure));
  }

  const result: Record<string, Record<string, QualityIssue>> = {};

  for (const key of keys) {
    const primaryValue = primaryFlat[key];
    if (primaryValue === undefined) continue;

    const issues: Record<string, QualityIssue> = {};
    for (const locale of nonPrimaryLocales) {
      const value = localeFlats[locale][key];
      if (value === undefined || value === '') {
        issues[locale] = { issue: 'empty', value: value ?? '', primaryValue };
      } else if (value === primaryValue) {
        issues[locale] = { issue: 'untranslated', value, primaryValue };
      } else if (primaryValue.length > 15 && value.length < primaryValue.length * 0.3) {
        issues[locale] = { issue: 'short', value, primaryValue };
      }
    }
    if (Object.keys(issues).length > 0) result[key] = issues;
  }

  if (Object.keys(result).length === 0) return ok('All specified keys look good.');
  return ok(JSON.stringify(result, null, 2));
}
```

- [ ] **Step 4: Register in `src/server.ts` — import**

Add `checkTranslationQuality` to the import from `./tools.js`.

- [ ] **Step 5: Register in `src/server.ts` — ListTools**

Add to the `tools` array, after `find_untranslated_values`:

```typescript
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
```

- [ ] **Step 6: Register in `src/server.ts` — Zod schema + handler**

Add Zod schema:

```typescript
const CheckTranslationQualityInput = z.object({
  namespace: z.string().min(1),
  keys: z.array(z.string().min(1)).min(1),
});
```

Add handler branch:

```typescript
if (name === 'check_translation_quality') {
  const parsed = CheckTranslationQualityInput.safeParse(args);
  if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
  return checkTranslationQuality(config, parsed.data.namespace, parsed.data.keys);
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/tools.ts src/server.ts tests/tools.test.ts
git commit -m "feat: add check_translation_quality tool"
```

---

## Task 3: `getNamespaceKeys` — keys-only listing

**Files:**
- Modify: `src/tools.ts`
- Modify: `src/server.ts`
- Modify: `tests/tools.test.ts`

- [ ] **Step 1: Write the failing tests**

Update the `tests/tools.test.ts` import to add `getNamespaceKeys`:

```typescript
import { addMultipleTranslations, addTranslation, checkTranslationIntegrity, checkTranslationQuality, deleteTranslation, findUntranslatedValues, getNamespaceKeys, getTranslation, getTranslations } from '../src/tools.js';
```

Add describe block:

```typescript
describe('getNamespaceKeys', () => {
  it('returns sorted list of all dot-notation keys from primary locale', () => {
    const result = getNamespaceKeys(config, 'common');
    expect(result.isError).toBeUndefined();
    const keys = JSON.parse(result.content[0].text);
    expect(keys).toEqual(['button.cancel', 'button.save', 'title']);
  });

  it('reflects keys added to primary locale', () => {
    addTranslation(config, 'common', 'new.key', { en: 'New' });
    const result = getNamespaceKeys(config, 'common');
    const keys = JSON.parse(result.content[0].text);
    expect(keys).toContain('new.key');
  });

  it('returns isError for unknown namespace', () => {
    const result = getNamespaceKeys(config, 'unknown');
    expect(result.isError).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 'getNamespaceKeys'
```

Expected: FAIL with `getNamespaceKeys is not a function`.

- [ ] **Step 3: Implement `getNamespaceKeys` in `src/tools.ts`**

Add after `getTranslation`:

```typescript
export function getNamespaceKeys(config: Config, namespace: string): ToolResult {
  const ns = resolveNamespace(config, namespace);
  if (!ns) return namespaceNotFound(config, namespace);

  const flat = flattenKeys(readLocale(ns.path, config.primaryLocale, ns.structure));
  const keys = Object.keys(flat).sort();
  return ok(JSON.stringify(keys, null, 2));
}
```

- [ ] **Step 4: Register in `src/server.ts` — import**

Add `getNamespaceKeys` to the import from `./tools.js`.

- [ ] **Step 5: Register in `src/server.ts` — ListTools**

Add to the `tools` array, after `get_translation`:

```typescript
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
```

- [ ] **Step 6: Register in `src/server.ts` — Zod schema + handler**

Add Zod schema:

```typescript
const GetNamespaceKeysInput = z.object({
  namespace: z.string().min(1),
});
```

Add handler branch:

```typescript
if (name === 'get_namespace_keys') {
  const parsed = GetNamespaceKeysInput.safeParse(args);
  if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
  return getNamespaceKeys(config, parsed.data.namespace);
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/tools.ts src/server.ts tests/tools.test.ts
git commit -m "feat: add get_namespace_keys tool"
```

---

## Task 4: `addMultipleTranslations` locales filter

**Files:**
- Modify: `src/tools.ts` (signature + implementation of existing function)
- Modify: `src/server.ts` (Zod schema + tool description)
- Modify: `tests/tools.test.ts`

Optional `locales` param acts as an allowlist — locales not in the list are skipped even if present in the `translations` object. When omitted, behavior is identical to current.

- [ ] **Step 1: Write the failing tests**

Add to the existing `addMultipleTranslations` describe block in `tests/tools.test.ts`:

```typescript
  it('only writes locales included in the locales filter', () => {
    addMultipleTranslations(config, 'common', [
      { key: 'filtered.key', translations: { en: 'English', de: 'Deutsch' } },
    ], ['de']);
    const result = getTranslations(config, 'common', 'filtered.key');
    const data = JSON.parse(result.content[0].text);
    expect(data['filtered.key']['de']).toBe('Deutsch');
    expect(data['filtered.key']['en']).toBeUndefined();
  });

  it('writes all locales when no filter is provided', () => {
    addMultipleTranslations(config, 'common', [
      { key: 'unfiltered.key', translations: { en: 'English', de: 'Deutsch' } },
    ]);
    const result = getTranslations(config, 'common', 'unfiltered.key');
    const data = JSON.parse(result.content[0].text);
    expect(data['unfiltered.key']['en']).toBe('English');
    expect(data['unfiltered.key']['de']).toBe('Deutsch');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 'locales filter'
```

Expected: FAIL — the new test cases fail because the filter isn't applied yet.

- [ ] **Step 3: Update `addMultipleTranslations` in `src/tools.ts`**

Replace the existing function with:

```typescript
export function addMultipleTranslations(
  config: Config,
  namespace: string,
  entries: Array<{ key: string; translations: Record<string, string> }>,
  locales?: string[]
): ToolResult {
  const ns = resolveNamespace(config, namespace);
  if (!ns) return namespaceNotFound(config, namespace);

  const allLocales = new Set<string>();
  for (const { translations } of entries) {
    for (const locale of Object.keys(translations)) {
      if (locales && !locales.includes(locale)) continue;
      allLocales.add(locale);
    }
  }

  const localeData: Record<string, Record<string, unknown>> = {};
  for (const locale of allLocales) {
    localeData[locale] = readLocale(ns.path, locale, ns.structure);
  }

  for (const { key, translations } of entries) {
    for (const [locale, value] of Object.entries(translations)) {
      if (locales && !locales.includes(locale)) continue;
      localeData[locale] = setNestedValue(localeData[locale], key, value);
    }
  }

  for (const locale of allLocales) {
    writeLocale(ns.path, locale, ns.structure, localeData[locale]);
  }

  return ok(`Added ${entries.length} key(s) for locales: ${Array.from(allLocales).join(', ')}`);
}
```

- [ ] **Step 4: Update Zod schema in `src/server.ts`**

Replace `AddMultipleTranslationsInput`:

```typescript
const AddMultipleTranslationsInput = z.object({
  namespace: z.string().min(1),
  entries: z.array(z.object({ key: safeKey, translations: z.record(z.string()) })).min(1),
  locales: z.array(z.string().min(1)).optional(),
});
```

- [ ] **Step 5: Update tool description in `src/server.ts` ListTools**

Replace the `add_multiple_translations` entry:

```typescript
{
  name: 'add_multiple_translations',
  description:
    'Add or update multiple translation keys in one operation. ' +
    'More efficient than repeated add_translation calls — writes once per locale file. ' +
    'Prefer this for bulk work. ' +
    'Optional locales filter restricts which locales are written, even if translations for other locales are provided in the entries.',
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
      locales: {
        type: 'array',
        items: { type: 'string' },
        description: 'Only write these locales — others in translations are ignored (optional)',
      },
    },
    required: ['namespace', 'entries'],
  },
},
```

- [ ] **Step 6: Update CallTool handler in `src/server.ts`**

Replace the `add_multiple_translations` handler branch:

```typescript
if (name === 'add_multiple_translations') {
  const parsed = AddMultipleTranslationsInput.safeParse(args);
  if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
  return addMultipleTranslations(config, parsed.data.namespace, parsed.data.entries, parsed.data.locales);
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass (existing tests unaffected — `locales` is optional).

- [ ] **Step 8: Commit**

```bash
git add src/tools.ts src/server.ts tests/tools.test.ts
git commit -m "feat: add optional locales filter to add_multiple_translations"
```

---

## Task 5: `copyFromPrimary` — verbatim copy from primary locale

**Files:**
- Modify: `src/tools.ts`
- Modify: `src/server.ts`
- Modify: `tests/tools.test.ts`

Copies the primary locale value verbatim to specified locales for specified keys. Returns an error if any key is missing from the primary locale.

- [ ] **Step 1: Write the failing tests**

Update the `tests/tools.test.ts` import to add `copyFromPrimary`:

```typescript
import { addMultipleTranslations, addTranslation, checkTranslationIntegrity, checkTranslationQuality, copyFromPrimary, deleteTranslation, findUntranslatedValues, getNamespaceKeys, getTranslation, getTranslations } from '../src/tools.js';
```

Add describe block:

```typescript
describe('copyFromPrimary', () => {
  it('copies primary value to specified locales', () => {
    addTranslation(config, 'common', 'brand.name', { en: 'Robin' });
    copyFromPrimary(config, 'common', ['brand.name'], ['de']);
    const result = getTranslations(config, 'common', 'brand.name');
    const data = JSON.parse(result.content[0].text);
    expect(data['brand.name']['de']).toBe('Robin');
  });

  it('copies multiple keys in one call', () => {
    copyFromPrimary(config, 'common', ['button.save', 'title'], ['de']);
    const result = getTranslations(config, 'common');
    const data = JSON.parse(result.content[0].text);
    expect(data['button.save']['de']).toBe('Save');
    expect(data['title']['de']).toBe('Hello');
  });

  it('overwrites existing translation with primary value', () => {
    copyFromPrimary(config, 'common', ['button.save'], ['de']);
    const result = getTranslations(config, 'common', 'button.save');
    const data = JSON.parse(result.content[0].text);
    expect(data['button.save']['de']).toBe('Save');
  });

  it('returns isError when a key does not exist in primary locale', () => {
    const result = copyFromPrimary(config, 'common', ['nonexistent.key'], ['de']);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('nonexistent.key');
  });

  it('returns isError for unknown namespace', () => {
    const result = copyFromPrimary(config, 'unknown', ['button.save'], ['de']);
    expect(result.isError).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 'copyFromPrimary'
```

Expected: FAIL with `copyFromPrimary is not a function`.

- [ ] **Step 3: Implement `copyFromPrimary` in `src/tools.ts`**

Add after `addMultipleTranslations`:

```typescript
export function copyFromPrimary(
  config: Config,
  namespace: string,
  keys: string[],
  locales: string[]
): ToolResult {
  const ns = resolveNamespace(config, namespace);
  if (!ns) return namespaceNotFound(config, namespace);

  const primaryFlat = flattenKeys(readLocale(ns.path, config.primaryLocale, ns.structure));

  const missingKeys = keys.filter(k => primaryFlat[k] === undefined);
  if (missingKeys.length > 0) {
    return err(`Keys not found in primary locale '${config.primaryLocale}': ${missingKeys.join(', ')}`);
  }

  for (const locale of locales) {
    let data = readLocale(ns.path, locale, ns.structure);
    for (const key of keys) {
      data = setNestedValue(data, key, primaryFlat[key]);
    }
    writeLocale(ns.path, locale, ns.structure, data);
  }

  return ok(`Copied ${keys.length} key(s) from '${config.primaryLocale}' to locales: ${locales.join(', ')}`);
}
```

- [ ] **Step 4: Register in `src/server.ts` — import**

Add `copyFromPrimary` to the import from `./tools.js`.

- [ ] **Step 5: Register in `src/server.ts` — ListTools**

Add to the `tools` array, after `add_multiple_translations`:

```typescript
{
  name: 'copy_from_primary',
  description:
    'Copy the primary locale value verbatim to specified locales for specified keys. ' +
    'Use for brand names, prices, percentages, and other terms that legitimately should not be translated. ' +
    'Returns an error if any key is missing from the primary locale.',
  inputSchema: {
    type: 'object',
    properties: {
      namespace: { type: 'string', description: 'Namespace name from .i18n-mcp.json' },
      keys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Dot-notation keys to copy, e.g. ["brand.name", "unit.percent"]',
      },
      locales: {
        type: 'array',
        items: { type: 'string' },
        description: 'Target locales to copy into, e.g. ["de", "fr"]',
      },
    },
    required: ['namespace', 'keys', 'locales'],
  },
},
```

- [ ] **Step 6: Register in `src/server.ts` — Zod schema + handler**

Add Zod schema:

```typescript
const CopyFromPrimaryInput = z.object({
  namespace: z.string().min(1),
  keys: z.array(z.string().min(1)).min(1),
  locales: z.array(z.string().min(1)).min(1),
});
```

Add handler branch:

```typescript
if (name === 'copy_from_primary') {
  const parsed = CopyFromPrimaryInput.safeParse(args);
  if (!parsed.success) return { content: [{ type: 'text', text: parsed.error.message }], isError: true };
  return copyFromPrimary(config, parsed.data.namespace, parsed.data.keys, parsed.data.locales);
}
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/tools.ts src/server.ts tests/tools.test.ts
git commit -m "feat: add copy_from_primary tool"
```

---

## Task 6: Docs update

**Files:**
- Modify: `README.md`
- Modify: `skills/i18n-usage.md`

- [ ] **Step 1: Update README.md — add new tool sections**

In the `## Tools` section, add the following entries. Place `get_translation` and `get_namespace_keys` before `get_translations`. Place `check_translation_quality` after `find_untranslated_values`. Place `copy_from_primary` after `add_multiple_translations`.

````markdown
### `get_translation`

Returns translations for a single key across all locales. Faster than `get_translations` for targeted spot-checks.

```
get_translation("common", "button.save")
// → { "en": "Save", "de": "Speichern" }
```

### `get_namespace_keys`

Returns a sorted list of all dot-notation keys in a namespace without values. Use to plan batch translation work without loading full locale content.

```
get_namespace_keys("common")
// → ["button.cancel", "button.save", "title"]
```

### `check_translation_quality`

Check specific keys for quality issues: `untranslated` (value identical to primary), `empty` (missing or blank), `short` (< 30% of primary length for strings > 15 chars).

```
check_translation_quality("web", ["header.title", "onboarding.description"])
```

### `copy_from_primary`

Copy the primary locale value verbatim to specified locales. Use for brand names, units, and other terms that should not be translated.

```
copy_from_primary("common", ["brand.name", "unit.percent"], ["de", "fr"])
```
````

- [ ] **Step 2: Update `add_multiple_translations` docs in README.md**

Update the existing `add_multiple_translations` section to mention the locales filter:

```markdown
### `add_multiple_translations`

Batch version — one disk write per locale file regardless of entry count.

```
add_multiple_translations("common", [
  { key: "button.save",   translations: { en: "Save",   de: "Speichern" } },
  { key: "button.cancel", translations: { en: "Cancel", de: "Abbrechen" } }
])

// Optional locales filter — only write "de" even if other locales are provided:
add_multiple_translations("common", [...], ["de"])
```
```

- [ ] **Step 3: Update `skills/i18n-usage.md`**

Replace the `## 2. Search before adding` section with:

```markdown
## 2. Search before adding

Before adding any new key, check if a similar one already exists.

To look up a specific known key:
```
get_translation("namespace", "exact.key.path")
```

To search by key pattern or value substring:
```
get_translations("namespace", "your search term")
```

To see all keys in a namespace without loading values:
```
get_namespace_keys("namespace")
```
```

Replace the `## 5. Verify coverage before finishing` section with:

```markdown
## 5. Verify coverage before finishing

Run all three checks when done:

```
check_translation_integrity("namespace")
find_untranslated_values("namespace")
check_translation_quality("namespace", ["key.one", "key.two"])
```

- `check_translation_integrity` — missing or extra keys
- `find_untranslated_values` — keys present in every locale but still holding the primary value
- `check_translation_quality` — targeted check for untranslated, empty, or suspiciously short values on specific keys

For keys that legitimately shouldn't be translated (brand names, units, prices), use:
```
copy_from_primary("namespace", ["brand.name", "unit.percent"], ["de", "fr", "es"])
```
```

- [ ] **Step 4: Run tests one final time**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add README.md skills/i18n-usage.md
git commit -m "docs: document new tools and update i18n-usage workflow"
```

---

## Self-Review

**Spec coverage:**
1. `get_translation(namespace, key)` → Task 1 ✓
2. `check_translation_quality(namespace, keys[])` → Task 2 ✓
3. `get_namespace_keys(namespace)` → Task 3 ✓
4. `add_multiple_translations` locales filter → Task 4 ✓
5. `copy_from_primary(namespace, keys[], locales[])` → Task 5 ✓
6. Docs → Task 6 ✓

**Placeholder scan:** No TBDs, no "add appropriate error handling", all code blocks present. ✓

**Type consistency:**
- `QualityIssue` defined in Task 2 and used only in Task 2 ✓
- `copyFromPrimary` uses `setNestedValue` which returns `Record<string, unknown>` — assigned back to `data` typed the same ✓
- All function signatures match between tools.ts implementation and server.ts handler calls ✓
