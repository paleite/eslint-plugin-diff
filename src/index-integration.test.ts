import { ESLint, Linter } from "eslint";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as child_process from "child_process";

const createTempDir = () => {
  return fs.mkdtempSync(path.join(os.tmpdir(), "eslint-plugin-diff-int-"));
};

const runGit = (cwd: string, args: string[]) => {
  child_process.execFileSync("git", args, { cwd, stdio: "ignore" });
};

/**
 * Run a git command but don't fail if it errors (e.g., empty commits).
 * Useful for setup steps that might fail in certain environments.
 */
const runGitIgnoreErrors = (cwd: string, args: string[]) => {
  try {
    runGit(cwd, args);
  } catch {
    // Silently ignore errors (e.g., empty commits in some git versions)
  }
};

describe("integration", () => {
  let tmpDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Reset module cache so processors are recomputed for the new CWD
    jest.resetModules();
    
    originalCwd = process.cwd();
    tmpDir = createTempDir();
    process.chdir(tmpDir);

    runGit(tmpDir, ["init"]);
    // Configure git user for commits
    runGit(tmpDir, ["config", "user.email", "you@example.com"]);
    runGit(tmpDir, ["config", "user.name", "Your Name"]);
    // Initialize with a commit so we have a HEAD
    fs.writeFileSync(path.join(tmpDir, "README.md"), "# Test");
    
    runGit(tmpDir, ["add", "README.md"]);
    runGitIgnoreErrors(tmpDir, ["commit", "-m", "Initial commit"]);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it("should report errors on staged lines", async () => {
    const filename = "staged.js";
    const filePath = path.join(tmpDir, filename);
    
    // 1. Create file with valid content (with trailing newline to avoid git seeing it as changed)
    fs.writeFileSync(filePath, "var a = 1;\n");
    runGit(tmpDir, ["add", filename]);
    runGitIgnoreErrors(tmpDir, ["commit", "-m", "add file"]);
    
    // 2. Modify with error - add new line
    fs.writeFileSync(filePath, "var a = 1;\nvar b = 2;\n"); 
    runGit(tmpDir, ["add", filename]);
    
    // Now 'var b = 2;' is staged. 'var a = 1;' is unchanged.
    
    // Dynamically import plugin AFTER setting up the git repo
    // so that the diff file list is computed for this directory
    const plugin = (await import("./index")).default;
    
    const eslint = new ESLint({
      cwd: tmpDir,
      overrideConfigFile: true,
      overrideConfig: [
        {
            files: ["**/*.js"],
            rules: {
                "no-var": "error"
            }
        },
        plugin.configs!.staged as Linter.Config
      ],
    });

    const results = await eslint.lintFiles([filename]);
    
    expect(results[0]!.messages).toHaveLength(1);
    expect(results[0]!.messages[0]!.line).toBe(2);
    expect(results[0]!.messages[0]!.ruleId).toBe("no-var");
  });

  it("should report errors on changed lines in diff mode", async () => {
    const filename = "diff.js";
    const filePath = path.join(tmpDir, filename);
    
    // Initial content (with trailing newline to avoid git seeing it as changed)
    fs.writeFileSync(filePath, "var a = 1;\n");
    runGit(tmpDir, ["add", filename]);
    runGitIgnoreErrors(tmpDir, ["commit", "-m", "add diff file"]);
    
    // Modify - add new line
    fs.writeFileSync(filePath, "var a = 1;\nvar b = 2;\n");
    // Don't stage it. Diff mode looks at working directory vs HEAD.
    
    // Dynamically import plugin AFTER setting up the git repo
    // so that the diff file list is computed for this directory
    const plugin = (await import("./index")).default;
    
    const eslint = new ESLint({
      cwd: tmpDir,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.js"],
          rules: {
            "no-var": "error"
          }
        },
        plugin.configs!.diff as Linter.Config
      ],
    });

    const results = await eslint.lintFiles([filename]);
    
    expect(results[0]!.messages).toHaveLength(1);
    expect(results[0]!.messages[0]!.line).toBe(2);
    expect(results[0]!.messages[0]!.ruleId).toBe("no-var");
  });

  it("should NOT report errors on unchanged lines (negative test)", async () => {
    const filename = "unchanged.js";
    const filePath = path.join(tmpDir, filename);
    
    // Create file with lint errors on lines 1 and 2
    fs.writeFileSync(filePath, "var a = 1;\nvar b = 2;\n");
    runGit(tmpDir, ["add", filename]);
    runGitIgnoreErrors(tmpDir, ["commit", "-m", "add file with errors"]);
    
    // Add a new line (only line 3 should be flagged, lines 1-2 are unchanged)
    fs.writeFileSync(filePath, "var a = 1;\nvar b = 2;\nvar c = 3;\n");
    runGit(tmpDir, ["add", filename]);
    
    const plugin = (await import("./index")).default;
    
    const eslint = new ESLint({
      cwd: tmpDir,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.js"],
          rules: {
            "no-var": "error"
          }
        },
        plugin.configs!.staged as Linter.Config
      ],
    });

    const results = await eslint.lintFiles([filename]);
    
    // Only line 3 (the new line) should be reported, not lines 1-2
    expect(results[0]!.messages).toHaveLength(1);
    expect(results[0]!.messages[0]!.line).toBe(3);
    expect(results[0]!.messages[0]!.ruleId).toBe("no-var");
  });

  it("should work with ci config when CI env is set", async () => {
    // Set CI env before importing the plugin
    process.env.CI = "true";
    
    const filename = "ci-test.js";
    const filePath = path.join(tmpDir, filename);
    
    // Initial content
    fs.writeFileSync(filePath, "var a = 1;\n");
    runGit(tmpDir, ["add", filename]);
    runGitIgnoreErrors(tmpDir, ["commit", "-m", "add ci file"]);
    
    // Modify - add new line
    fs.writeFileSync(filePath, "var a = 1;\nvar b = 2;\n");
    
    const plugin = (await import("./index")).default;
    
    // When CI is set, ci config should work like diff config
    const eslint = new ESLint({
      cwd: tmpDir,
      overrideConfigFile: true,
      overrideConfig: [
        {
          files: ["**/*.js"],
          rules: {
            "no-var": "error"
          }
        },
        plugin.configs!.ci as Linter.Config
      ],
    });

    const results = await eslint.lintFiles([filename]);
    
    expect(results[0]!.messages).toHaveLength(1);
    expect(results[0]!.messages[0]!.line).toBe(2);
    expect(results[0]!.messages[0]!.ruleId).toBe("no-var");
    
    // Clean up CI env
    delete process.env.CI;
  });
});
