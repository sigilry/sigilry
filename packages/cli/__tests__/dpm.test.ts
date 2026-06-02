import { afterEach, describe, expect, test } from "bun:test";
import {
  buildCodegenEnv,
  PINNED_DPM_SDK_VERSION,
  resolveDpmCommand,
  resolveJavaCommand,
} from "../src/dpm.js";

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

describe("buildCodegenEnv", () => {
  test("pins DPM_SDK_VERSION to the given version when unset", () => {
    const env = buildCodegenEnv({ PATH: "/usr/bin" }, "3.4.9");

    expect(env.DPM_SDK_VERSION).toBe("3.4.9");
    // preserves the rest of the environment
    expect(env.PATH).toBe("/usr/bin");
  });

  test("an explicit DPM_SDK_VERSION in the environment wins", () => {
    const env = buildCodegenEnv({ DPM_SDK_VERSION: "3.5.0" }, "3.4.9");

    expect(env.DPM_SDK_VERSION).toBe("3.5.0");
  });

  test("treats an empty DPM_SDK_VERSION as unset and applies the pin", () => {
    const env = buildCodegenEnv({ DPM_SDK_VERSION: "  " }, "3.4.9");

    expect(env.DPM_SDK_VERSION).toBe("3.4.9");
  });

  test("exports the pinned default constant", () => {
    expect(PINNED_DPM_SDK_VERSION).toBe("3.4.9");
  });
});

describe("resolveJavaCommand", () => {
  test("falls back to a PATH lookup of java", () => {
    expect(resolveJavaCommand({})).toBe("java");
  });

  test("prefers JAVA_HOME/bin/java", () => {
    expect(resolveJavaCommand({ JAVA_HOME: "/opt/jdk" })).toBe("/opt/jdk/bin/java");
  });

  test("JAVA_BIN wins over JAVA_HOME", () => {
    expect(resolveJavaCommand({ JAVA_BIN: "/custom/java", JAVA_HOME: "/opt/jdk" })).toBe(
      "/custom/java",
    );
  });

  test("ignores empty values", () => {
    expect(resolveJavaCommand({ JAVA_BIN: "  ", JAVA_HOME: "  " })).toBe("java");
  });
});
