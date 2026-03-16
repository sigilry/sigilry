import { afterEach, describe, expect, test } from "bun:test";
import { resolveDpmCommand } from "../src/dpm.js";

const originalDpmBin = process.env.DPM_BIN;

afterEach(() => {
  if (originalDpmBin === undefined) {
    delete process.env.DPM_BIN;
    return;
  }

  process.env.DPM_BIN = originalDpmBin;
});

describe("resolveDpmCommand", () => {
  test("uses dpm when DPM_BIN is unset", () => {
    delete process.env.DPM_BIN;

    expect(resolveDpmCommand()).toBe("dpm");
  });

  test("uses DPM_BIN when provided", () => {
    process.env.DPM_BIN = "/nix/store/example/bin/dpm";

    expect(resolveDpmCommand()).toBe("/nix/store/example/bin/dpm");
  });

  test("ignores empty DPM_BIN", () => {
    process.env.DPM_BIN = "   ";

    expect(resolveDpmCommand()).toBe("dpm");
  });
});
