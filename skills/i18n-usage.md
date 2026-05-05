---
name: i18n-usage
description: Guide Claude through translation workflows using i18n-mcp tools. Use at the start of any translation task to ensure correct tool usage order and complete locale coverage.
---

# i18n Translation Workflow

Follow these steps whenever working with translations.

## 0. Check scale first

If this job involves **more than 20 keys OR more than 3 locales**, stop here and use `/i18n-translate` instead. This workflow is for small targeted edits only.

## 1. Check integrity first

Before touching any translations, understand the current state:

```
check_translation_integrity()
```

Note any missing keys, extra keys, or empty values — these give context for the work ahead and reveal debt to address.

## 2. Search before adding

Before adding any new key, check if a similar one already exists.

To look up a specific known key:
```
get_translation("namespace", "exact.key.path")
```

To see all keys in a namespace without loading values (useful for planning batch work):
```
get_namespace_keys("namespace")
```

To search by key pattern or value substring:
```
get_translations("namespace", "your search term")
```

## 3. Add with all locales at once

Never add a key for just one locale — always include all configured locales in one call:

```
add_translation("namespace", "dotted.key.path", {
  en: "English text",
  de: "German text",
  // all other locales from .i18n-mcp.json
})
```

For multiple keys, batch them:

```
add_multiple_translations("namespace", [
  { key: "key.one", translations: { en: "...", de: "..." } },
  { key: "key.two", translations: { en: "...", de: "..." } }
])
```

**Translation discipline:**
- Never self-review translations. Generate the value and submit immediately — self-review loops are the single biggest time cost and don't improve quality.
- Always use `add_multiple_translations` for 2+ keys. Never split into multiple calls — each call is a disk read-modify-write and they must be sequential.

## Arrays

JSON arrays are not supported as leaf values. Use indexed dot-keys instead:

```json
{ "steps": { "0": "First", "1": "Second", "2": "Third" } }
```

Add and query them like any other key — `steps.0`, `steps.1`, etc. Use `get_translations("namespace", "steps.*")` to fetch all elements at once.

## 4. Follow the project style

Read `.i18n-mcp.json` and CLAUDE.md for:
- **Tone** (informal/formal) — use the right register in every locale
- **doNotTranslate** — never translate these terms, copy them verbatim
- **Glossary** — use the defined translations for glossary terms

## 5. Verify coverage before finishing

Run these checks when done:

```
check_translation_integrity("namespace")
find_untranslated_values("namespace")
check_translation_quality("namespace", ["key.one", "key.two"])
```

- `check_translation_integrity` — missing or extra keys
- `find_untranslated_values` — keys that exist in every locale but still hold the primary value
- `check_translation_quality` — targeted check for untranslated, empty, or suspiciously short values on specific keys

For keys that legitimately should not be translated (brand names, units, prices), copy the primary value verbatim:
```
copy_from_primary("namespace", ["brand.name", "unit.percent"], ["de", "fr", "es"])
```
