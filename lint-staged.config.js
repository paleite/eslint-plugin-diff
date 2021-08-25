const { eslintFiles } = require("eslint-files");

module.exports = {
  "*.{html,json,md,yaml,yml}": ["prettier --write"],
  "*.{js,ts}": [
    () => "yarn run typecheck",
    "jest --bail --findRelatedTests",
    /**
     * @param {string[]} files
     */
    async (files) =>
      `eslint --fix --max-warnings=0 ${await eslintFiles(files)}`,
    "prettier --write",
  ],
};
