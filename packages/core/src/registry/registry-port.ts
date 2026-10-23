/**
 * Port for package-registry lookups. The engine only ever needs two
 * questions answered, which keeps offline mode and tests trivial.
 */
export interface RegistryPort {
  /** Latest stable version (dist-tag `latest`), or undefined if unknown. */
  getLatestVersion(packageName: string): Promise<string | undefined>;
  /** All published versions, ascending. Empty when unknown. */
  getVersions(packageName: string): Promise<string[]>;
}

/** Registry that always answers "unknown" — used by `--offline`. */
export class OfflineRegistry implements RegistryPort {
  async getLatestVersion(): Promise<string | undefined> {
    return undefined;
  }
  async getVersions(): Promise<string[]> {
    return [];
  }
}
