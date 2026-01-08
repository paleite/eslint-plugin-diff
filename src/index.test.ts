process.env.CI = "true";
import * as child_process from "child_process";

jest.mock("child_process");
const mockedChildProcess = jest.mocked(child_process, { shallow: true });
mockedChildProcess.execFileSync.mockReturnValue(
  Buffer.from("line1\nline2\nline3")
);

import plugin, { configs, meta, processors } from "./index";
import { PLUGIN_NAME, PLUGIN_VERSION } from "./version";

describe("plugin", () => {
  it("should have correct meta information", () => {
    expect(meta).toEqual({
      name: PLUGIN_NAME,
      version: PLUGIN_VERSION,
    });
  });

  it("should export plugin as default with meta, processors, and configs", () => {
    expect(plugin).toHaveProperty("meta");
    expect(plugin).toHaveProperty("processors");
    expect(plugin).toHaveProperty("configs");
    expect(plugin.meta).toBe(meta);
    expect(plugin.processors).toBe(processors);
    expect(plugin.configs).toBe(configs);
  });

  it("should export all three processors", () => {
    expect(processors).toHaveProperty("ci");
    expect(processors).toHaveProperty("diff");
    expect(processors).toHaveProperty("staged");
  });

  it("should have preprocess and postprocess functions in each processor", () => {
    expect(processors.diff).toHaveProperty("preprocess");
    expect(processors.diff).toHaveProperty("postprocess");
    expect(processors.diff).toHaveProperty("supportsAutofix", true);

    expect(processors.staged).toHaveProperty("preprocess");
    expect(processors.staged).toHaveProperty("postprocess");
    expect(processors.staged).toHaveProperty("supportsAutofix", true);

    // CI processor is only populated when CI env is set (which it is in this test)
    expect(processors.ci).toHaveProperty("preprocess");
    expect(processors.ci).toHaveProperty("postprocess");
    expect(processors.ci).toHaveProperty("supportsAutofix", true);
  });
});

describe("flat configs", () => {
  it("should export diff config in flat config format", () => {
    expect(configs.diff).toHaveProperty("name", "diff/diff");
    expect(configs.diff).toHaveProperty("files");
    expect(configs.diff).toHaveProperty("processor", "diff/diff");
    expect(configs.diff).toHaveProperty("plugins");
    expect((configs.diff as { plugins: { diff: unknown } }).plugins.diff).toBe(plugin);
  });

  it("should export staged config in flat config format", () => {
    expect(configs.staged).toHaveProperty("name", "diff/staged");
    expect(configs.staged).toHaveProperty("files");
    expect(configs.staged).toHaveProperty("processor", "diff/staged");
    expect(configs.staged).toHaveProperty("plugins");
    expect((configs.staged as { plugins: { diff: unknown } }).plugins.diff).toBe(plugin);
  });

  it("should export ci config in flat config format when CI env is set", () => {
    // CI env is set at the top of this file
    expect(configs.ci).toHaveProperty("name", "diff/ci");
    expect(configs.ci).toHaveProperty("files");
    expect(configs.ci).toHaveProperty("processor", "diff/ci");
    expect(configs.ci).toHaveProperty("plugins");
    expect((configs.ci as { plugins: { diff: unknown } }).plugins.diff).toBe(plugin);
  });

  it("should have configs that can be spread into an array", () => {
    // This simulates how users would use the configs
    const userConfig = [configs.diff];
    expect(Array.isArray(userConfig)).toBe(true);
    expect(userConfig[0]).toHaveProperty("processor", "diff/diff");
  });
});
