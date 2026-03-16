import { afterEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packageRoot = join(import.meta.dir, "..");
const cliEntrypoint = "src/cli.ts";
const decoder = new TextDecoder();

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

interface CliRunResult {
  exitCode: number | null;
  stderr: string;
  stdout: string;
}

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "sigilry-cli-test-"));
  tempDirs.push(dir);
  return dir;
}

function createDpmScript(contents: string, mode: number = 0o755): string {
  const dir = createTempDir();
  const scriptPath = join(dir, "dpm");
  writeFileSync(scriptPath, contents);
  chmodSync(scriptPath, mode);
  return scriptPath;
}

function runCodegenWithDpmBin(dpmBin: string): CliRunResult {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }
  env.DPM_BIN = dpmBin;

  const processResult = Bun.spawnSync({
    cmd: [process.execPath, "run", cliEntrypoint, "codegen"],
    cwd: packageRoot,
    env,
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: processResult.exitCode,
    stdout: decoder.decode(processResult.stdout),
    stderr: decoder.decode(processResult.stderr),
  };
}

describe("cli dpm preflight checks", () => {
  test("reports not found guidance for missing dpm binary", () => {
    const missingDpm = join(createTempDir(), "missing-dpm");
    const result = runCodegenWithDpmBin(missingDpm);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[sigilry] Error: dpm CLI not found.");
    expect(result.stderr).toContain(`[sigilry] Tried DPM_BIN=${missingDpm}`);
    expect(result.stderr).toContain("Please install the DAML SDK");
  });

  test("reports EACCES without masking it as not-found", () => {
    const nonExecutableDpm = createDpmScript("#!/usr/bin/env sh\necho should-not-run\n", 0o644);
    const result = runCodegenWithDpmBin(nonExecutableDpm);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[sigilry] Error: dpm CLI is not executable (EACCES).");
    expect(result.stderr).toContain(`[sigilry] Tried DPM_BIN=${nonExecutableDpm}`);
    expect(result.stderr).not.toContain("dpm CLI not found");
    expect(result.stderr).not.toContain("Please install the DAML SDK");
  });

  test("surfaces stderr for non-zero dpm runtime failure", () => {
    const failingDpm = createDpmScript(
      "#!/usr/bin/env sh\necho runtime-failure-from-dpm >&2\nexit 23\n",
    );
    const result = runCodegenWithDpmBin(failingDpm);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[sigilry] Error: failed to run dpm CLI.");
    expect(result.stderr).toContain("[sigilry] dpm exit code: 23");
    expect(result.stderr).toContain("[sigilry] runtime-failure-from-dpm");
    expect(result.stderr).not.toContain("dpm CLI not found");
  });

  test("falls back to stdout when stderr is empty", () => {
    const failingDpm = createDpmScript("#!/usr/bin/env sh\necho stdout-only-failure\nexit 19\n");
    const result = runCodegenWithDpmBin(failingDpm);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("[sigilry] Error: failed to run dpm CLI.");
    expect(result.stderr).toContain("[sigilry] dpm exit code: 19");
    expect(result.stderr).toContain("[sigilry] stdout-only-failure");
    expect(result.stderr).not.toContain("Please install the DAML SDK");
  });
});
