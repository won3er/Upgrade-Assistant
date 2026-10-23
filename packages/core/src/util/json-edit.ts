import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Indent- and EOL-preserving JSON editing for package.json/tsconfig.json.
 *
 * We parse, let the caller mutate the object, then re-serialize with the
 * original indentation and trailing-newline style. This is a structured
 * edit — never a regex replace — but it does normalize key order only for
 * keys the caller touched.
 *
 * Returns false when the file is not plain JSON (e.g. tsconfig with
 * comments); callers must then downgrade the fix to a manual step.
 */
export function editJsonFile(
  filePath: string,
  mutate: (data: Record<string, unknown>) => void,
): boolean {
  const raw = readFileSync(filePath, 'utf8');
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return false; // JSONC or invalid — refuse to touch it
  }
  mutate(data);
  const indent = detectIndent(raw);
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  let output = JSON.stringify(data, null, indent);
  if (eol === '\r\n') output = output.replaceAll('\n', '\r\n');
  if (raw.endsWith(eol) || raw.endsWith('\n')) output += eol;
  writeFileSync(filePath, output, 'utf8');
  return true;
}

/** Parse a JSON file, returning undefined instead of throwing. */
export function readJsonFile<T>(filePath: string): T | undefined {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function detectIndent(raw: string): string | number {
  const match = /^[{[][\r\n]+([ \t]+)/.exec(raw);
  if (!match || match[1] === undefined) return 2;
  return match[1];
}
