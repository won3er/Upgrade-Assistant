import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnalysisResult } from '../domain/types.js';

const DIR = '.upgrade-assistant';
const FILE = 'analysis.json';

/**
 * Caches the last analysis under `.upgrade-assistant/` so `report` and
 * `plan` don't need to re-run everything. `migrate` always re-analyzes:
 * applying fixes from stale data is how tools destroy trust.
 */
export class AnalysisStore {
  constructor(private readonly rootDir: string) {}

  save(analysis: AnalysisResult): string {
    const dir = join(this.rootDir, DIR);
    mkdirSync(dir, { recursive: true });
    const path = join(dir, FILE);
    writeFileSync(path, JSON.stringify(analysis, null, 2), 'utf8');
    return path;
  }

  load(): AnalysisResult | undefined {
    const path = join(this.rootDir, DIR, FILE);
    if (!existsSync(path)) return undefined;
    try {
      const parsed = JSON.parse(readFileSync(path, 'utf8')) as AnalysisResult;
      return parsed.schemaVersion === 1 ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
}
