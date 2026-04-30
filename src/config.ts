import { readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { z } from 'zod';

const NamespaceSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  path: z.string().min(1),
});

const StyleSchema = z.object({
  tone: z.enum(['informal', 'formal']).optional(),
  glossary: z.record(z.string()).optional(),
  doNotTranslate: z.array(z.string()).optional(),
});

export const ConfigSchema = z.object({
  primaryLocale: z.string().min(1),
  style: StyleSchema.optional(),
  namespaces: z.array(NamespaceSchema).min(1),
});

export type Config = z.infer<typeof ConfigSchema>;
export type Namespace = z.infer<typeof NamespaceSchema>;

export function readConfigFromPath(configPath: string): Config {
  let content: string;
  try {
    content = readFileSync(configPath, 'utf-8');
  } catch (err) {
    throw new Error(
      `Could not read config from ${configPath}. Run the i18n-mcp setup skill to create one.`,
      { cause: err }
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch (err) {
    throw new Error(
      `Invalid JSON in ${configPath}: ${(err as SyntaxError).message}`,
      { cause: err }
    );
  }

  const result = ConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid .i18n-mcp.json: ${result.error.message}`);
  }

  const configDir = dirname(configPath);
  for (const ns of result.data.namespaces) {
    const resolved = resolve(configDir, ns.path);
    if (!resolved.startsWith(configDir + sep) && resolved !== configDir) {
      throw new Error(
        `Namespace '${ns.name}' path '${ns.path}' escapes the project directory`
      );
    }
  }

  return result.data;
}

export function readConfig(): Config {
  return readConfigFromPath(join(process.cwd(), '.i18n-mcp.json'));
}
