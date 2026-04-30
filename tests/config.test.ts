import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readConfigFromPath } from '../src/config.js';

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'i18n-mcp-config-test-'));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

const validConfig = {
  primaryLocale: 'en',
  namespaces: [{ name: 'common', description: 'Shared strings', path: 'locales' }],
};

describe('readConfigFromPath', () => {
  it('reads and parses a valid config', () => {
    const configPath = join(tmpDir, '.i18n-mcp.json');
    writeFileSync(configPath, JSON.stringify(validConfig));
    const config = readConfigFromPath(configPath);
    expect(config.primaryLocale).toBe('en');
    expect(config.namespaces).toHaveLength(1);
    expect(config.namespaces[0].name).toBe('common');
  });

  it('parses optional style section', () => {
    const configPath = join(tmpDir, '.i18n-mcp.json');
    writeFileSync(configPath, JSON.stringify({
      ...validConfig,
      style: { tone: 'informal', doNotTranslate: ['Robin'] },
    }));
    const config = readConfigFromPath(configPath);
    expect(config.style?.tone).toBe('informal');
    expect(config.style?.doNotTranslate).toEqual(['Robin']);
  });

  it('throws if file does not exist', () => {
    expect(() => readConfigFromPath(join(tmpDir, 'missing.json')))
      .toThrow('Could not read');
  });

  it('throws if config is invalid JSON', () => {
    const configPath = join(tmpDir, '.i18n-mcp.json');
    writeFileSync(configPath, 'not json');
    expect(() => readConfigFromPath(configPath)).toThrow(/invalid json/i);
  });

  it('throws if required fields are missing', () => {
    const configPath = join(tmpDir, '.i18n-mcp.json');
    writeFileSync(configPath, JSON.stringify({ namespaces: [] }));
    expect(() => readConfigFromPath(configPath)).toThrow('Invalid');
  });
});
