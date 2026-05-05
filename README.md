# i18n-mcp

[![npm](https://img.shields.io/npm/v/@robinheat/i18n-mcp)](https://www.npmjs.com/package/@robinheat/i18n-mcp)

> **Vibe coded project** — built fast, works well, but may have rough edges. Missing a feature or hit a bug? [Open an issue](https://github.com/robinheat/i18n-mcp/issues) — contributions welcome.

MCP server for managing i18n JSON translation files. Gives Claude structured read/write access to your translation files — add keys, check coverage, find duplicates — without ever leaving your editor.

Works with monorepos. Supports both flat (`en.json`) and i18next folder (`en/translation.json`) structures, auto-detected per namespace.

## Quick Start

Run this once in your project root:

```bash
npx @robinheat/i18n-mcp install
```

This installs the Claude Code skills and adds the MCP server to your project's `.claude/settings.json`. Then:

1. **Restart Claude Code**
2. **Run `/i18n-setup`** — auto-detects your translation files, infers tone and brand terms, writes `.i18n-mcp.json`

## Configuration

`.i18n-mcp.json` lives in your project root:

```json
{
  "primaryLocale": "en",
  "style": {
    "tone": "informal",
    "glossary": {
      "Wärmepumpe": "heat pump"
    },
    "doNotTranslate": ["Robin", "COP"]
  },
  "namespaces": [
    {
      "name": "common",
      "description": "Shared UI strings",
      "path": "packages/ui/locales"
    },
    {
      "name": "web",
      "description": "Web app strings",
      "path": "apps/web/locales"
    }
  ]
}
```

| Field | Required | Description |
|---|---|---|
| `primaryLocale` | Yes | Source-of-truth locale (used for integrity checks) |
| `namespaces` | Yes | Array of namespace definitions |
| `namespaces[].name` | Yes | Short name used in tool calls |
| `namespaces[].description` | Yes | Helps Claude choose the right namespace |
| `namespaces[].path` | Yes | Path to locale directory, relative to project root |
| `style.tone` | No | `"informal"` or `"formal"` |
| `style.glossary` | No | Terms with fixed translations |
| `style.doNotTranslate` | No | Terms that should never be translated |

## File Structure Support

Both layouts are auto-detected per namespace:

**Flat:**
```
locales/
  en.json
  de.json
  fr.json
```

**i18next folder style:**
```
locales/
  en/
    translation.json
  de/
    translation.json
```

## Tools

All tools are available to Claude once the MCP server is running.

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

### `get_translations`

Returns all keys for a namespace as `{ "key.path": { "en": "...", "de": "..." } }`.

```
get_translations("common")
get_translations("common", "button.*")      // glob filter on keys
get_translations("common", "save")          // substring filter on values
```

### `add_translation`

Adds or updates a single key. Only the provided locales are written.

```
add_translation("common", "button.save", {
  en: "Save",
  de: "Speichern",
  fr: "Enregistrer"
})
```

### `add_multiple_translations`

Batch version — one disk write per locale file regardless of entry count.

```
add_multiple_translations("common", [
  { key: "button.save",   translations: { en: "Save",   de: "Speichern" } },
  { key: "button.cancel", translations: { en: "Cancel", de: "Abbrechen" } }
])

// Only write "de" even if other locales are provided:
add_multiple_translations("common", [...], ["de"])
```

### `delete_translation`

Removes a key from all locale files in a namespace.

```
delete_translation("common", "button.save")
```

### `find_untranslated_values`

Finds keys where the translated value is identical to the primary locale — placeholder translations that were never actually translated. Terms in `doNotTranslate` are excluded.

```
find_untranslated_values("web")           // all non-primary locales
find_untranslated_values("web", "de")     // one locale
```

Returns `{ locale: { key: primaryValue } }` for each stale entry found.

### `check_translation_quality`

Checks specific keys for quality issues across all non-primary locales. Returns issues per locale per key: `untranslated` (value identical to primary), `empty` (missing or blank), `short` (< 30% of primary value length for strings longer than 15 chars). Terms in `doNotTranslate` are excluded from the `untranslated` check.

```
check_translation_quality("web", ["header.title", "onboarding.description"])
```

### `copy_from_primary`

Copies the primary locale value verbatim to specified locales for specified keys. Use for brand names, units, prices, and other terms that should not be translated. Returns an error if any key is missing from the primary locale.

```
copy_from_primary("common", ["brand.name", "unit.percent"], ["de", "fr"])
```

### `check_translation_integrity`

Compares all locales against `primaryLocale`. Returns missing keys, extra keys, and empty values per locale.

```
check_translation_integrity()           // check all namespaces
check_translation_integrity("common")   // check one namespace
```

## Array Values

JSON arrays are not supported as leaf values. Use **indexed dot-keys** instead — this is what i18next expects when you call `t('key', { returnObjects: true })` anyway.

**In your translation file:**
```json
{
  "steps": {
    "0": "Connect your device",
    "1": "Open the app",
    "2": "Follow the setup guide"
  }
}
```

**Adding via tools:**
```
add_multiple_translations("common", [
  { key: "steps.0", translations: { en: "Connect your device", de: "Gerät verbinden" } },
  { key: "steps.1", translations: { en: "Open the app",        de: "App öffnen" } },
  { key: "steps.2", translations: { en: "Follow the setup guide", de: "Setup-Anleitung folgen" } }
])
```

**Reading via tools:**
```
get_translations("common", "steps.*")
```

Integrity checks and missing-key detection work the same as for any other key.

## Usage Skill

For best results, use the `i18n-usage` skill at the start of translation work:

```
/i18n-usage
```

It guides Claude to check integrity first, search before adding, always add all locales at once, and verify coverage when done.

## Manual Installation (without npm)

Add the server to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "i18n-mcp": {
      "command": "npx",
      "args": ["-y", "@robinheat/i18n-mcp@latest"]
    }
  }
}
```

Then create `.i18n-mcp.json` in your project root manually.

## Development

```bash
npm test          # run tests (85 tests)
npm run build     # compile to dist/
npm run dev       # run server directly with tsx (needs .i18n-mcp.json in cwd)
```

## License

MIT
