const { CLIEngine } = require("eslint");

const cli = new CLIEngine({});

/**
 * @param {string[]} files
 */
const eslintFiles = (files) =>
  files.filter((file) => !cli.isPathIgnored(file)).join(" ");

module.exports = {
  "*.{html,json,md,yaml,yml}": ["prettier --write"],
  "*.{js,ts}": [
    () => "yarn run typecheck",
    "jest --bail --findRelatedTests",
    /**
     * @param {string[]} files
     */
    (files) => `eslint --fix ${eslintFiles(files)}`,
  ],
};
