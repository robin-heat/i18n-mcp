# i18n-translate Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `/i18n-translate` skill for large-scale parallel translation jobs and update `i18n-usage` with scale guardrails and translation discipline rules.

**Architecture:** Pure markdown/skill file changes plus a one-line addition to `src/install.ts` to register the new skill for `npx install`. No MCP tool changes. Three tasks: update i18n-usage, create i18n-translate, wire up install + docs.

**Tech Stack:** Markdown skill files, TypeScript (install.ts only)

---

## File Map

| File | Action |
|---|---|
| `skills/i18n-usage.md` | Modify — add step 0 (scale check) + translation discipline callout in step 3 |
| `skills/i18n-translate.md` | Create — new skill for large translation jobs |
| `src/install.ts` | Modify — register `i18n-translate` skill in install array |
| `skills/i18n-setup.md` | Modify — mention `i18n-translate` in Done message |
| `README.md` | Modify — mention `i18n-translate` in Usage Skill section |

---

## Task 1: Update `skills/i18n-usage.md`

**Files:**
- Modify: `skills/i18n-usage.md`

- [ ] **Step 1: Add step 0 — scale check**

Insert this block at the top of the skill body, immediately after the line `Follow these steps whenever working with translations.`:

```markdown
## 0. Check scale first

If this job involves **more than 20 keys OR more than 3 locales**, stop here and use `/i18n-translate` instead. This workflow is for small targeted edits only.
```

The file should now open with:
```markdown
# i18n Translation Workflow

Follow these steps whenever working with translations.

## 0. Check scale first

If this job involves **more than 20 keys OR more than 3 locales**, stop here and use `/i18n-translate` instead. This workflow is for small targeted edits only.

## 1. Check integrity first
...
```

- [ ] **Step 2: Add translation discipline callout to step 3**

After the `add_multiple_translations` example in `## 3. Add with all locales at once`, add:

```markdown
**Translation discipline:**
- Never self-review translations. Generate the value and submit immediately — self-review loops are the single biggest time cost and don't improve quality.
- Always use `add_multiple_translations` for 2+ keys. Never split into multiple calls — each call is a disk read-modify-write and they must be sequential.
```

The complete `## 3` section should look like:

```markdown
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
```

- [ ] **Step 3: Verify the file looks right**

```bash
cat skills/i18n-usage.md
```

Confirm:
- `## 0. Check scale first` appears before `## 1. Check integrity first`
- Translation discipline block appears inside `## 3`
- No other sections changed

- [ ] **Step 4: Commit**

```bash
git add skills/i18n-usage.md
git commit -m "feat: add scale guardrail and translation discipline to i18n-usage skill"
```

---

## Task 2: Create `skills/i18n-translate.md`

**Files:**
- Create: `skills/i18n-translate.md`

- [ ] **Step 1: Create the file**

Create `skills/i18n-translate.md` with this exact content:

```markdown
---
name: i18n-translate
description: Orchestrate large-scale translation jobs using parallel agents — one per locale. Use when translating more than 20 keys or more than 3 locales. Faster and more reliable than inline translation in i18n-usage.
---

# i18n Large-Scale Translation

Use this skill when translating more than 20 keys or more than 3 locales. It dispatches one agent per locale in parallel — each agent translates and writes its own locale file independently.

## Phase 1: Assess scope

Run both checks to understand what needs translating:

```
find_untranslated_values("namespace")
get_namespace_keys("namespace")
```

This gives you: which locales are behind, how many keys need translation, and the full key list. If the scope is unclear (partial translations, mixed states across locales), confirm with the user before proceeding.

## Phase 2: Load context

Read `.i18n-mcp.json` for:
- `primaryLocale` — source language
- `style.tone` — informal or formal
- `style.doNotTranslate` — terms to copy verbatim
- `style.glossary` — terms with fixed translations

Then pre-fetch all primary locale values — you will pass these to every agent so they never need to fetch data themselves:

```
get_translations("namespace")
```

## Phase 3: Dispatch agents

Dispatch **one agent per locale**, all in parallel. Use the prompt template below — fill in the variables and send. Do not batch multiple locales into the same agent.

**Agent prompt template:**

```
You are translating the [namespace] namespace into [locale] ([locale_name]).

Primary locale values ([primaryLocale]):
[paste the JSON output from get_translations here: { "key.path": "source value", ... }]

Style:
- Tone: [informal / formal]
- Do not translate — copy verbatim: [doNotTranslate list, or "none"]
- Glossary: [term → translation pairs, or "none"]

