import { describe, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type CodegenResult, generateTypes, watchDars } from "../src/codegen.js";
import type { SigilryConfig } from "../src/config.js";

describe("codegen", () => {
  describe("generateTypes", () => {
    const baseConfig: Required<SigilryConfig> = {
      dars: ["/path/to/nonexistent.dar"],
      output: join(tmpdir(), "sigilry-test-output"),
      cleanup: true,
      watch: false,
    };

    test("returns error when DAR files do not exist", async () => {
      const result = await generateTypes(baseConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain("DAR files not found");
      expect(result.error).toContain("/path/to/nonexistent.dar");
      expect(result.darsProcessed).toEqual([]);
    });

    test("handles multiple missing DAR files", async () => {
      const multiConfig: Required<SigilryConfig> = {
        ...baseConfig,
        dars: ["/path/missing1.dar", "/path/missing2.dar"],
      };

      const result = await generateTypes(multiConfig);

      expect(result.success).toBe(false);
      expect(result.error).toContain("missing1.dar");
      expect(result.error).toContain("missing2.dar");
    });

    test("result includes output directory", async () => {
      const result = await generateTypes(baseConfig);

      expect(result.outputDir).toBe(baseConfig.output);
    });

    test("empty darsProcessed on error", async () => {
      const result = await generateTypes(baseConfig);

      expect(result.darsProcessed).toEqual([]);
    });
  });

  describe("watchDars", () => {
    const baseConfig: Required<SigilryConfig> = {
      dars: ["/path/to/test.dar"],
      output: "/path/to/output",
      cleanup: true,
      watch: true,
    };

    test("returns a cleanup function", () => {
      const cleanup = watchDars(baseConfig);

      expect(typeof cleanup).toBe("function");

      // Call cleanup to close the watcher
      cleanup();
    });

    test("cleanup function is callable without error", () => {
      const cleanup = watchDars(baseConfig);

      expect(() => cleanup()).not.toThrow();
    });

    test("accepts onChange callback", () => {
      const onChangeResults: CodegenResult[] = [];
      const cleanup = watchDars(baseConfig, (result) => {
        onChangeResults.push(result);
      });

      // Just verify it accepts the callback without error
      expect(typeof cleanup).toBe("function");
      cleanup();
    });
  });

  describe("CodegenResult type", () => {
    test("success result has expected shape", () => {
      const successResult: CodegenResult = {
        success: true,
        outputDir: "/output",
        darsProcessed: ["/path/a.dar", "/path/b.dar"],
      };

      expect(successResult.success).toBe(true);
      expect(successResult.error).toBeUndefined();
    });

    test("error result has expected shape", () => {
      const errorResult: CodegenResult = {
        success: false,
        outputDir: "/output",
        darsProcessed: [],
        error: "Something went wrong",
      };

      expect(errorResult.success).toBe(false);
      expect(errorResult.error).toBeDefined();
    });
  });
});
