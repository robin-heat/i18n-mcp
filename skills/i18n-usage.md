---
name: i18n-usage
description: Guide Claude through translation workflows using i18n-mcp tools. Use at the start of any translation task to ensure correct tool usage order and complete locale coverage.
---

# i18n Translation Workflow

Follow these steps whenever working with translations.

## 1. Check integrity first

Before touching any translations, understand the current state:

```
check_translation_integrity()
```

Note any missing keys, extra keys, or empty values — these give context for the work ahead and reveal debt to address.

## 2. Search before adding

Before adding any new key, check if a similar one already exists:

```
get_translations("namespace", "your search term")
```

Use a glob if you know the key structure (`button.*`), or a plain word to search across all locale values (`"save"`).

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

Run both checks when done:

```
check_translation_integrity("namespace")
find_untranslated_values("namespace")
```

`check_translation_integrity` catches missing or extra keys. `find_untranslated_values` catches keys that exist in every locale but still hold the primary locale's value — placeholder translations that were never actually translated. Fix any issues before finishing.
