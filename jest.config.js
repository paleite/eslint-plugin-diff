const { base } = require("@paleite/jest-config");

/** @typedef {import('ts-jest')} */
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...base,
  coveragePathIgnorePatterns: [".test-d.ts"],
  coverageThreshold: {
    global: {
      statements: 100,
      branches: 89,
      functions: 100,
      lines: 100,
    },
  },
};
