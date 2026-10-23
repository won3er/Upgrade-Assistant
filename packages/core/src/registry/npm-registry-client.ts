import type { RegistryPort } from './registry-port.js';

interface AbbreviatedPackument {
  'dist-tags'?: Record<string, string>;
  versions?: Record<string, unknown>;
}

/**
 * npm registry client using the abbreviated ("corgi") document format,
 * which is ~10x smaller than the full packument. In-memory cache per run;
 * network failures degrade to "unknown" instead of failing the analysis.
 */
export class NpmRegistryClient implements RegistryPort {
  private readonly cache = new Map<string, Promise<AbbreviatedPackument | undefined>>();

  constructor(
    private readonly registryUrl = process.env['UA_NPM_REGISTRY'] ?? 'https://registry.npmjs.org',
    private readonly timeoutMs = 10_000,
  ) {}

  async getLatestVersion(packageName: string): Promise<string | undefined> {
    const doc = await this.fetchPackument(packageName);
    return doc?.['dist-tags']?.['latest'];
  }

  async getVersions(packageName: string): Promise<string[]> {
    const doc = await this.fetchPackument(packageName);
    return Object.keys(doc?.versions ?? {});
  }

  private fetchPackument(packageName: string): Promise<AbbreviatedPackument | undefined> {
    const cached = this.cache.get(packageName);
    if (cached) return cached;
    const promise = this.doFetch(packageName);
    this.cache.set(packageName, promise);
    return promise;
  }

  private async doFetch(packageName: string): Promise<AbbreviatedPackument | undefined> {
    const url = `${this.registryUrl}/${encodeURIComponent(packageName).replace('%40', '@')}`;
    try {
      const response = await fetch(url, {
        headers: {
          accept:
            'application/vnd.npm.install-v1+json; q=1.0, application/json; q=0.8, */*',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!response.ok) return undefined;
      return (await response.json()) as AbbreviatedPackument;
    } catch {
      return undefined; // offline / DNS / timeout — analysis continues
    }
  }
}
