import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GitService, ProjectScanner } from '@upgrade-assistant/core';
import { createContext } from '../context.js';
import { ui } from '../ui.js';
import type { SharedFlags } from './shared.js';

interface Check {
  name: string;
  ok: boolean;
  critical: boolean;
  detail?: string;
}

/** `upgrade-assistant doctor` — environment sanity before you trust a migration. */
export async function doctorCommand(flags: SharedFlags): Promise<void> {
  const checks: Check[] = [];

  const [major] = process.versions.node.split('.');
  checks.push({
    name: 'Node.js >= 20',
    ok: Number(major) >= 20,
    critical: true,
    detail: `found ${process.versions.node}`,
  });

  const hasPackageJson = existsSync(join(flags.dir, 'package.json'));
  checks.push({
    name: 'package.json present',
    ok: hasPackageJson,
    critical: true,
    detail: hasPackageJson ? undefined : 'run inside a Node.js project',
  });

  const git = new GitService(flags.dir);
  const gitAvailable = git.isAvailable();
  checks.push({ name: 'git available', ok: gitAvailable, critical: false });
  if (gitAvailable && git.isRepository()) {
    checks.push({
      name: 'git working tree clean',
      ok: git.isClean(),
      critical: false,
      detail: git.isClean() ? undefined : 'migrate will refuse to run until committed/stashed',
    });
  } else {
    checks.push({
      name: 'git repository',
      ok: false,
      critical: false,
      detail: 'no repo — migrate loses its rollback safety net',
    });
  }

  checks.push({
    name: 'tsconfig.json present',
    ok: existsSync(join(flags.dir, 'tsconfig.json')),
    critical: false,
    detail: 'needed for post-migration typecheck verification',
  });

  const ctx = await createContext(flags.dir, flags.offline);
  const registryReachable = (await ctx.npm.getLatestVersion('react')) !== undefined;
  checks.push({
    name: 'npm registry reachable',
    ok: registryReachable,
    critical: false,
    detail: registryReachable ? undefined : 'offline? analysis will skip version checks',
  });

  if (hasPackageJson) {
    const project = new ProjectScanner().scan(flags.dir);
    const detected = ctx.registry.detectAll(project);
    checks.push({
      name: 'supported packages detected',
      ok: detected.length > 0,
      critical: false,
      detail:
        detected.length > 0
          ? detected.map((d) => `${d.usage.packageName}@${d.usage.currentVersion}`).join(', ')
          : `plugins installed: ${ctx.registry.all().map((p) => p.name).join(', ')}`,
    });
  }

  checks.push({
    name: 'AI provider (optional)',
    ok: ctx.ai.isAvailable(),
    critical: false,
    detail: ctx.ai.isAvailable()
      ? `provider: ${ctx.ai.name}`
      : 'set ANTHROPIC_API_KEY to enable --explain',
  });

  ui.title('Doctor');
  for (const check of checks) {
    const print = check.ok ? ui.success : check.critical ? ui.fail : ui.warn;
    print(`${check.name}${check.detail ? ` — ${check.detail}` : ''}`);
  }

  if (checks.some((c) => c.critical && !c.ok)) {
    process.exitCode = 1;
  }
}
