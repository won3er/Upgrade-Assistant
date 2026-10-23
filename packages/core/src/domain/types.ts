/**
 * Core domain types shared across the engine, plugins and the CLI.
 *
 * Everything in this file is intentionally serializable (no functions,
 * no class instances) so analysis results can be cached to disk and
 * emitted as `--json` output.
 */

/** How disruptive a change is for a consumer of the library. */
export type Severity = 'info' | 'warning' | 'breaking';

/** Aggregated risk classification for a single upgrade. */
export type RiskLevel = 'low' | 'medium' | 'high';

/** How a finding can be resolved. */
export type FixKind =
  /** The engine can rewrite the code itself via AST. */
  | 'autofix'
  /** An official codemod exists; the engine recommends the exact command. */
  | 'official-codemod'
  /** Requires a human decision. Goes to the checklist. */
  | 'manual';

/** A link to an official source (docs, changelog, release notes, RFC). */
export interface OfficialSource {
  title: string;
  url: string;
}

/** Loosely-typed package.json contents. */
export interface PackageJsonLike {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  [key: string]: unknown;
}

/** The scanned project, as seen by the engine and every plugin. */
export interface ProjectContext {
  /** Absolute root directory of the project. */
  rootDir: string;
  /** Parsed package.json. */
  packageJson: PackageJsonLike;
  /** Absolute path to package.json. */
  packageJsonPath: string;
  /** Absolute path to tsconfig.json, when present. */
  tsConfigPath?: string;
  /** Absolute paths of all discovered source files (ts/tsx/js/jsx). */
  sourceFilePaths: string[];
  /** Absolute paths of interesting config files (next.config.*, etc). */
  configFilePaths: string[];
}

/** A single declared dependency. */
export interface DependencyInfo {
  name: string;
  declaredRange: string;
  kind: 'prod' | 'dev' | 'peer';
  /** Version found in node_modules, when installed. */
  installedVersion?: string;
}

/** Semver jump classification. */
export type VersionDiff = 'major' | 'minor' | 'patch' | null;

/** An upgrade the engine considers doing, owned by one plugin. */
export interface UpgradeCandidate {
  plugin: string;
  packageName: string;
  /** Packages upgraded together (e.g. react-dom, @types/react). */
  relatedPackages: string[];
  /** Best-known current version (installed, or minimum of declared range). */
  currentVersion: string;
  /** Latest version published on the registry. */
  latestVersion: string;
  /** Version this run targets (defaults to latest; user-overridable). */
  targetVersion: string;
  diff: VersionDiff;
}

/** A concrete location where a rule matched. */
export interface RuleMatch {
  /** Path relative to the project root. */
  filePath: string;
  line: number;
  column?: number;
  /** Short code excerpt for the report. */
  excerpt?: string;
  /** Context-specific note (e.g. "enclosing function is not async"). */
  note?: string;
  /** When true, the engine can fix this specific match automatically. */
  autofixable?: boolean;
}

/** Serializable description of a rule (no behavior). */
export interface RuleMeta {
  id: string;
  plugin: string;
  packageName: string;
  title: string;
  description: string;
  /** Version of the target package in which the change lands. */
  introducedIn: string;
  severity: Severity;
  fix: FixKind;
  /** Official references. Rules without sources are rejected by the engine. */
  sources: OfficialSource[];
  /** Exact official codemod command, when one exists. */
  officialCodemod?: string;
}

/** A rule that matched somewhere in the project. */
export interface Finding {
  rule: RuleMeta;
  matches: RuleMatch[];
}

/** One ordered step of the migration plan. */
export interface PlanStep {
  order: number;
  kind: 'update-dependencies' | 'autofix' | 'official-codemod' | 'manual';
  plugin: string;
  title: string;
  detail: string;
  /** Rule ids involved in this step, when applicable. */
  ruleIds: string[];
  /** Files this step touches (relative paths). */
  files: string[];
  estimatedMinutes: number;
}

/** Per-plugin migration plan. */
export interface UpgradePlan {
  candidate: UpgradeCandidate;
  findings: Finding[];
  steps: PlanStep[];
  risk: RiskLevel;
  estimatedMinutes: number;
}

/** Full result of `analyze`. */
export interface AnalysisResult {
  schemaVersion: 1;
  createdAt: string;
  rootDir: string;
  projectName: string;
  candidates: UpgradeCandidate[];
  plans: UpgradePlan[];
  /** Candidates skipped because the project is already up to date. */
  upToDate: UpgradeCandidate[];
  /** Non-fatal problems encountered while analyzing (offline registry, etc). */
  warnings: string[];
}

/** Result of applying a single fix rule during `migrate`. */
export interface AppliedFix {
  ruleId: string;
  filePath: string;
  fixesApplied: number;
}

/** Full result of `migrate`. */
export interface MigrationResult {
  dryRun: boolean;
  modifiedFiles: string[];
  appliedFixes: AppliedFix[];
  dependencyUpdates: { packageName: string; from: string; to: string }[];
  /** Steps that still require a human, copied to the checklist. */
  remainingManual: PlanStep[];
  verification?: VerificationResult;
}

/** Result of the post-migration verification loop. */
export interface VerificationResult {
  ran: boolean;
  typecheckPassed?: boolean;
  errorCount?: number;
  output?: string;
  /** Present only when the test suite was executed (verify --tests). */
  testsPassed?: boolean;
  testOutput?: string;
}
