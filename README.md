# i18n-mcp

MCP server for managing i18n JSON translation files. Gives Claude structured read/write access to your translation files — add keys, check coverage, find duplicates — without ever leaving your editor.

Works with monorepos. Supports both flat (`en.json`) and i18next folder (`en/translation.json`) structures, auto-detected per namespace.

## Quick Start

### 1. Install the setup skill

Copy `skills/i18n-setup.md` to your Claude Code plugins directory:

```bash
mkdir -p ~/.claude/plugins/i18n-mcp/skills
cp node_modules/i18n-mcp/skills/*.md ~/.claude/plugins/i18n-mcp/skills/
```

Or manually download from this repo.

### 2. Run setup in your project

Open Claude Code in your project and run:

```
/i18n-setup
```

The skill will:
- Auto-detect your translation files
- Sample existing translations to infer tone and brand terms
- Ask you to confirm the detected configuration
- Write `.i18n-mcp.json` to your project root
- Add the MCP server to `.claude/settings.json`
- Append a context snippet to your `CLAUDE.md`

### 3. Restart Claude Code

The MCP server starts automatically on next launch.

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
```

### `delete_translation`

Removes a key from all locale files in a namespace.

```
delete_translation("common", "button.save")
```

### `check_translation_integrity`

Compares all locales against `primaryLocale`. Returns missing keys, extra keys, and empty values per locale.

```
check_translation_integrity()           // check all namespaces
check_translation_integrity("common")   // check one namespace
```

## Usage Skill

For best results, use the `i18n-usage` skill at the start of translation work:

```
/i18n-usage
```

It guides Claude to check integrity first, search before adding, always add all locales at once, and verify coverage when done.

## Manual Installation (without npm)

Add the server to your project's `.claude/settings.json`:

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
npm test          # run tests (59 tests)
npm run build     # compile to dist/
npm run dev       # run server directly with tsx (needs .i18n-mcp.json in cwd)
```

## License

MIT
