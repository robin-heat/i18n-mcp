import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Config } from '../src/config.js';
import { clearStructureCache } from '../src/namespace.js';
import { addMultipleTranslations, addTranslation, checkTranslationIntegrity, checkTranslationQuality, deleteTranslation, findUntranslatedValues, getTranslation, getTranslations } from '../src/tools.js';

let tmpDir: string;
let config: Config;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'i18n-mcp-tools-test-'));
  clearStructureCache();
  writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({
    button: { save: 'Save', cancel: 'Cancel' },
    title: 'Hello',
  }));
  writeFileSync(join(tmpDir, 'de.json'), JSON.stringify({
    button: { save: 'Speichern', cancel: 'Abbrechen' },
    title: 'Hallo',
  }));
  config = {
    primaryLocale: 'en',
    namespaces: [{ name: 'common', description: 'Shared', path: tmpDir }],
  };
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('getTranslations', () => {
  it('returns all keys with translations across all locales', () => {
    const result = getTranslations(config, 'common');
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data['button.save']).toEqual({ en: 'Save', de: 'Speichern' });
    expect(data['button.cancel']).toEqual({ en: 'Cancel', de: 'Abbrechen' });
    expect(data['title']).toEqual({ en: 'Hello', de: 'Hallo' });
  });

  it('filters by glob pattern on keys', () => {
    const result = getTranslations(config, 'common', 'button.*');
    const data = JSON.parse(result.content[0].text);
    expect(Object.keys(data)).toEqual(expect.arrayContaining(['button.save', 'button.cancel']));
    expect(data['title']).toBeUndefined();
  });

  it('filters by substring match on values', () => {
    const result = getTranslations(config, 'common', 'Speichern');
    const data = JSON.parse(result.content[0].text);
    expect(data['button.save']).toBeDefined();
    expect(data['button.cancel']).toBeUndefined();
  });

  it('returns isError for unknown namespace', () => {
    const result = getTranslations(config, 'unknown');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("'unknown'");
  });
});

describe('getTranslation', () => {
  it('returns translations for a key across all locales', () => {
    const result = getTranslation(config, 'common', 'button.save');
    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual({ en: 'Save', de: 'Speichern' });
  });

  it('returns only locales where the key exists', () => {
    addTranslation(config, 'common', 'en.only', { en: 'English only' });
    const result = getTranslation(config, 'common', 'en.only');
    const data = JSON.parse(result.content[0].text);
    expect(data).toEqual({ en: 'English only' });
    expect(data.de).toBeUndefined();
  });

  it('returns not-found message when key does not exist', () => {
    const result = getTranslation(config, 'common', 'nonexistent.key');
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('not found');
    expect(() => JSON.parse(result.content[0].text)).toThrow();
  });

  it('returns isError for unknown namespace', () => {
    const result = getTranslation(config, 'unknown', 'button.save');
    expect(result.isError).toBe(true);
  });
});

describe('addTranslation', () => {
  it('adds a new top-level key to specified locales', () => {
    addTranslation(config, 'common', 'greeting', { en: 'Hi', de: 'Hallo' });
    const result = getTranslations(config, 'common', 'greeting');
    const data = JSON.parse(result.content[0].text);
    expect(data['greeting']).toEqual({ en: 'Hi', de: 'Hallo' });
  });

  it('adds a nested key using dot notation', () => {
    addTranslation(config, 'common', 'nav.home', { en: 'Home', de: 'Start' });
    const result = getTranslations(config, 'common', 'nav.*');
    const data = JSON.parse(result.content[0].text);
    expect(data['nav.home']).toEqual({ en: 'Home', de: 'Start' });
  });

  it('updates an existing key without touching other keys', () => {
    addTranslation(config, 'common', 'title', { en: 'Updated' });
    const result = getTranslations(config, 'common');
    const data = JSON.parse(result.content[0].text);
    expect(data['title']['en']).toBe('Updated');
    expect(data['button.save']['en']).toBe('Save');
  });

  it('only writes provided locales, leaving others unchanged', () => {
    addTranslation(config, 'common', 'new.key', { en: 'English only' });
    const result = getTranslations(config, 'common', 'new.key');
    const data = JSON.parse(result.content[0].text);
    expect(data['new.key']['en']).toBe('English only');
    expect(data['new.key']['de']).toBeUndefined();
  });

  it('returns isError for unknown namespace', () => {
    const result = addTranslation(config, 'unknown', 'key', { en: 'val' });
    expect(result.isError).toBe(true);
  });
});

describe('addMultipleTranslations', () => {
  it('adds multiple keys in one operation', () => {
    addMultipleTranslations(config, 'common', [
      { key: 'form.submit', translations: { en: 'Submit', de: 'Absenden' } },
      { key: 'form.reset', translations: { en: 'Reset', de: 'Zurücksetzen' } },
    ]);
    const result = getTranslations(config, 'common', 'form.*');
    const data = JSON.parse(result.content[0].text);
    expect(data['form.submit']).toEqual({ en: 'Submit', de: 'Absenden' });
    expect(data['form.reset']).toEqual({ en: 'Reset', de: 'Zurücksetzen' });
  });

  it('both keys exist after single batch write', () => {
    addMultipleTranslations(config, 'common', [
      { key: 'a', translations: { en: 'A' } },
      { key: 'b', translations: { en: 'B' } },
    ]);
    const result = getTranslations(config, 'common');
    const data = JSON.parse(result.content[0].text);
    expect(data['a']['en']).toBe('A');
    expect(data['b']['en']).toBe('B');
  });

  it('returns isError for unknown namespace', () => {
    const result = addMultipleTranslations(config, 'unknown', [
      { key: 'k', translations: { en: 'v' } },
    ]);
    expect(result.isError).toBe(true);
  });
});

