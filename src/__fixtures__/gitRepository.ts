import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const GIT_OPTIONS = {
  encoding: "utf8" as const,
  maxBuffer: 1024 * 1024 * 100,
};

type TestRepository = {
  directory: string;
  git(args: readonly string[]): string;
  write(relativePath: string, contents: string): void;
  commit(message: string): string;
  cleanup(): void;
};

const createTestRepository = (): TestRepository => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "eslint-plugin-diff-"));

  const git = (args: readonly string[]): string =>
    child_process.execFileSync("git", [...args], {
      ...GIT_OPTIONS,
      cwd: directory,
    });

  git(["init", "--quiet", "--initial-branch=main"]);
  git(["config", "user.email", "eslint-plugin-diff@example.invalid"]);
  git(["config", "user.name", "eslint-plugin-diff tests"]);

  const write = (relativePath: string, contents: string): void => {
    const filename = path.join(directory, relativePath);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, contents);
  };

  const commit = (message: string): string => {
    git(["add", "-A"]);
    git(["commit", "--quiet", "-m", message]);
    return git(["rev-parse", "HEAD"]).trim();
  };

  return {
    directory,
    git,
    write,
    commit,
    cleanup: () => fs.rmSync(directory, { recursive: true, force: true }),
  };
};

export type { TestRepository };
export { createTestRepository };
