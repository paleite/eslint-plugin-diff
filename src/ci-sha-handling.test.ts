/**
 * Tests for CI mode handling of commit SHAs vs branch names.
 *
 * Bug: When ESLINT_PLUGIN_DIFF_COMMIT is set to a commit SHA (e.g., "abc123"),
 * the code incorrectly transforms it to "origin/abc123", which is not a valid
 * git ref and causes git diff to fail.
 *
 * The fix should detect commit SHAs and NOT prepend "origin/" to them.
 */

// Must mock child_process BEFORE any imports that use it
jest.mock("child_process", () => ({
  execFileSync: jest.fn().mockReturnValue(Buffer.from("")),
}));

import * as child_process from "child_process";

const mockedExecFileSync = child_process.execFileSync as jest.MockedFunction<
  typeof child_process.execFileSync
>;

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
  // Clear all known CI provider env vars to avoid conflicts
  delete process.env.GITHUB_BASE_REF;
  delete process.env.SYSTEM_PULLREQUEST_TARGETBRANCH;
  delete process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME;
  delete process.env.CI_EXTERNAL_PULL_REQUEST_TARGET_BRANCH_NAME;
  delete process.env.ESLINT_PLUGIN_DIFF_COMMIT;
  delete process.env.CI;
  // Reset and set up mock
  mockedExecFileSync.mockReset();
  mockedExecFileSync.mockReturnValue(Buffer.from(""));
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe("CI SHA handling", () => {
  it("should NOT transform a commit SHA to origin/<sha>", async () => {
    // Set up CI environment with a commit SHA (short form)
    process.env.CI = "true";
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = "abc123def456";

    // Import the module - this triggers the top-level CI code
    await import("./processors");

    // The SHA should NOT be transformed to "origin/abc123def456"
    // Current buggy behavior: it transforms to "origin/abc123def456"
    // Expected behavior: it should remain as "abc123def456"
    expect(process.env.ESLINT_PLUGIN_DIFF_COMMIT).not.toBe(
      "origin/abc123def456"
    );
    expect(process.env.ESLINT_PLUGIN_DIFF_COMMIT).toBe("abc123def456");
  });

  it("should NOT transform a full 40-char SHA to origin/<sha>", async () => {
    process.env.CI = "true";
    process.env.ESLINT_PLUGIN_DIFF_COMMIT =
      "abc123def456789012345678901234567890abcd";

    await import("./processors");

    // Full SHA should not be transformed
    expect(process.env.ESLINT_PLUGIN_DIFF_COMMIT).toBe(
      "abc123def456789012345678901234567890abcd"
    );
  });

  it("should still transform branch names to origin/<branch>", async () => {
    process.env.CI = "true";
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = "main";

    await import("./processors");

    // Branch names should still get the origin/ prefix
    expect(process.env.ESLINT_PLUGIN_DIFF_COMMIT).toBe("origin/main");
  });

  it("should handle branch names with slashes like feature/my-branch", async () => {
    process.env.CI = "true";
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = "feature/my-branch";

    await import("./processors");

    // Branch names with slashes should get origin/ prefix
    expect(process.env.ESLINT_PLUGIN_DIFF_COMMIT).toBe(
      "origin/feature/my-branch"
    );
  });

  it("should NOT transform refs like HEAD~5", async () => {
    process.env.CI = "true";
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = "HEAD~5";

    await import("./processors");

    // Relative refs should not be transformed
    expect(process.env.ESLINT_PLUGIN_DIFF_COMMIT).toBe("HEAD~5");
  });

  it("should NOT transform refs with caret like HEAD^", async () => {
    process.env.CI = "true";
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = "HEAD^";

    await import("./processors");

    // Caret refs should not be transformed
    expect(process.env.ESLINT_PLUGIN_DIFF_COMMIT).toBe("HEAD^");
  });

  it("should preserve origin/ prefix if already present", async () => {
    process.env.CI = "true";
    process.env.ESLINT_PLUGIN_DIFF_COMMIT = "origin/main";

    await import("./processors");

    // Should not double the prefix
    expect(process.env.ESLINT_PLUGIN_DIFF_COMMIT).toBe("origin/main");
  });
});
