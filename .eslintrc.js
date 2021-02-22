/** @type import("eslint").Linter.BaseConfig<import("eslint").Linter.RulesRecord> */
module.exports = {
  env: { node: true },
  extends: [
    "eslint:recommended",
    "plugin:import/recommended",
    "plugin:promise/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/typescript",
    "prettier",
  ],
  noInlineConfig: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: [
      `${__dirname}/tsconfig.json`,
      `${__dirname}/tsconfig.eslint.json`,
    ],
  },
  reportUnusedDisableDirectives: true,
  root: true,
  rules: {
    curly: ["error", "all"],
    eqeqeq: "error",

    /**
     * TypeScript provides equivalent checks, so we turn them off
     * @see https://github.com/typescript-eslint/typescript-eslint/blob/master/docs/getting-started/linting/FAQ.md#eslint-plugin-import
     */
    "import/default": "off",
    "import/named": "off",
    "import/namespace": "off",
    "import/no-named-as-default-member": "off",
  },
  overrides: [
    {
      files: ["lint-staged.config.js"],

      rules: {
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
};
