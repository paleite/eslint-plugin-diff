const typescriptProjects = ["./tsconfig.json", "./tsconfig.eslint.json"];

/** @type import("eslint").Linter.Config */
module.exports = {
  root: true,
  extends: ["@paleite"],
  parserOptions: { project: typescriptProjects, tsconfigRootDir: __dirname },
  overrides: [
    {
      files: [".*.js", "*.js"],

      rules: {
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
};
