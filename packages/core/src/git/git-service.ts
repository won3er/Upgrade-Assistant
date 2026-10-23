import { spawnSync } from 'node:child_process';

/**
 * Thin git wrapper for the safety rails around `migrate`:
 * refuse to touch a dirty tree, work on a dedicated branch, and make
 * rollback a one-liner (`git checkout .`).
 */
/** Files this tool itself writes — never a reason to block a migration. */
const OWN_ARTIFACTS = ['MIGRATION_REPORT.md', '.upgrade-assistant'];

export class GitService {
  constructor(private readonly cwd: string) {}

  isAvailable(): boolean {
    return this.run(['--version']).ok;
  }

  isRepository(): boolean {
    return this.run(['rev-parse', '--is-inside-work-tree']).ok;
  }

  /**
   * Only tracked modifications make the tree "dirty". Untracked files
   * (including our own MIGRATION_REPORT.md and .upgrade-assistant/ cache)
   * are not endangered by AST edits nor by a `git checkout .` rollback.
   */
  isClean(): boolean {
    const result = this.run(['status', '--porcelain']);
    if (!result.ok) return false;
    const dirty = result.stdout.split('\n').filter((line) => {
      if (line.trim() === '' || line.startsWith('??')) return false;
      const path = line.slice(3).trim();
      return !OWN_ARTIFACTS.some((a) => path === a || path.startsWith(`${a}/`));
    });
    return dirty.length === 0;
  }

  currentBranch(): string | undefined {
    const result = this.run(['rev-parse', '--abbrev-ref', 'HEAD']);
    return result.ok ? result.stdout.trim() : undefined;
  }

  createAndCheckoutBranch(name: string): boolean {
    return this.run(['checkout', '-b', name]).ok;
  }

  private run(args: string[]): { ok: boolean; stdout: string } {
    const result = spawnSync('git', args, { cwd: this.cwd, encoding: 'utf8', timeout: 15_000 });
    return { ok: result.status === 0, stdout: result.stdout ?? '' };
  }
}
