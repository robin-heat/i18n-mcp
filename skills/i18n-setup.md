---
name: i18n-setup
description: Set up i18n-mcp for the current project. Auto-detects translation files, infers style settings from existing translations, writes .i18n-mcp.json, and configures Claude Code.
---

# i18n-mcp Project Setup

Run this once per project to configure i18n-mcp.

## Step 1: Detect translation files

Search for JSON translation files, excluding node_modules and .git:

```bash
find . -type f -name "*.json" \( -path "*/locales/*" -o -path "*/i18n/*" -o -path "*/translations/*" \) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/dist/*"
```

Group results by parent directory. For each unique directory, determine the file structure:
- **Flat:** files named like `en.json`, `de.json` directly in the folder
- **Folder (i18next):** subdirectories like `en/translation.json`, `de/translation.json`

Propose a namespace name from the directory path (e.g. `apps/web/locales` → `web`).

## Step 2: Sample existing translations for style detection

For each detected namespace, read up to 30 translation values from all locale files. Analyse:

- **Formality:** Does German use "du" or "Sie"? Does French use "tu" or "vous"?
- **Brand terms:** Which words appear identically across every locale (not translated)?
- **Do-not-translate terms:** Technical abbreviations, product names, acronyms

## Step 3: Present findings and ask for confirmation

Show a summary and ask the user to confirm or edit before writing anything:

> Found N namespace(s):
> - **[name]** — `[path]` ([structure], locales: [list])
>
> Detected style: [tone] tone, do not translate: [terms]
>
> Does this look right? You can rename namespaces, adjust descriptions, or update the style.

Wait for the user's response before proceeding.

## Step 4: Determine primary locale

Ask: "Which locale is the source of truth (primary locale)?" — default to `en` if an `en` locale file exists.

## Step 5: Write .i18n-mcp.json to project root

Write the confirmed configuration:

```json
{
  "primaryLocale": "en",
  "style": {
    "tone": "informal",
    "doNotTranslate": ["Robin"]
  },
  "namespaces": [
    {
      "name": "common",
      "description": "Shared UI strings",
      "path": "packages/ui/locales"
    }
  ]
}
```

## Step 6: Add MCP server to project .claude/settings.json

Read `.claude/settings.json` (create with `{}` if it does not exist). Add the MCP entry under `mcpServers`:

```json
{
  "mcpServers": {
    "i18n-mcp": {
      "command": "npx",
      "args": ["-y", "i18n-mcp@latest"]
    }
  }
}
```

## Step 7: Append CLAUDE.md snippet

Append to the project's `CLAUDE.md` (create the file if it does not exist):

```markdown
## i18n

Translations managed via i18n-mcp.
Namespaces: [list each name and description].
Primary locale: [primaryLocale]. Tone: [tone]. Do not translate: [doNotTranslate list].
Always call `get_translations` with a relevant query before adding new keys to check for duplicates.
```

## Done

Tell the user: "Setup complete. Restart Claude Code to load the i18n-mcp server. Use the `i18n-usage` skill when working with translations."
