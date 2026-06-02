import { describe, expect, test } from "bun:test";
import { defaultConfig, defineConfig, resolveConfig, type SigilryConfig } from "../src/config.js";

describe("config", () => {
  describe("defineConfig", () => {
    test("returns the config unchanged", () => {
      const config: SigilryConfig = {
        dars: ["./foo.dar"],
        output: "./out",
        watch: true,
      };
      expect(defineConfig(config)).toEqual(config);
    });

    test("preserves all optional fields", () => {
      const config: SigilryConfig = {
        dars: ["./a.dar", "./b.dar"],
        output: "./generated",
        cleanup: false,
        watch: true,
      };
      expect(defineConfig(config)).toEqual(config);
    });

    test("works with minimal config (dars only)", () => {
      const config: SigilryConfig = {
        dars: ["./single.dar"],
      };
      expect(defineConfig(config)).toEqual(config);
    });
  });

  describe("defaultConfig", () => {
    test("has expected default values", () => {
      expect(defaultConfig.output).toBe("./src/generated");
      expect(defaultConfig.cleanup).toBe(true);
      expect(defaultConfig.watch).toBe(false);
    });

    // Codegen is pinned to the last dpm SDK that still ships the alpha
    // `codegen-alpha-typescript` component (sigilry-private#54).
    test("pins dpm SDK version to 3.4.9 by default", () => {
      expect(defaultConfig.dpmSdkVersion).toBe("3.4.9");
    });
  });

  describe("resolveConfig", () => {
    test("merges user config with defaults", () => {
      const userConfig: SigilryConfig = {
        dars: ["./test.dar"],
      };
      const resolved = resolveConfig(userConfig);

      expect(resolved.dars).toEqual(["./test.dar"]);
      expect(resolved.output).toBe("./src/generated");
      expect(resolved.cleanup).toBe(true);
      expect(resolved.watch).toBe(false);
    });

    test("user values override defaults", () => {
      const userConfig: SigilryConfig = {
        dars: ["./a.dar"],
        output: "./custom/output",
        cleanup: false,
        watch: true,
      };
      const resolved = resolveConfig(userConfig);

      expect(resolved.dars).toEqual(["./a.dar"]);
      expect(resolved.output).toBe("./custom/output");
      expect(resolved.cleanup).toBe(false);
      expect(resolved.watch).toBe(true);
    });

    test("partial overrides work correctly", () => {
      const userConfig: SigilryConfig = {
        dars: ["./partial.dar"],
        cleanup: false,
        // output and watch use defaults
      };
      const resolved = resolveConfig(userConfig);

      expect(resolved.dars).toEqual(["./partial.dar"]);
      expect(resolved.output).toBe("./src/generated");
      expect(resolved.cleanup).toBe(false);
      expect(resolved.watch).toBe(false);
    });

    test("returns a new object, does not mutate input", () => {
      const userConfig: SigilryConfig = {
        dars: ["./immutable.dar"],
      };
      const resolved = resolveConfig(userConfig);

      expect(resolved).not.toBe(userConfig);
      expect(userConfig).not.toHaveProperty("output");
    });

    test("preserves multiple DAR files", () => {
      const userConfig: SigilryConfig = {
        dars: ["./one.dar", "./two.dar", "./three.dar"],
      };
      const resolved = resolveConfig(userConfig);

      expect(resolved.dars).toEqual(["./one.dar", "./two.dar", "./three.dar"]);
    });

    test("pins dpmSdkVersion by default and honors an override", () => {
      expect(resolveConfig({ dars: ["./a.dar"] }).dpmSdkVersion).toBe("3.4.9");
      expect(resolveConfig({ dars: ["./a.dar"], dpmSdkVersion: "3.4.7" }).dpmSdkVersion).toBe(
        "3.4.7",
      );
    });
  });
});
