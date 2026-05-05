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

## Step 2: Check documentation for explicit style guidance

Before analysing translations, look for explicit style guidance in the project:

- Read `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `docs/style-guide.md` (whichever exist)
- Search for i18n config files: `i18n.config.*`, `i18next.config.*`, `lingui.config.*`
- Check any `docs/` or `.github/` folder for tone/style mentions

If any document explicitly states the tone (e.g. "use informal language", "address users as Sie"), use that — it overrides translation-based inference.

## Step 3: Analyse ALL translations for style detection

Read **every value** across all locale files (not just a sample). For each locale, count explicit formality markers:

**German formality markers:**
- Informal signals: `du`, `dich`, `dir`, `dein`, `deine`, `deinen`, `deinem`, `deiner`
- Formal signals: `Sie`, `Ihnen`, `Ihr`, `Ihre`, `Ihren`, `Ihrem`, `Ihrer`

**French formality markers:**
- Informal signals: `tu`, `toi`, `te`, `ton`, `ta`, `tes`
- Formal signals: `vous`, `votre`, `vos`

**Spanish formality markers:**
- Informal signals: `tú`, `ti`, `te`, `tu `, `tus`
- Formal signals: `usted`, `le`, `su `, `sus`

Count occurrences of each signal across all values (case-insensitive, whole-word match). The side with more signals wins. If counts are equal or both zero, default to **informal** and flag it as uncertain.

**Brand terms:** Find words that appear identically (untranslated) across every locale for the same key. These are candidates for `doNotTranslate`.

**Dispatch two independent subagents** to analyse the translations and reconcile their findings:
- Subagent A: analyse the German locale (if present)
- Subagent B: analyse the French or Spanish locale (if present), or a second pass of German

If both agree → use that result confidently. If they disagree → flag as uncertain and ask the user.

## Step 4: Present findings and ask for confirmation

Show a summary including the evidence behind tone detection, and ask the user to confirm or edit before writing anything:

> Found N namespace(s):
> - **[name]** — `[path]` ([structure], locales: [list])
>
> Detected style: **[informal/formal/uncertain]** tone
> Evidence: [e.g. "47 informal signals (du/dich/dir) vs 2 formal (Sie) in DE locale"] or [e.g. "stated in CLAUDE.md"]
> Do not translate: [terms]
>
> Does this look right? You can correct the tone, adjust namespace names/descriptions, or update the do-not-translate list.

If tone was **uncertain**, explicitly ask: "We couldn't confidently detect the tone — should translations use informal (du) or formal (Sie) language?"

Wait for the user's response before proceeding.

## Step 5: Determine primary locale

Ask: "Which locale is the source of truth (primary locale)?" — default to `en` if an `en` locale file exists.

## Step 6: Write .i18n-mcp.json to project root

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

## Step 7: Add MCP server to project .mcp.json

Read `.mcp.json` in the project root (create with `{}` if it does not exist). Add the MCP entry under `mcpServers`:

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

## Step 8: Append CLAUDE.md snippet

Append to the project's `CLAUDE.md` (create the file if it does not exist):

```markdown
## i18n

Translations managed via i18n-mcp.
Namespaces: [list each name and description].
Primary locale: [primaryLocale]. Tone: [tone]. Do not translate: [doNotTranslate list].
Always call `get_translations` with a relevant query before adding new keys to check for duplicates.
```

## Done

Tell the user: "Setup complete. Restart Claude Code to load the i18n-mcp server. Use the `i18n-usage` skill for day-to-day translation work, or `/i18n-translate` for large jobs (20+ keys or 3+ locales)."
