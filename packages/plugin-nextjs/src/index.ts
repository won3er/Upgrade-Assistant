import { definePlugin, detectPackage, type MigrationPlugin } from '@upgrade-assistant/core';
import { asyncRequestApis } from './rules/async-request-apis.js';
import { asyncPageProps } from './rules/async-page-props.js';
import {
  ampRemoved,
  imagesDomainsDeprecated,
  nextLintRemoved,
  runtimeConfigLegacy,
  webpackConfigWithTurbopack,
} from './rules/v16-removals.js';

/**
 * Next.js migration plugin.
 *
 * Knowledge base: Next.js 15 (async request APIs, image config) and
 * Next.js 16 (next lint removal, AMP removal, Turbopack default).
 * The official `@next/codemod` CLI is first-class here: where Vercel
 * ships a codemod, we point at it instead of reimplementing it.
 */
const nextjsPlugin: MigrationPlugin = definePlugin({
  name: 'nextjs',
  displayName: 'Next.js',
  packageName: 'next',
  relatedPackages: ['eslint-config-next'],
  detect: (project) => detectPackage(project, 'next'),
  rules: [
    asyncRequestApis,
    asyncPageProps,
    nextLintRemoved,
    ampRemoved,
    runtimeConfigLegacy,
    webpackConfigWithTurbopack,
    imagesDomainsDeprecated,
  ],
});

export default nextjsPlugin;
