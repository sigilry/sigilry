import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { findConfigFile } from "../src/loader.js";

describe("loader", () => {
  describe("findConfigFile", () => {
    let existsSyncSpy: ReturnType<typeof spyOn>;
    let statSyncSpy: ReturnType<typeof spyOn>;

    beforeEach(() => {
      existsSyncSpy = spyOn(fs, "existsSync");
      statSyncSpy = spyOn(fs, "statSync");
      statSyncSpy.mockImplementation(() => ({ isFile: () => true }));
    });

    afterEach(() => {
      existsSyncSpy.mockRestore();
      statSyncSpy.mockRestore();
    });

    test("finds sigilry.config.ts in the start directory", () => {
      const startDir = "/project";
      existsSyncSpy.mockImplementation((path) => {
        return String(path) === "/project/sigilry.config.ts";
      });

      const result = findConfigFile(startDir);
      expect(result).toBe("/project/sigilry.config.ts");
    });

    test("finds sigilry.config.mts when .ts is not present", () => {
      const startDir = "/project";
      existsSyncSpy.mockImplementation((path) => {
        return String(path) === "/project/sigilry.config.mts";
      });

      const result = findConfigFile(startDir);
      expect(result).toBe("/project/sigilry.config.mts");
    });

    test("finds sigilry.config.js when .ts/.mts are not present", () => {
      const startDir = "/project";
      existsSyncSpy.mockImplementation((path) => {
        return String(path) === "/project/sigilry.config.js";
      });

      const result = findConfigFile(startDir);
      expect(result).toBe("/project/sigilry.config.js");
    });

    test("finds sigilry.config.mjs when other formats are not present", () => {
      const startDir = "/project";
      existsSyncSpy.mockImplementation((path) => {
        return String(path) === "/project/sigilry.config.mjs";
      });

      const result = findConfigFile(startDir);
      expect(result).toBe("/project/sigilry.config.mjs");
    });

    test("prefers .ts over .js in the same directory", () => {
      const startDir = "/project";
      existsSyncSpy.mockImplementation((path) => {
        const p = String(path);
        return p === "/project/sigilry.config.ts" || p === "/project/sigilry.config.js";
      });

      const result = findConfigFile(startDir);
      expect(result).toBe("/project/sigilry.config.ts");
    });

    test("walks up directory tree to find config", () => {
      const startDir = "/project/src/components";
      existsSyncSpy.mockImplementation((path) => {
        return String(path) === "/project/sigilry.config.ts";
      });

      const result = findConfigFile(startDir);
      expect(result).toBe("/project/sigilry.config.ts");
    });

    test("returns undefined when no config file exists", () => {
      const startDir = "/project";
      existsSyncSpy.mockImplementation(() => false);

      const result = findConfigFile(startDir);
      expect(result).toBeUndefined();
    });

    test("skips directories and only matches files", () => {
      const startDir = "/project";
      existsSyncSpy.mockImplementation((path) => {
        return String(path) === "/project/sigilry.config.ts";
      });
      statSyncSpy.mockImplementation((path) => ({
        isFile: () => String(path) !== "/project/sigilry.config.ts", // sigilry.config.ts is a directory
      }));

      // Should not match the directory, should continue searching
      const result = findConfigFile(startDir);
      expect(result).not.toBe("/project/sigilry.config.ts");
    });

    test("uses process.cwd when no startDir provided", () => {
      // This test verifies the function works without arguments
      // Since we can't easily mock process.cwd in bun:test, we just verify it doesn't throw
      existsSyncSpy.mockImplementation(() => false);

      expect(() => findConfigFile()).not.toThrow();
    });
  });
});
