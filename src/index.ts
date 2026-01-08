import type { ESLint, Linter } from "eslint";
import { ci, diff, staged } from "./processors";
import { PLUGIN_NAME, PLUGIN_VERSION } from "./version";

/**
 * Plugin metadata
 */
const meta = {
  name: PLUGIN_NAME,
  version: PLUGIN_VERSION,
};

/**
 * The three processors provided by this plugin:
 * - diff: Lint lines changed compared to a base commit/branch
 * - staged: Lint only staged lines (for pre-commit hooks)
 * - ci: Same as diff, but only active when CI env var is set
 */
const processors = { ci, diff, staged };

/**
 * The plugin object - exported as default for ESM usage
 */
const plugin: ESLint.Plugin = {
  meta,
  processors,
  configs: {} as Record<string, Linter.Config>,
};

/**
 * Flat config objects for ESLint 9+
 *
 * Usage:
 *   import diff from 'eslint-plugin-diff-flat-config';
 *   export default [
 *     diff.configs.diff,   // For CI - lint changed lines vs base branch
 *     // OR
 *     diff.configs.staged, // For pre-commit - lint only staged lines
 *   ];
 */
const configs: Record<string, Linter.Config> = {
  /**
   * Lint lines changed compared to a base commit/branch.
   * Set ESLINT_PLUGIN_DIFF_COMMIT to specify the base (defaults to HEAD).
   */
  diff: {
    name: "diff/diff",
    files: ["**/*"],
    plugins: { diff: plugin },
    processor: "diff/diff",
  },

  /**
   * Lint only staged lines - perfect for pre-commit hooks.
   * Only lines that are staged (git add) will be linted.
   */
  staged: {
    name: "diff/staged",
    files: ["**/*"],
    plugins: { diff: plugin },
    processor: "diff/staged",
  },

  /**
   * CI-aware config: In CI environments, lint changed lines.
   * Locally (when CI env var is not set), this config does nothing.
   */
  ci:
    process.env.CI !== undefined
      ? {
          name: "diff/ci",
          files: ["**/*"],
          plugins: { diff: plugin },
          processor: "diff/ci",
        }
      : {},
};

// Attach configs to the plugin object
plugin.configs = configs;

// Default export for ESM: import diff from 'eslint-plugin-diff'
export default plugin;

// Named exports for flexibility
export { configs, meta, processors };
