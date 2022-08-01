const { base } = require("@paleite/jest-config");

/** @typedef {import('ts-jest')} */
/** @type {import('@jest/types').Config.InitialOptions} */
module.exports = {
  ...base,
  coveragePathIgnorePatterns: [".test-d.ts"],
  coverageThreshold: {
    global: {
      statements: 97,
      branches: 84,
      functions: 100,
      lines: 97,
    },
  },
};
