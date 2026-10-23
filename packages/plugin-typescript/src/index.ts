import { definePlugin, detectPackage, type MigrationPlugin } from '@upgrade-assistant/core';
import {
  bundlerModuleResolution,
  removedCompilerOptions,
  standardDecoratorsAvailable,
} from './rules/compiler-options.js';

/**
 * TypeScript migration plugin.
 *
 * Knowledge base: the 4.x → 5.x compiler-option breakage (the single most
 * common silent failure when bumping TypeScript) plus advisory rules for
 * options 5.0 made available.
 */
const typescriptPlugin: MigrationPlugin = definePlugin({
  name: 'typescript',
  displayName: 'TypeScript',
  packageName: 'typescript',
  detect: (project) => detectPackage(project, 'typescript'),
  rules: [removedCompilerOptions, standardDecoratorsAvailable, bundlerModuleResolution],
});

export default typescriptPlugin;
