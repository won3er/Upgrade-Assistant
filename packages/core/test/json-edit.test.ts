import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { editJsonFile } from '../dist/index.js';

function tmpJson(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'ua-json-'));
  const path = join(dir, 'file.json');
  writeFileSync(path, content, 'utf8');
  return path;
}

describe('editJsonFile', () => {
  it('preserves 4-space indentation and trailing newline', () => {
    const path = tmpJson('{\n    "a": 1\n}\n');
    const ok = editJsonFile(path, (data) => {
      data['b'] = 2;
    });
    expect(ok).toBe(true);
    const result = readFileSync(path, 'utf8');
    expect(result).toBe('{\n    "a": 1,\n    "b": 2\n}\n');
  });

  it('preserves tab indentation', () => {
    const path = tmpJson('{\n\t"a": 1\n}\n');
    editJsonFile(path, (data) => {
      data['b'] = 2;
    });
    expect(readFileSync(path, 'utf8')).toContain('\t"b": 2');
  });

  it('refuses JSONC instead of corrupting it', () => {
    const path = tmpJson('{\n  // comment\n  "a": 1\n}\n');
    const before = readFileSync(path, 'utf8');
    const ok = editJsonFile(path, (data) => {
      data['b'] = 2;
    });
    expect(ok).toBe(false);
    expect(readFileSync(path, 'utf8')).toBe(before);
  });
});
