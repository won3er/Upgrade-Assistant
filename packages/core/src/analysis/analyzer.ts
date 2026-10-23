import type { AnalysisResult, ProjectContext } from '../domain/types.js';
import { ProjectScanner } from '../scanner/project-scanner.js';
import { AstService } from '../ast/ast-service.js';
import { UsageAnalyzer } from './usage-analyzer.js';
import { VersionChecker, resolveCurrentVersion, type VersionCheckOptions } from '../versions/version-checker.js';
import { PlanBuilder } from '../planning/plan-builder.js';
import type { PluginRegistry } from '../plugins/plugin-registry.js';
import type { RegistryPort } from '../registry/registry-port.js';

export interface AnalyzeOptions extends VersionCheckOptions {
  onProgress?: (message: string) => void;
}

export interface AnalyzeOutput {
  analysis: AnalysisResult;
  project: ProjectContext;
  ast: AstService;
}

/**
 * The `analyze` pipeline — the product's core loop:
 *
 *   scan → detect plugins → check registry → slice knowledge bases →
 *   run detectors over the AST → build per-upgrade plans.
 *
 * Fully deterministic. No AI, no writes, no network beyond the registry.
 */
export class Analyzer {
  constructor(
    private readonly plugins: PluginRegistry,
    private readonly registry: RegistryPort,
  ) {}

  async analyze(rootDir: string, options: AnalyzeOptions = {}): Promise<AnalyzeOutput> {
    const progress = options.onProgress ?? (() => {});

    progress('Scanning project…');
    const scanner = new ProjectScanner();
    const project = scanner.scan(rootDir);

    progress('Detecting plugins…');
    const detected = this.plugins.detectAll(project).map(({ plugin, usage }) => ({
      plugin,
      usage: {
        ...usage,
        currentVersion:
          resolveCurrentVersion(
            usage.declaredRange,
            scanner.readInstalledVersion(project.rootDir, usage.packageName),
          ) ?? usage.currentVersion,
      },
    }));

    progress('Checking versions on the registry…');
    const checker = new VersionChecker(this.registry);
    const { candidates, upToDate, warnings } = await checker.check(detected, options);

    progress('Parsing sources…');
    const ast = new AstService(project);

    const usageAnalyzer = new UsageAnalyzer();
    const planBuilder = new PlanBuilder();
    const plans = [];
    for (const candidate of candidates) {
      progress(`Analyzing impact of ${candidate.packageName} ${candidate.currentVersion} → ${candidate.targetVersion}…`);
      const plugin = this.plugins.get(candidate.plugin);
      if (!plugin) continue;
      const findings = await usageAnalyzer.analyze(project, ast, plugin, candidate);
      plans.push(planBuilder.build(candidate, findings));
    }

    const analysis: AnalysisResult = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      rootDir: project.rootDir,
      projectName: project.packageJson.name ?? 'unnamed-project',
      candidates,
      plans,
      upToDate,
      warnings,
    };

    return { analysis, project, ast };
  }
}
