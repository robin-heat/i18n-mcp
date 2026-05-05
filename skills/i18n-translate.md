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
