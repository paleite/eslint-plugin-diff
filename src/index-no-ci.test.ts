/**
 * Tests for the plugin behavior when CI environment variable is NOT set.
 * This file must NOT set process.env.CI before importing the module.
 *
 * Note: Tests for diff/staged processors and configs are in index.test.ts.
 * This file only tests CI-specific behavior when CI env is NOT set.
 */

// Ensure CI is NOT set for this test file
delete process.env.CI;

import * as child_process from "child_process";

jest.mock("child_process");
const mockedChildProcess = jest.mocked(child_process, { shallow: true });
mockedChildProcess.execFileSync.mockReturnValue(
  Buffer.from("line1\nline2\nline3")
);

import { configs, processors } from "./index";

describe("plugin when CI env is NOT set", () => {
  it("should export ci processor as empty object when CI env is not set", () => {
    expect(process.env.CI).toBeUndefined();
    // When CI is not set, the ci processor should be an empty object
    expect(processors.ci).toEqual({});
  });

  it("should export ci config as empty object when CI env is not set", () => {
    expect(process.env.CI).toBeUndefined();
    // When CI is not set, the ci config should be an empty object
    expect(configs.ci).toEqual({});
  });

  it("ci config can be spread into array without breaking", () => {
    // Even when CI is not set, spreading the empty config should work
    const userConfig = [configs.ci];
    expect(Array.isArray(userConfig)).toBe(true);
    expect(userConfig[0]).toEqual({});
  });
});

