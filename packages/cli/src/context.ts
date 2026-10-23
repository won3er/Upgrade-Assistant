import { join } from 'node:path';
import {
  AnthropicProvider,
  NpmRegistryClient,
  NullAiProvider,
  OfflineRegistry,
  PluginRegistry,
  readJsonFile,
  type AiProvider,
  type RegistryPort,
} from '@upgrade-assistant/core';
import reactPlugin from '@upgrade-assistant/plugin-react';
import nextjsPlugin from '@upgrade-assistant/plugin-nextjs';
import typescriptPlugin from '@upgrade-assistant/plugin-typescript';

/** Optional per-project configuration file. */
export interface UaConfig {
  /** Per-package target versions, e.g. { "react": "19.0.0" }. */
  targets?: Record<string, string>;
  /** Extra plugin package names to load (default export = MigrationPlugin). */
  plugins?: string[];
}

export interface CliContext {
  registry: PluginRegistry;
  npm: RegistryPort;
  ai: AiProvider;
  config: UaConfig;
  configWarnings: string[];
}

export const CONFIG_FILE = 'upgrade-assistant.config.json';

/** Composition root: everything the commands need, wired in one place. */
export async function createContext(rootDir: string, offline = false): Promise<CliContext> {
  const registry = new PluginRegistry();
  registry.register(reactPlugin);
  registry.register(nextjsPlugin);
  registry.register(typescriptPlugin);

  const config = readJsonFile<UaConfig>(join(rootDir, CONFIG_FILE)) ?? {};
  const configWarnings: string[] = [];

  for (const specifier of config.plugins ?? []) {
    try {
      await registry.loadExternal(specifier);
    } catch (error) {
      configWarnings.push(
        `Could not load plugin "${specifier}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const anthropic = new AnthropicProvider();
  return {
    registry,
    npm: offline ? new OfflineRegistry() : new NpmRegistryClient(),
    ai: anthropic.isAvailable() ? anthropic : new NullAiProvider(),
    config,
    configWarnings,
  };
}

/** Parse repeated `--target react@19.0.0` flags into a record. */
export function parseTargets(values: string[] | undefined): Record<string, string> {
  const targets: Record<string, string> = {};
  for (const value of values ?? []) {
    const at = value.lastIndexOf('@');
    if (at <= 0) {
      throw new Error(`Invalid --target "${value}". Expected format: package@version`);
    }
    targets[value.slice(0, at)] = value.slice(at + 1);
  }
  return targets;
}
