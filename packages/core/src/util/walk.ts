import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.turbo',
  '.vercel',
  'coverage',
  '.upgrade-assistant',
]);

export interface WalkOptions {
  extensions: readonly string[];
  ignoredDirs?: ReadonlySet<string>;
  maxFiles?: number;
}

/**
 * Minimal recursive file walker. Deliberately dependency-free: the ignore
 * list is small and fixed, and predictability beats glob expressiveness
 * for this use case.
 */
export function walkFiles(rootDir: string, options: WalkOptions): string[] {
  const ignored = options.ignoredDirs ?? DEFAULT_IGNORED_DIRS;
  const maxFiles = options.maxFiles ?? 20_000;
  const results: string[] = [];

  const visit = (dir: string): void => {
    if (results.length >= maxFiles) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return; // unreadable directory — skip silently
    }
    for (const entry of entries) {
      if (results.length >= maxFiles) return;
      if (entry.isDirectory()) {
        if (!ignored.has(entry.name) && !entry.name.startsWith('.')) {
          visit(join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        if (options.extensions.some((ext) => entry.name.endsWith(ext))) {
          results.push(join(dir, entry.name));
        }
      }
    }
  };

  visit(rootDir);
  return results;
}
