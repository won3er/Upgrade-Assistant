import { existsSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';
import { ProjectScanner } from '@upgrade-assistant/core';
import { createContext } from '../context.js';
import { ui } from '../ui.js';
import type { SharedFlags } from './shared.js';

/** `upgrade-assistant plugins` — what's installed and what it detected. */
export async function pluginsCommand(flags: SharedFlags): Promise<void> {
  const ctx = await createContext(flags.dir, true);
  const project = existsSync(join(flags.dir, 'package.json'))
    ? new ProjectScanner().scan(flags.dir)
    : undefined;

  ui.title('Plugins');
  for (const plugin of ctx.registry.all()) {
    const usage = project ? plugin.detect(project) : null;
    const status = usage
      ? pc.green(`detected ${usage.packageName}@${usage.currentVersion}`)
      : pc.dim('not used in this project');
    ui.line(
      `  ${pc.bold(plugin.displayName.padEnd(14))} ${String(plugin.rules.length).padStart(2)} rules   ${status}`,
    );
  }
  ui.line();
  ui.dim(
    'External plugins: add package names to "plugins" in upgrade-assistant.config.json ' +
      '(default export must be a MigrationPlugin).',
  );
}