describe('deleteTranslation', () => {
  it('removes a key from all locale files', () => {
    deleteTranslation(config, 'common', 'title');
    const result = getTranslations(config, 'common');
    const data = JSON.parse(result.content[0].text);
    expect(data['title']).toBeUndefined();
  });

  it('removes a nested key from all locale files', () => {
    deleteTranslation(config, 'common', 'button.save');
    const result = getTranslations(config, 'common');
    const data = JSON.parse(result.content[0].text);
    expect(data['button.save']).toBeUndefined();
    expect(data['button.cancel']).toBeDefined();
  });

  it('reports nothing deleted when key does not exist', () => {
    const result = deleteTranslation(config, 'common', 'nonexistent.key');
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('not found');
  });

  it('returns isError for unknown namespace', () => {
    const result = deleteTranslation(config, 'unknown', 'key');
    expect(result.isError).toBe(true);
  });
});

describe('checkTranslationIntegrity', () => {
  it('returns no issues for a complete namespace', () => {
    const result = checkTranslationIntegrity(config, 'common');
    const report = JSON.parse(result.content[0].text);
    expect(report['common'].missingKeys).toEqual({});
    expect(report['common'].extraKeys).toEqual({});
    expect(report['common'].emptyValues).toEqual({});
  });

  it('detects missing keys in non-primary locales', () => {
    addTranslation(config, 'common', 'new.key', { en: 'English only' });
    const result = checkTranslationIntegrity(config, 'common');
    const report = JSON.parse(result.content[0].text);
    expect(report['common'].missingKeys['de']).toContain('new.key');
  });

  it('detects empty values in non-primary locales', () => {
    addTranslation(config, 'common', 'empty.key', { en: 'Has value', de: '' });
    const result = checkTranslationIntegrity(config, 'common');
    const report = JSON.parse(result.content[0].text);
    expect(report['common'].emptyValues['de']).toContain('empty.key');
  });

  it('checks all namespaces when namespace is omitted', () => {
    const result = checkTranslationIntegrity(config);
    const report = JSON.parse(result.content[0].text);
    expect(report['common']).toBeDefined();
  });

  it('returns isError for unknown namespace', () => {
    const result = checkTranslationIntegrity(config, 'unknown');
    expect(result.isError).toBe(true);
  });
});

describe('checkTranslationQuality', () => {
  it('returns clean message for fully translated keys', () => {
    const result = checkTranslationQuality(config, 'common', ['button.save', 'title']);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('All specified keys look good.');
  });

  it('flags untranslated values (identical to primary)', () => {
    addTranslation(config, 'common', 'brand', { en: 'Robin', de: 'Robin' });
    const result = checkTranslationQuality(config, 'common', ['brand']);
    const data = JSON.parse(result.content[0].text);
    expect(data['brand']['de'].issue).toBe('untranslated');
    expect(data['brand']['de'].value).toBe('Robin');
    expect(data['brand']['de'].primaryValue).toBe('Robin');
  });

  it('flags empty values', () => {
    addTranslation(config, 'common', 'empty.key', { en: 'Has value', de: '' });
    const result = checkTranslationQuality(config, 'common', ['empty.key']);
    const data = JSON.parse(result.content[0].text);
    expect(data['empty.key']['de'].issue).toBe('empty');
  });

  it('flags missing values as empty', () => {
    addTranslation(config, 'common', 'missing.in.de', { en: 'Only English' });
    const result = checkTranslationQuality(config, 'common', ['missing.in.de']);
    const data = JSON.parse(result.content[0].text);
    expect(data['missing.in.de']['de'].issue).toBe('empty');
  });

  it('flags suspiciously short translations', () => {
    addTranslation(config, 'common', 'long.text', {
      en: 'This is a very long English description text',
      de: 'Kurz',
    });
    const result = checkTranslationQuality(config, 'common', ['long.text']);
    const data = JSON.parse(result.content[0].text);
    expect(data['long.text']['de'].issue).toBe('short');
    expect(data['long.text']['de'].primaryValue).toBe('This is a very long English description text');
  });

  it('does not flag short primary values for length ratio', () => {
    addTranslation(config, 'common', 'word', { en: 'Yes', de: 'Ja' });
    const result = checkTranslationQuality(config, 'common', ['word']);
    expect(result.content[0].text).toBe('All specified keys look good.');
  });

  it('skips keys not found in primary locale', () => {
    const result = checkTranslationQuality(config, 'common', ['nonexistent.key']);
    expect(result.content[0].text).toBe('All specified keys look good.');
  });

  it('does not flag values listed in doNotTranslate', () => {
    addTranslation(config, 'common', 'brand', { en: 'Robin', de: 'Robin' });
    const configWithDoNotTranslate: Config = {
      ...config,
      style: { doNotTranslate: ['Robin'] },
    };
    const result = checkTranslationQuality(configWithDoNotTranslate, 'common', ['brand']);
    expect(result.content[0].text).toBe('All specified keys look good.');
  });

  it('returns isError for unknown namespace', () => {
    const result = checkTranslationQuality(config, 'unknown', ['button.save']);
    expect(result.isError).toBe(true);
  });
});
