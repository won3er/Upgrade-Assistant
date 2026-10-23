import semver from 'semver';
import type { RegistryPort } from '../registry/registry-port.js';
import type { UpgradeCandidate, VersionDiff } from '../domain/types.js';
import type { DetectedUsage, MigrationPlugin } from '../domain/rules.js';

export interface VersionCheckOptions {
  /** Per-package target override, e.g. `{ react: '19.0.0' }`. */
  targets?: Record<string, string>;
}

export interface VersionCheckOutcome {
  candidates: UpgradeCandidate[];
  upToDate: UpgradeCandidate[];
  warnings: string[];
}

/**
 * Turns "plugin detected package X at version Y" into concrete upgrade
 * candidates by asking the registry what exists.
 */
export class VersionChecker {
  constructor(private readonly registry: RegistryPort) {}

  async check(
    detected: { plugin: MigrationPlugin; usage: DetectedUsage }[],
    options: VersionCheckOptions = {},
  ): Promise<VersionCheckOutcome> {
    const candidates: UpgradeCandidate[] = [];
    const upToDate: UpgradeCandidate[] = [];
    const warnings: string[] = [];

    await Promise.all(
      detected.map(async ({ plugin, usage }) => {
        const requested = options.targets?.[usage.packageName];
        let latest = await this.registry.getLatestVersion(usage.packageName);
        if (!latest) {
          // Offline/air-gapped mode still works when the user pins a target.
          if (requested && semver.valid(requested)) {
            latest = requested;
            warnings.push(
              `Registry unreachable for "${usage.packageName}" — using pinned target ${requested}.`,
            );
          } else {
            warnings.push(
              `Could not reach the registry for "${usage.packageName}" — skipped. ` +
                'Pin a version with --target to analyze offline.',
            );
            return;
          }
        }
        const target = await this.resolveTarget(usage.packageName, requested, latest, warnings);
        if (!target) return;

        const candidate: UpgradeCandidate = {
          plugin: plugin.name,
          packageName: usage.packageName,
          relatedPackages: plugin.relatedPackages ?? [],
          currentVersion: usage.currentVersion,
          latestVersion: latest,
          targetVersion: target,
          diff: diffOf(usage.currentVersion, target),
        };
        if (semver.gte(usage.currentVersion, target)) {
          upToDate.push(candidate);
        } else {
          candidates.push(candidate);
        }
      }),
    );

    candidates.sort((a, b) => a.packageName.localeCompare(b.packageName));
    upToDate.sort((a, b) => a.packageName.localeCompare(b.packageName));
    return { candidates, upToDate, warnings };
  }

  /** Resolve a user-requested target ("19", "^19.1", "19.0.0") to a real version. */
  private async resolveTarget(
    packageName: string,
    requested: string | undefined,
    latest: string,
    warnings: string[],
  ): Promise<string | undefined> {
    if (!requested) return latest;
    if (semver.valid(requested)) return requested;
    const versions = await this.registry.getVersions(packageName);
    const resolved = semver.maxSatisfying(versions, requested);
    if (!resolved) {
      warnings.push(`No published version of ${packageName} satisfies "${requested}" — skipped.`);
      return undefined;
    }
    return resolved;
  }
}

export function diffOf(from: string, to: string): VersionDiff {
  const cleanFrom = semver.coerce(from);
  const cleanTo = semver.coerce(to);
  if (!cleanFrom || !cleanTo) return null;
  return (semver.diff(cleanFrom, cleanTo) as VersionDiff) ?? null;
}

/**
 * Best-known concrete version from a declared range: prefers the installed
 * version, falls back to the minimum version satisfying the range.
 */
export function resolveCurrentVersion(
  declaredRange: string,
  installedVersion?: string,
): string | undefined {
  if (installedVersion && semver.valid(installedVersion)) return installedVersion;
  const min = semver.minVersion(declaredRange);
  return min?.version;
}
