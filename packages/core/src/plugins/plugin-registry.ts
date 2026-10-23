import type { MigrationPlugin } from '../domain/rules.js';
import type { ProjectContext } from '../domain/types.js';

/**
 * Holds built-in plugins and loads external ones by package name.
 *
 * External plugin convention: an npm package named
 * `upgrade-assistant-plugin-<name>` (or any name listed in the project's
 * `upgrade-assistant.config.json` → `plugins`) whose default export is a
 * {@link MigrationPlugin}.
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, MigrationPlugin>();

  register(plugin: MigrationPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Duplicate plugin name: ${plugin.name}`);
    }
    this.validate(plugin);
    this.plugins.set(plugin.name, plugin);
  }

  async loadExternal(specifier: string): Promise<MigrationPlugin> {
    const mod = (await import(specifier)) as { default?: MigrationPlugin };
    if (!mod.default?.name || !Array.isArray(mod.default.rules)) {
      throw new Error(`"${specifier}" does not export a valid MigrationPlugin as default.`);
    }
    this.register(mod.default);
    return mod.default;
  }

  all(): MigrationPlugin[] {
    return [...this.plugins.values()];
  }

  get(name: string): MigrationPlugin | undefined {
    return this.plugins.get(name);
  }

  asMap(): Map<string, MigrationPlugin> {
    return new Map(this.plugins);
  }

  /** Plugins whose package is actually used by the project. */
  detectAll(project: ProjectContext) {
    return this.all()
      .map((plugin) => ({ plugin, usage: plugin.detect(project) }))
      .filter((entry): entry is { plugin: MigrationPlugin; usage: NonNullable<ReturnType<MigrationPlugin['detect']>> } =>
        entry.usage !== null,
      );
  }

  /** Enforce the grounding invariant at registration time, not at runtime. */
  private validate(plugin: MigrationPlugin): void {
    for (const rule of plugin.rules) {
      if (!rule.sources || rule.sources.length === 0) {
        throw new Error(
          `Plugin "${plugin.name}" rule "${rule.id}" has no official sources. ` +
            'Every rule must cite official documentation.',
        );
      }
      if (!rule.id.startsWith(`${plugin.name}/`)) {
        throw new Error(
          `Rule id "${rule.id}" must be namespaced under the plugin name ("${plugin.name}/…").`,
        );
      }
    }
  }
}
