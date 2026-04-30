# i18n MCP Design

**Date:** 2026-04-30  
**Status:** Approved

## Overview

A TypeScript MCP server that gives Claude structured access to i18n translation files in any project, including monorepos. Published to npm as `i18n-mcp`. Configuration lives in the user's project (not the package), so one server binary works across all projects.

Three deliverables in one repo:
1. The MCP server
2. A Claude Code setup skill (first-time wizard, runs once per project)
3. A Claude Code usage skill (guides translation workflows, used repeatedly)

---

## Architecture

### Config File

`.i18n-mcp.json` lives in the user's project root. The MCP server reads it from `cwd` at startup.

```json
{
  "primaryLocale": "en",
  "style": {
    "tone": "informal",
    "glossary": {
      "Robin": "Robin",
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

### File Structure Auto-Detection

Per namespace, the server detects one of two layouts on first access:

- **Flat:** `{path}/en.json`, `{path}/de.json`
- **Folder (i18next):** `{path}/en/translation.json`, `{path}/de/translation.json`

Detection is done by checking which pattern exists on first access. The detected mode is cached in memory for the process lifetime — it is structural metadata, not translation data, and does not change while the server is running.

### Internal Modules

| Module | Responsibility |
|---|---|
| `config.ts` | Read and validate `.i18n-mcp.json` from `cwd`. Fail fast with a clear error if missing or malformed. |
| `namespace.ts` | Resolve namespace name → path + file structure. Expose `readLocale` and `writeLocale` with atomic writes (temp file → rename). |
| `tools.ts` | Thin tool handler layer. Calls into `namespace.ts`. Input validation only — no business logic. |
| `server.ts` | Entry point. Declares `capabilities: { tools: {} }`, registers tools with `@modelcontextprotocol/sdk`, connects `StdioServerTransport`. |

---

## MCP Tools

All tools are scoped to a namespace by name. All use the MCP-native response format:

```ts
// Success
{ content: [{ type: "text", text: "..." }] }

// Error — isError: true makes it visible to Claude for self-correction
{ content: [{ type: "text", text: "Namespace 'foo' not found" }], isError: true }
```

Tool inputs are validated with **Zod** schemas. Validation errors return `isError: true` (not a JSON-RPC protocol error) so Claude can self-correct without crashing the call.

### `get_translations(namespace, query?)`

Returns all key-value pairs across all locales, structured as:
```json
{ "button.save": { "en": "Save", "de": "Speichern" } }
```

Optional `query` runs both filters simultaneously and returns the union:
- **Glob on keys:** `buttons.*` matches any key fitting the pattern
- **Substring on values:** matches any key where any locale value contains the text

Used for duplicate detection before adding new keys.

### `add_translation(namespace, key, translations)`

```ts
add_translation("common", "button.save", { en: "Save", de: "Speichern" })
```

Adds or updates a single key. Only writes the locales provided — no auto-fill, no side effects on other locales. Atomic write per locale file.

### `add_multiple_translations(namespace, entries)`

```ts
add_multiple_translations("common", [
  { key: "button.save", translations: { en: "Save", de: "Speichern" } },
  { key: "button.cancel", translations: { en: "Cancel", de: "Abbrechen" } }
])
```

Batch version. Single disk write per locale file regardless of entry count.

### `delete_translation(namespace, key)`

Removes a key from all locale files in the namespace.

### `check_translation_integrity(namespace?)`

Compares all locale files against `primaryLocale`. Returns:
- Missing keys per locale (in primary but absent elsewhere)
- Extra keys per locale (present but not in primary)
- Empty/null values in non-primary locales

If `namespace` is omitted, checks all configured namespaces.

---

## Claude Code Integration

### Setup Skill

Runs once per project. Steps:

1. Glob for `**/locales/**/*.json`, `**/i18n/**/*.json`, `**/translations/**/*.json`
2. Group findings by detected structure (flat vs folder) and infer namespace boundaries
3. Sample 20-30 existing translation values to detect:
   - Formality (e.g. "du" vs "Sie" in German)
   - Brand terms used untranslated across locales
4. Present findings for user confirmation — name, description, path, detected style
5. Write `.i18n-mcp.json` to project root
6. Add MCP server entry to the project's `.claude/settings.json` (not user-global)
7. Append CLAUDE.md snippet to the project's CLAUDE.md — create it if it doesn't exist

### Usage Skill

Guides Claude through translation work:
- Check integrity first before starting work
- Search for existing keys with `get_translations` before adding new ones
- Use `add_multiple_translations` for bulk additions
- Confirm locale coverage matches `primaryLocale` before finishing

### CLAUDE.md Snippet

Auto-appended by the setup skill. Example output:

```markdown
## i18n
Translations managed via i18n-mcp. Namespaces: common (shared UI), web (web app).
Primary locale: en. Tone: informal. Do not translate: Robin, COP.
Always check for duplicate keys with get_translations before adding new ones.
```

---

## Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Language | TypeScript | Official MCP SDK, faster iteration, sufficient performance for JSON I/O |
| Input validation | Zod | Official SDK pattern; validation errors return `isError: true` so Claude can self-correct |
| Transport | StdioServerTransport | Standard for file-based MCP servers |
| Format support | JSON only | YAGNI — covers all current use cases |
| Caching | No translation data cache (direct disk I/O) | Translation files are small; stale-data risk not worth the complexity. File structure mode is cached as immutable metadata. |
| File watching | None | Claude is the primary writer; watching adds chokidar complexity for no gain |
| Config location | User's project root | Shared across team, picked up automatically by `cwd` |
| Style config | Global (not per-namespace) | Tone and brand terms apply project-wide |
| Missing locale behavior | Write only what's provided | No silent auto-fill; caller is explicit about what they're adding |
