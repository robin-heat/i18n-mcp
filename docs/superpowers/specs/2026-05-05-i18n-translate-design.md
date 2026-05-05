# i18n-translate Design

**Goal:** Eliminate the slow translation patterns identified in production — self-review loops, sequential multi-call batching, and unguided agent orchestration — by improving the `i18n-usage` skill and adding a new `i18n-translate` skill for large-scale translation jobs.

**Scope:** Skill/prompt changes only. No MCP server code changes.

---

## Problem Summary

Large translation jobs were slow due to three root causes:

1. **Self-review loops** — agents spent time correcting their own output instead of submitting. Biggest single time sink.
2. **Sequential batching** — agents split `add_multiple_translations` into many small calls instead of one. Each call is a disk read-modify-write, so they had to be sequential.
3. **No scale threshold** — `i18n-usage` was used for both small edits and large 120-key / 7-locale jobs with no guidance to switch approaches.

---

## Changes to `skills/i18n-usage.md`

### New Step 0: Assess scale (before everything else)

> If the job involves **more than 20 keys OR more than 3 locales**, stop and use `/i18n-translate` instead. This workflow is for small targeted edits only.

### Addition to Step 3 (Add with all locales at once)

Add a callout block after the existing batch examples:

> **Translation discipline:**
> - Never self-review translations. Generate the value and submit immediately — self-review loops are the single biggest time cost and don't improve quality.
> - Always use `add_multiple_translations` for 2+ keys. Never split into multiple calls — each call is a disk read-modify-write and they must be sequential.

---

## New skill: `skills/i18n-translate.md`

For large translation jobs: more than 20 keys or more than 3 locales.

### Phase 1: Assess

Run both checks to understand the full scope:

```
find_untranslated_values("namespace")
get_namespace_keys("namespace")
```

This gives: which locales are behind, how many keys need translation, and the full key list. If scope is unclear (e.g. partial translations, mixed states), confirm with the user before proceeding.

### Phase 2: Load context

Read `.i18n-mcp.json` for:
- `primaryLocale` — source language
- `style.tone` — informal or formal
- `style.doNotTranslate` — terms to copy verbatim
- `style.glossary` — terms with fixed translations

Then pre-fetch all primary locale values:

```
get_translations("namespace")
```

Keep this data in context — it gets passed to every agent. Agents do not fetch their own data.

### Phase 3: Dispatch agents

Dispatch **one agent per locale**, all in parallel. Each agent receives a self-contained prompt filled from the template below. Do not dispatch multiple locales to the same agent.

**Agent prompt template:**

```
You are translating the [namespace] namespace into [locale] ([locale_name]).

Primary locale values ([primaryLocale]):
[JSON: { "key.path": "English value", ... }]

Style:
- Tone: [informal/formal]
- Do not translate (copy verbatim): [doNotTranslate list]
- Glossary: [term → translation pairs]

Instructions:
1. Translate every key. Output your translations as a JSON object: { "key.path": "translation" }
2. Do NOT self-review. Generate once and call add_multiple_translations immediately.
3. Call add_multiple_translations ONCE with all keys in a single call.
4. Report STATUS: DONE when done, STATUS: BLOCKED if something prevents completion.
```

**Handling agent results:**
- `STATUS: DONE` — mark locale complete, wait for remaining agents
- `STATUS: BLOCKED` — re-dispatch that locale with a more capable model or additional context
- After all agents complete, proceed to Phase 4

### Phase 4: Verify

Run both integrity checks:

```
check_translation_integrity("namespace")
find_untranslated_values("namespace")
```

If any keys are still missing or untranslated, use `check_translation_quality` on the specific keys and re-dispatch targeted fix agents for only the affected locale/key combinations. Do not re-run the full job.

---

## Skill file locations

| File | Action |
|---|---|
| `skills/i18n-usage.md` | Modify — add step 0 and translation discipline callout |
| `skills/i18n-translate.md` | Create new |