Instructions:
1. Translate every key listed above into [locale_name].
2. Do NOT self-review. Generate your translations once and call add_multiple_translations immediately.
3. Call add_multiple_translations ONCE with all keys in a single call:
   add_multiple_translations("[namespace]", [
     { key: "key.path", translations: { "[locale]": "translation" } },
     ...
   ])
4. Report STATUS: DONE when the write is complete, STATUS: BLOCKED if something prevents completion.
```

**Handling agent results:**
- `STATUS: DONE` — mark that locale complete, wait for remaining agents
- `STATUS: BLOCKED` — re-dispatch that locale with more context or a more capable model

## Phase 4: Verify

After all agents report done, run:

```
check_translation_integrity("namespace")
find_untranslated_values("namespace")
```

If any keys are still missing or untranslated, use `check_translation_quality` on the specific keys:

```
check_translation_quality("namespace", ["key.one", "key.two"])
```

Then re-dispatch targeted fix agents for only the affected locale/key combinations. Do not re-run the full job.
```

- [ ] **Step 2: Verify the file was created correctly**

```bash
cat skills/i18n-translate.md
```

Confirm:
- Frontmatter block with `name: i18n-translate` is present
- All 4 phases are present: Assess, Load context, Dispatch agents, Verify
- Agent prompt template includes the `STATUS: DONE / STATUS: BLOCKED` reporting instructions
- `do_not_translate` and glossary handling mentioned in template

- [ ] **Step 3: Commit**

```bash
git add skills/i18n-translate.md
git commit -m "feat: add i18n-translate skill for parallel large-scale translation"
```

---

## Task 3: Wire up install, i18n-setup, and README

**Files:**
- Modify: `src/install.ts:19-22`
- Modify: `skills/i18n-setup.md:132`
- Modify: `README.md` (Usage Skill section)

- [ ] **Step 1: Register the new skill in `src/install.ts`**

In `src/install.ts`, find the skill registration array (lines 19–22):

```typescript
  for (const [name, file] of [
    ['i18n-setup', 'i18n-setup.md'],
    ['i18n-usage', 'i18n-usage.md'],
  ]) {
```

Replace with:

```typescript
  for (const [name, file] of [
    ['i18n-setup', 'i18n-setup.md'],
    ['i18n-usage', 'i18n-usage.md'],
    ['i18n-translate', 'i18n-translate.md'],
  ]) {
```

- [ ] **Step 2: Update the Done message in `skills/i18n-setup.md`**

Find line 132:
```markdown
Tell the user: "Setup complete. Restart Claude Code to load the i18n-mcp server. Use the `i18n-usage` skill when working with translations."
```

Replace with:
```markdown
Tell the user: "Setup complete. Restart Claude Code to load the i18n-mcp server. Use the `i18n-usage` skill for day-to-day translation work, or `/i18n-translate` for large jobs (20+ keys or 3+ locales)."
```

- [ ] **Step 3: Update the Usage Skill section in `README.md`**

Find:
```markdown
## Usage Skill

For best results, use the `i18n-usage` skill at the start of translation work:

```
/i18n-usage
```

It guides Claude to check integrity first, search before adding, always add all locales at once, and verify coverage when done.
```

Replace with:
```markdown
## Usage Skills

**For day-to-day work** (small edits, targeted key additions):

```
/i18n-usage
```

Guides Claude to check integrity first, search before adding, always add all locales at once, and verify coverage when done.

**For large translation jobs** (20+ keys or 3+ locales):

```
/i18n-translate
```

Orchestrates parallel agents — one per locale — so large jobs run faster without self-review loops or sequential batching.
```

- [ ] **Step 4: Build to verify TypeScript compiles**

```bash
npm run build 2>&1
```

Expected: clean build, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/install.ts skills/i18n-setup.md README.md
git commit -m "feat: register i18n-translate in install, update docs"
```

- [ ] **Step 6: Push**

```bash
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Step 0 scale check in i18n-usage → Task 1 Step 1
- ✅ Translation discipline callout in step 3 → Task 1 Step 2
- ✅ New i18n-translate skill with all 4 phases → Task 2
- ✅ Registered in install.ts → Task 3 Step 1
- ✅ Docs updated → Task 3 Steps 2–3

**Placeholder scan:** No TBDs. All content is complete. Agent template variables are clearly marked with `[brackets]` as intended fill-in points, not placeholders.

**Type consistency:** Only one TypeScript change — adding one string literal to an array. No type concerns.
