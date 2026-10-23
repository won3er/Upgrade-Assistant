import { Project, ScriptTarget, type SourceFile } from 'ts-morph';
import type { ProjectContext } from '../domain/types.js';

/**
 * Owns the ts-morph project. One instance per analysis run.
 *
 * Files are added explicitly from the scanner's list (never implicitly from
 * tsconfig `include`) so behavior is identical with or without a tsconfig,
 * and node_modules is never parsed.
 */
export class AstService {
  private readonly project: Project;
  private readonly filePaths: string[];

  constructor(context: ProjectContext) {
    this.project = new Project({
      compilerOptions: {
        allowJs: true,
        jsx: 4, // JsxEmit.ReactJSX — parse JSX in .jsx/.tsx without config
        target: ScriptTarget.ES2022,
      },
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    });
    this.filePaths = [...context.sourceFilePaths, ...context.configFilePaths];
    for (const filePath of this.filePaths) {
      try {
        this.project.addSourceFileAtPath(filePath);
      } catch {
        // Unparseable file: skip rather than abort the whole analysis.
      }
    }
  }

  /** All parsed source files (excluding config files). */
  getSourceFiles(): SourceFile[] {
    return this.project.getSourceFiles().filter((sf) => !isConfigPath(sf.getFilePath()));
  }

  /** A specific file (source or config) by absolute path, if parsed. */
  getFile(absolutePath: string): SourceFile | undefined {
    return this.project.getSourceFile(absolutePath);
  }

  /** Parsed config files (next.config.* etc). */
  getConfigFiles(): SourceFile[] {
    return this.project.getSourceFiles().filter((sf) => isConfigPath(sf.getFilePath()));
  }

  /** Persist all in-memory AST modifications to disk. */
  async save(): Promise<void> {
    await this.project.save();
  }

  /** File paths that have unsaved AST modifications. */
  getDirtyFiles(): SourceFile[] {
    return this.project.getSourceFiles().filter((sf) => !sf.isSaved());
  }
}

function isConfigPath(path: string): boolean {
  return /(next|vite|tailwind)\.config\.(js|mjs|ts)$/.test(path);
}
