const typescriptProjects = ["./tsconfig.json", "./tsconfig.eslint.json"];

/** @type import("eslint").Linter.Config */
module.exports = {
  root: true,
  extends: ["@paleite"],
  parserOptions: { project: typescriptProjects, tsconfigRootDir: __dirname },
  rules: {
    "import/no-unused-modules": [
      "error",
      {
        missingExports: false,
        unusedExports: true,
        ignoreExports: ["src/index.ts"],
      },
    ],
  },
  overrides: [
    {
      files: [".*.js", "*.js"],

      rules: {
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
      },
    },
  ],
};
