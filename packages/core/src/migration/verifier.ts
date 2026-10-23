import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { ProjectContext, VerificationResult } from '../domain/types.js';

/**
 * Post-migration verification loop.
 *
 * This is the answer to the biggest limitation of version-bump bots:
 * they discover breakage in CI, after the PR. We verify locally, before
 * anything is committed. Typecheck uses the project's own TypeScript;
 * the test suite runs via the project's own package manager on demand.
 */
export class Verifier {
  verify(project: ProjectContext): VerificationResult {
    if (!project.tsConfigPath) {
      return { ran: false, output: 'No tsconfig.json found — typecheck skipped.' };
    }
    const tscBin = this.resolveTsc(project.rootDir);
    if (!tscBin) {
      return {
        ran: false,
        output: 'TypeScript not installed in the project — run your package manager install first.',
      };
    }
    const result = spawnSync(process.execPath, [tscBin, '--noEmit', '-p', project.tsConfigPath], {
      cwd: project.rootDir,
      encoding: 'utf8',
      timeout: 180_000,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    const errorCount = countErrors(output);
    return {
      ran: true,
      typecheckPassed: result.status === 0,
      errorCount,
      output: truncate(output, 4000),
    };
  }

  /**
   * Run the project's own `test` script with its own package manager.
   * Skips silently (undefined) when no test script exists.
   */
  runTestScript(project: ProjectContext): { passed: boolean; output: string } | undefined {
    if (!project.packageJson.scripts?.['test']) return undefined;
    const pm = detectPackageManager(project.rootDir);
    const result = spawnSync(pm, ['test'], {
      cwd: project.rootDir,
      encoding: 'utf8',
      timeout: 600_000,
      shell: process.platform === 'win32', // .cmd shims on Windows
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    return { passed: result.status === 0, output: truncate(output, 4000) };
  }

  private resolveTsc(rootDir: string): string | undefined {
    const local = join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');
    return existsSync(local) ? local : undefined;
  }
}

/** Lockfile-based package-manager detection. */
export function detectPackageManager(rootDir: string): 'npm' | 'pnpm' | 'yarn' | 'bun' {
  if (existsSync(join(rootDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(rootDir, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(rootDir, 'bun.lockb')) || existsSync(join(rootDir, 'bun.lock'))) return 'bun';
  return 'npm';
}

function countErrors(output: string): number {
  const matches = output.match(/error TS\d+/g);
  return matches ? matches.length : 0;
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}\n… (truncated)`;
}
