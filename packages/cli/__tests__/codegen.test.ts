import { describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertJavaAvailable,
  type CodegenResult,
  generateTypes,
  watchDars,
} from "../src/codegen.js";
import type { SigilryConfig } from "../src/config.js";

/**
 * Capture a promise's rejection as an Error, or `undefined` if it resolves.
 *
 * Asserting on the returned value is unambiguous: a resolved promise yields
 * `undefined`, so message matchers fail loudly rather than silently passing.
 * (bun's `expect().rejects` matcher is typed as non-thenable, which makes
 * `await expect(...).rejects` read as a no-op — this sidesteps that.)
 */
async function rejectionOf(promise: Promise<unknown>): Promise<Error | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

describe("codegen", () => {
  describe("generateTypes", () => {
    const baseConfig: Required<SigilryConfig> = {
      dars: ["/path/to/nonexistent.dar"],
      output: join(tmpdir(), "sigilry-test-output"),
      cleanup: true,
      watch: false,
      dpmSdkVersion: "3.4.9",
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
      dpmSdkVersion: "3.4.9",
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

  describe("assertJavaAvailable", () => {
    test("throws an actionable error when no JVM is reachable", async () => {
      // Point at a path that cannot resolve so the spawn fails deterministically,
      // independent of whether the host has java installed.
      const error = await rejectionOf(
        assertJavaAvailable({ JAVA_BIN: "/nonexistent/path/to/java-xyz" }),
      );
      expect(error?.message).toMatch(/Java runtime/i);
    });

    test("the error references the #54 context and how to fix it", async () => {
      const error = await rejectionOf(
        assertJavaAvailable({ JAVA_BIN: "/nonexistent/path/to/java-xyz" }),
      );
      expect(error?.message).toMatch(/JAVA_HOME|JAVA_BIN/);
      expect(error?.message).toContain("#54");
    });

    test("rejects with a timeout error when the JVM probe hangs", async () => {
      // A fake "java" that ignores its args and hangs. The bounded preflight must
      // reject on the timeout rather than wait it out — proven by the message and
      // by returning well under the script's 30s sleep. Uses a tiny shell script
      // so the test never depends on a real (slow) JVM.
      const fakeJava = join(mkdtempSync(join(tmpdir(), "sigilry-java-")), "java");
      writeFileSync(fakeJava, "#!/bin/sh\nsleep 30\n", { mode: 0o755 });

      const startedAt = Date.now();
      const error = await rejectionOf(assertJavaAvailable({ JAVA_BIN: fakeJava }, 150));
      expect(error?.message).toMatch(/did not return within 150ms/);
      // Confirms the timeout fired instead of the suite waiting out the 30s sleep.
      expect(Date.now() - startedAt).toBeLessThan(10_000);
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
