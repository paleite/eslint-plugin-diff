/** @type import("eslint").Linter.Config */
module.exports = {
  root: true,
  extends: ["@paleite"],
  parserOptions: {
    project: [
      `${__dirname}/tsconfig.json`,
      `${__dirname}/tsconfig.eslint.json`,
    ],
  },
  overrides: [
    {
      files: ["lint-staged.config.js", "jest.config.js"],

      rules: {
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
};
