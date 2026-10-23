import pc from 'picocolors';
import { ProjectScanner, VersionChecker } from '@upgrade-assistant/core';
import { createContext } from '../context.js';
import { ui } from '../ui.js';
import type { SharedFlags } from './shared.js';

/**
 * `upgrade-assistant check` — fast version lookup, no AST work.
 * The npm-check-updates use case, but scoped to packages we actually
 * have migration knowledge for.
 */
export async function checkCommand(flags: SharedFlags): Promise<void> {
  const ctx = await createContext(flags.dir, flags.offline);
  const project = new ProjectScanner().scan(flags.dir);
  const detected = ctx.registry.detectAll(project);

  if (detected.length === 0) {
    ui.warn('No supported packages found in this project.');
    ui.dim(`Installed plugins: ${ctx.registry.all().map((p) => p.name).join(', ')}`);
    return;
  }

  const { candidates, upToDate, warnings } = await new VersionChecker(ctx.npm).check(detected, {
    targets: ctx.config.targets,
  });

  if (flags.json) {
    console.log(JSON.stringify({ candidates, upToDate, warnings }, null, 2));
    return;
  }

  ui.title('Version check');
  for (const c of candidates) {
    const paint = c.diff === 'major' ? pc.red : c.diff === 'minor' ? pc.yellow : pc.green;
    ui.line(
      `  ${c.packageName.padEnd(24)} ${c.currentVersion.padEnd(10)} → ${paint(c.targetVersion.padEnd(10))} ${pc.dim(c.diff ?? '')}`,
    );
  }
  for (const c of upToDate) {
    ui.line(pc.dim(`  ${c.packageName.padEnd(24)} ${c.currentVersion.padEnd(10)} up to date`));
  }
  for (const warning of warnings) ui.warn(warning);
  if (candidates.length > 0) {
    ui.line();
    ui.dim('Run `upgrade-assistant analyze` to see which breaking changes actually affect you.');
  }
}
