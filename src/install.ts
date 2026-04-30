import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

function installSkills(): void {
  const skillsSource = join(__dirname, '..', 'skills');
  const skillsTarget = join(homedir(), '.claude', 'skills');

  for (const [name, file] of [
    ['i18n-setup', 'i18n-setup.md'],
    ['i18n-usage', 'i18n-usage.md'],
  ]) {
    const src = join(skillsSource, file);
    const targetDir = join(skillsTarget, name);
    const dest = join(targetDir, 'SKILL.md');
    mkdirSync(targetDir, { recursive: true });

    // Skip if src and dest resolve to the same file (e.g. already symlinked)
    try {
      if (realpathSync(src) === realpathSync(dest)) {
        console.log(`  ✓ Skill already installed: ${name}`);
        continue;
      }
    } catch {
      // dest doesn't exist yet — proceed with copy
    }

    cpSync(src, dest);
    console.log(`  ✓ Installed skill: ${name}`);
  }
}

function installMcp(): void {
  const settingsPath = join(process.cwd(), '.claude', 'settings.json');
  mkdirSync(dirname(settingsPath), { recursive: true });

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
    } catch {
      // start fresh if malformed
    }
  }

  const mcpServers = (settings.mcpServers ?? {}) as Record<string, unknown>;
  mcpServers['i18n-mcp'] = {
    command: 'npx',
    args: ['-y', '@robinheat/i18n-mcp@latest'],
  };
  settings.mcpServers = mcpServers;

  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
  console.log(`  ✓ Added MCP server to .claude/settings.json`);
}

export function runInstall(): void {
  console.log('\ni18n-mcp install\n');

  console.log('Installing Claude Code skills...');
  installSkills();

  console.log('Configuring MCP server for this project...');
  installMcp();

  console.log('\nDone! Next steps:');
  console.log('  1. Restart Claude Code');
  console.log('  2. Run /i18n-setup to configure your translation namespaces\n');
}
