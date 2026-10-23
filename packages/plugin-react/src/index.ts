import { definePlugin, detectPackage, type MigrationPlugin } from '@upgrade-assistant/core';
import { domHydrateRemoved, domRenderRemoved, unmountRemoved } from './rules/dom-render.js';
import { defaultPropsRemoved, propTypesRemoved } from './rules/prop-types.js';
import { testUtilsActMoved } from './rules/test-utils-act.js';
import { useRefRequiresArgument } from './rules/use-ref-argument.js';
import {
  contextProviderShorthand,
  createFactoryRemoved,
  forwardRefDeprecation,
  stringRefsRemoved,
} from './rules/misc.js';

/**
 * React migration plugin.
 *
 * Knowledge base: React 19 (18 → 19). Every rule cites the official
 * upgrade guide or react.dev reference pages. Autofixes cover the
 * mechanical changes; everything judgment-based points to the official
 * codemod recipe or the manual checklist.
 */
const reactPlugin: MigrationPlugin = definePlugin({
  name: 'react',
  displayName: 'React',
  packageName: 'react',
  relatedPackages: ['react-dom', '@types/react', '@types/react-dom'],
  detect: (project) => detectPackage(project, 'react'),
  rules: [
    domRenderRemoved,
    domHydrateRemoved,
    unmountRemoved,
    propTypesRemoved,
    defaultPropsRemoved,
    stringRefsRemoved,
    createFactoryRemoved,
    testUtilsActMoved,
    useRefRequiresArgument,
    forwardRefDeprecation,
    contextProviderShorthand,
  ],
});

export default reactPlugin;
