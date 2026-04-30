import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearStructureCache,
  detectStructure,
  listLocales,
  readLocale,
  writeLocale,
} from '../src/namespace.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'i18n-mcp-ns-test-'));
  clearStructureCache();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('detectStructure', () => {
  it('detects folder structure when locale/translation.json exists', () => {
    mkdirSync(join(tmpDir, 'en'));
    writeFileSync(join(tmpDir, 'en', 'translation.json'), '{}');
    expect(detectStructure(tmpDir, 'en')).toBe('folder');
  });

  it('defaults to flat when neither pattern exists', () => {
    expect(detectStructure(tmpDir, 'en')).toBe('flat');
  });

  it('detects flat when en.json exists but no folder', () => {
    writeFileSync(join(tmpDir, 'en.json'), '{}');
    expect(detectStructure(tmpDir, 'en')).toBe('flat');
  });
});

describe('readLocale', () => {
  it('reads a flat locale file', () => {
    writeFileSync(join(tmpDir, 'en.json'), JSON.stringify({ hello: 'world' }));
    expect(readLocale(tmpDir, 'en', 'flat')).toEqual({ hello: 'world' });
  });

  it('reads a folder-structure locale file', () => {
    mkdirSync(join(tmpDir, 'en'));
    writeFileSync(join(tmpDir, 'en', 'translation.json'), JSON.stringify({ hello: 'world' }));
    expect(readLocale(tmpDir, 'en', 'folder')).toEqual({ hello: 'world' });
  });

  it('returns empty object when file does not exist', () => {
    expect(readLocale(tmpDir, 'de', 'flat')).toEqual({});
  });

  it('throws on invalid JSON content', () => {
    writeFileSync(join(tmpDir, 'en.json'), 'not valid json');
    expect(() => readLocale(tmpDir, 'en', 'flat')).toThrow(/invalid json/i);
  });
});

describe('writeLocale', () => {
  it('writes a flat locale file atomically', () => {
    writeLocale(tmpDir, 'en', 'flat', { hello: 'world' });
    const content = readFileSync(join(tmpDir, 'en.json'), 'utf-8');
    expect(JSON.parse(content)).toEqual({ hello: 'world' });
  });

  it('writes a folder-structure locale file creating directories', () => {
    writeLocale(tmpDir, 'en', 'folder', { hello: 'world' });
    const content = readFileSync(join(tmpDir, 'en', 'translation.json'), 'utf-8');
    expect(JSON.parse(content)).toEqual({ hello: 'world' });
  });

  it('does not leave .tmp files behind', async () => {
    writeLocale(tmpDir, 'en', 'flat', { hello: 'world' });
    const { readdirSync } = await import('node:fs');
    const files = readdirSync(tmpDir);
    expect(files.some(f => f.endsWith('.tmp'))).toBe(false);
  });
});

describe('listLocales', () => {
  it('lists locales in flat structure', () => {
    writeFileSync(join(tmpDir, 'en.json'), '{}');
    writeFileSync(join(tmpDir, 'de.json'), '{}');
    const locales = listLocales(tmpDir, 'flat');
    expect(locales.sort()).toEqual(['de', 'en']);
  });

  it('lists locales in folder structure', () => {
    mkdirSync(join(tmpDir, 'en'));
    mkdirSync(join(tmpDir, 'de'));
    writeFileSync(join(tmpDir, 'en', 'translation.json'), '{}');
    writeFileSync(join(tmpDir, 'de', 'translation.json'), '{}');
    const locales = listLocales(tmpDir, 'folder');
    expect(locales.sort()).toEqual(['de', 'en']);
  });

  it('returns empty array when directory does not exist', () => {
    expect(listLocales(join(tmpDir, 'nonexistent'), 'flat')).toEqual([]);
  });

  it('excludes .tmp files in flat structure', () => {
    writeFileSync(join(tmpDir, 'en.json'), '{}');
    writeFileSync(join(tmpDir, 'en.json.tmp'), '{}');
    expect(listLocales(tmpDir, 'flat')).toEqual(['en']);
  });
});
