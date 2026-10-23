import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { DependencyInfo, PackageJsonLike, ProjectContext } from '../domain/types.js';
import { readJsonFile } from '../util/json-edit.js';
import { walkFiles } from '../util/walk.js';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'] as const;

const CONFIG_FILE_NAMES = [
  'next.config.js',
  'next.config.mjs',
  'next.config.ts',
  'vite.config.ts',
  'vite.config.js',
  'tailwind.config.js',
  'tailwind.config.ts',
] as const;

export class ProjectScanError extends Error {}

/**
 * Scans a directory into a {@link ProjectContext}.
 *
 * Works WITHOUT node_modules on purpose: analysis must be possible on a
 * freshly cloned repo. When node_modules exists, installed versions are
 * used to refine dependency resolution.
 */
export class ProjectScanner {
  scan(dir: string): ProjectContext {
    const rootDir = resolve(dir);
    const packageJsonPath = join(rootDir, 'package.json');
    if (!existsSync(packageJsonPath)) {
      throw new ProjectScanError(
        `No package.json found in ${rootDir}. Run the command inside a Node.js project.`,
      );
    }
    const packageJson = readJsonFile<PackageJsonLike>(packageJsonPath);
    if (!packageJson) {
      throw new ProjectScanError(`Could not parse ${packageJsonPath}.`);
    }

    const tsConfigPath = join(rootDir, 'tsconfig.json');
    const sourceFilePaths = walkFiles(rootDir, { extensions: SOURCE_EXTENSIONS }).filter(
      (p) => !p.endsWith('.d.ts') && !isConfigFile(p),
    );
    const configFilePaths = CONFIG_FILE_NAMES.map((name) => join(rootDir, name)).filter((p) =>
      existsSync(p),
    );

    return {
      rootDir,
      packageJson,
      packageJsonPath,
      tsConfigPath: existsSync(tsConfigPath) ? tsConfigPath : undefined,
      sourceFilePaths,
      configFilePaths,
    };
  }

  /** All declared dependencies, with installed version when available. */
  listDependencies(project: ProjectContext): DependencyInfo[] {
    const result: DependencyInfo[] = [];
    const push = (record: Record<string, string> | undefined, kind: DependencyInfo['kind']) => {
      for (const [name, declaredRange] of Object.entries(record ?? {})) {
        result.push({
          name,
          declaredRange,
          kind,
          installedVersion: this.readInstalledVersion(project.rootDir, name),
        });
      }
    };
    push(project.packageJson.dependencies, 'prod');
    push(project.packageJson.devDependencies, 'dev');
    push(project.packageJson.peerDependencies, 'peer');
    return result;
  }

  /** Read node_modules/<name>/package.json version, if installed. */
  readInstalledVersion(rootDir: string, packageName: string): string | undefined {
    try {
      const pkgPath = join(rootDir, 'node_modules', ...packageName.split('/'), 'package.json');
      const raw = readFileSync(pkgPath, 'utf8');
      const parsed = JSON.parse(raw) as { version?: string };
      return parsed.version;
    } catch {
      return undefined;
    }
  }
}

function isConfigFile(path: string): boolean {
  return CONFIG_FILE_NAMES.some((name) => path.endsWith(name));
}
