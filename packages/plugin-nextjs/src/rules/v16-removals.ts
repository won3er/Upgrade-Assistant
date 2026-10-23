import {
  ast,
  defineRule,
  type ProjectRule,
  type RuleMatch,
  type SourceRule,
} from '@upgrade-assistant/core';

const V16_GUIDE = {
  title: 'Next.js 16 Upgrade Guide',
  url: 'https://nextjs.org/docs/app/guides/upgrading/version-16',
} as const;

/** `next lint` was removed in Next.js 16. */
export const nextLintRemoved: ProjectRule = defineRule({
  id: 'nextjs/next-lint-removed',
  scope: 'project',
  title: 'The `next lint` command was removed',
  description:
    'Next.js 16 removed the built-in lint command. Move the script to the ESLint CLI ' +
    '(or Biome) and keep eslint-config-next as your shared config.',
  introducedIn: '16.0.0',
  severity: 'breaking',
  fix: 'manual',
  sources: [V16_GUIDE],
  officialCodemod: 'npx @next/codemod@canary upgrade latest',
  detect(ctx) {
    const scripts = ctx.project.packageJson.scripts ?? {};
    return Object.entries(scripts)
      .filter(([, command]) => command.includes('next lint'))
      .map(([name, command]) => ({
        filePath: 'package.json',
        line: 1,
        excerpt: `"${name}": "${command}"`,
        note: `script "${name}" uses next lint`,
      }));
  },
});

/** AMP support was removed in Next.js 16. */
export const ampRemoved: SourceRule = defineRule({
  id: 'nextjs/amp-removed',
  scope: 'source',
  title: 'AMP support was removed',
  description:
    'Next.js 16 removed AMP support (useAmp, AMP page config). AMP pages must be migrated ' +
    'to regular pages before upgrading.',
  introducedIn: '16.0.0',
  severity: 'breaking',
  fix: 'manual',
  sources: [V16_GUIDE],
  textHints: ['next/amp'],
  detect(sf, ctx) {
    return ast
      .importsFrom(sf, 'next/amp')
      .map((decl) => ast.matchFromNode(decl, ctx.project.rootDir));
  },
});

/** Legacy runtime config is on the way out — surface it before it bites. */
export const runtimeConfigLegacy: SourceRule = defineRule({
  id: 'nextjs/runtime-config-legacy',
  scope: 'source',
  title: 'Legacy runtime config (next/config) in use',
  description:
    'serverRuntimeConfig/publicRuntimeConfig are legacy and do not work with App Router. ' +
    'Migrate to environment variables (NEXT_PUBLIC_* for client values).',
  introducedIn: '16.0.0',
  severity: 'warning',
  fix: 'manual',
  sources: [
    {
      title: 'Runtime configuration (legacy) — next.config.js reference',
      url: 'https://nextjs.org/docs/pages/api-reference/config/next-config-js/runtime-configuration',
    },
    V16_GUIDE,
  ],
  textHints: ['next/config'],
  detect(sf, ctx) {
    return ast
      .importsFrom(sf, 'next/config')
      .map((decl) => ast.matchFromNode(decl, ctx.project.rootDir));
  },
});

/** Custom webpack config meets Turbopack-by-default in 16. */
export const webpackConfigWithTurbopack: ProjectRule = defineRule({
  id: 'nextjs/webpack-config-turbopack-default',
  scope: 'project',
  title: 'Custom webpack config with Turbopack as default bundler',
  description:
    'Next.js 16 uses Turbopack by default for dev and build. A custom webpack() function in ' +
    'next.config will not run under Turbopack — migrate the customization or explicitly opt ' +
    'back into webpack.',
  introducedIn: '16.0.0',
  severity: 'warning',
  fix: 'manual',
  sources: [V16_GUIDE],
  detect(ctx) {
    const matches: RuleMatch[] = [];
    for (const configPath of ctx.project.configFilePaths) {
      if (!/next\.config\.(js|mjs|ts)$/.test(configPath)) continue;
      const sf = ctx.ast.getFile(configPath);
      if (!sf) continue;
      sf.forEachDescendant((node) => {
        if (
          (ast.Node.isPropertyAssignment(node) || ast.Node.isMethodDeclaration(node)) &&
          node.getName() === 'webpack'
        ) {
          matches.push(ast.matchFromNode(node, ctx.project.rootDir));
        }
      });
    }
    return matches;
  },
});

/** images.domains is deprecated in favor of remotePatterns. */
export const imagesDomainsDeprecated: ProjectRule = defineRule({
  id: 'nextjs/images-domains-deprecated',
  scope: 'project',
  title: 'images.domains is deprecated — use remotePatterns',
  description:
    'The images.domains option is deprecated. Replace it with images.remotePatterns, which ' +
    'requires protocol/hostname and is stricter by design.',
  introducedIn: '15.0.0',
  severity: 'warning',
  fix: 'manual',
  sources: [
    {
      title: 'next/image API reference — remotePatterns',
      url: 'https://nextjs.org/docs/app/api-reference/components/image#remotepatterns',
    },
  ],
  detect(ctx) {
    const matches: RuleMatch[] = [];
    for (const configPath of ctx.project.configFilePaths) {
      if (!/next\.config\.(js|mjs|ts)$/.test(configPath)) continue;
      const sf = ctx.ast.getFile(configPath);
      if (!sf) continue;
      sf.forEachDescendant((node) => {
        if (!ast.Node.isPropertyAssignment(node)) return;
        if (node.getName() !== 'domains') return;
        const imagesAncestor = node.getFirstAncestor(
          (a) => ast.Node.isPropertyAssignment(a) && a.getName() === 'images',
        );
        if (imagesAncestor) {
          matches.push(ast.matchFromNode(node, ctx.project.rootDir));
        }
      });
    }
    return matches;
  },
});
