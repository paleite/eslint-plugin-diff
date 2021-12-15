/**
 * npm-check-update
 *
 * Use npm-check-update to upgrade all packages in package.json
 *
 * Run `ncu`.
 */

module.exports = {
  upgrade: true,
  dep: "prod,dev",
  packageManager: "yarn",
};
