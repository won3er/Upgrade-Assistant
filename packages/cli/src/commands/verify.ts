import { ProjectScanner, Verifier } from '@upgrade-assistant/core';
import { ui } from '../ui.js';
import type { SharedFlags } from './shared.js';

export interface VerifyFlags extends SharedFlags {
  tests?: boolean;
}

/**
 * `upgrade-assistant verify` — the standalone verification loop.
 *
 * Typecheck always (when the project has TypeScript installed); the
 * project's own test suite with --tests. Exit code 1 on any failure, so
 * it slots directly into CI after `migrate`.
 */
export async function verifyCommand(flags: VerifyFlags): Promise<void> {
  const project = new ProjectScanner().scan(flags.dir);
  const verifier = new Verifier();

  ui.title('Verification');

  const typecheck = verifier.verify(project);
  if (!typecheck.ran) {
    ui.warn(typecheck.output ?? 'Typecheck skipped.');
  } else if (typecheck.typecheckPassed) {
    ui.success('Typecheck passed');
  } else {
    ui.fail(`Typecheck failed with ${typecheck.errorCount} error(s)`);
    if (typecheck.output) ui.dim(indent(typecheck.output));
    process.exitCode = 1;
  }

  if (flags.tests) {
    const tests = verifier.runTestScript(project);
    if (!tests) {
      ui.warn('No "test" script in package.json — tests skipped.');
    } else if (tests.passed) {
      ui.success('Test suite passed');
    } else {
      ui.fail('Test suite failed');
      ui.dim(indent(tests.output));
      process.exitCode = 1;
    }
  }
}

function indent(text: string): string {
  return text
    .split('\n')
    .slice(0, 40)
    .map((line) => `  ${line}`)
    .join('\n');
}
