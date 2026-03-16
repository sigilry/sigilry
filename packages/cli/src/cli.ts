#!/usr/bin/env node
/**
 * @sigilry/cli - Command line interface
 *
 * Usage:
 *   sigilry codegen           Generate TypeScript from DARs
 *   sigilry codegen --watch   Watch mode
 *   sigilry init              Create sigilry.config.ts
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import debug from "debug";
import { generateTypes, watchDars } from "./codegen.js";
import { resolveDpmCommand } from "./dpm.js";
import { loadConfig } from "./loader.js";

const _log = debug("sigilry:cli");

const program = new Command();

program
  .name("sigilry")
  .description("CLI for generating TypeScript types from DAML contracts")
  .version("0.1.0");

/**
 * Check that dpm CLI is available (only needed for codegen)
 */
async function ensureDpmAvailable(): Promise<void> {
  const dpmCommand = resolveDpmCommand();

  try {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const execFileAsync = promisify(execFile);
    await execFileAsync(dpmCommand, ["--version"]);
  } catch (error) {
    const failure = parseExecFailure(error);
    const notFoundFailure = isNotFoundFailure(failure.code, failure.message);

    if (notFoundFailure) {
      console.error("[sigilry] Error: dpm CLI not found.");
    } else if (failure.code === "EACCES") {
      console.error("[sigilry] Error: dpm CLI is not executable (EACCES).");
    } else {
      console.error("[sigilry] Error: failed to run dpm CLI.");
      if (typeof failure.code === "number") {
        console.error(`[sigilry] dpm exit code: ${failure.code}`);
      } else if (typeof failure.code === "string") {
        console.error(`[sigilry] dpm error code: ${failure.code}`);
      }
    }

    if (process.env.DPM_BIN) {
      console.error(`[sigilry] Tried DPM_BIN=${process.env.DPM_BIN}`);
    }

    if (!notFoundFailure) {
      const processOutput = firstNonEmptyString(failure.stderr, failure.stdout, failure.message);
      if (processOutput) {
        console.error(`[sigilry] ${processOutput}`);
      }
    }

    if (notFoundFailure) {
      console.error(
        "[sigilry] Please install the DAML SDK: https://docs.daml.com/getting-started/installation.html",
      );
    }

    process.exit(1);
  }
}

interface ExecFailure {
  code?: string | number | null;
  stderr?: unknown;
  stdout?: unknown;
  message?: string;
}

function parseExecFailure(error: unknown): ExecFailure {
  if (error && typeof error === "object") {
    const failure = error as Partial<ExecFailure>;
    return {
      code: failure.code,
      stderr: failure.stderr,
      stdout: failure.stdout,
      message: error instanceof Error ? error.message : undefined,
    };
  }

  if (typeof error === "string") {
    return { message: error };
  }

  return { message: undefined };
}

function isNotFoundFailure(code: ExecFailure["code"], message?: string): boolean {
  if (code === "ENOENT") {
    return true;
  }

  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes("enoent") || normalized.includes("not found");
}

function valueToTrimmedString(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (value instanceof Uint8Array) {
    const trimmed = Buffer.from(value).toString("utf8").trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  return undefined;
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const normalized = valueToTrimmedString(value);
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

program
  .command("codegen")
  .description("Generate TypeScript types from DAR files")
  .option("-c, --config <path>", "Path to config file")
  .option("-w, --watch", "Watch for changes and regenerate")
  .action(async (options: { config?: string; watch?: boolean }) => {
    try {
      // Check for dpm availability (only needed for codegen, not init)
      await ensureDpmAvailable();

      const { config, configPath } = await loadConfig(options.config);

      console.log(`[sigilry] Using config: ${configPath}`);
      console.log(`[sigilry] DARs: ${config.dars.join(", ")}`);
      console.log(`[sigilry] Output: ${config.output}`);

      // Initial generation
      console.log("[sigilry] Generating types...");
      const result = await generateTypes(config);

      if (!result.success) {
        console.error(`[sigilry] Error: ${result.error}`);
        process.exit(1);
      }

      console.log(`[sigilry] Generated types in ${result.outputDir}`);

      // Watch mode
      if (options.watch || config.watch) {
        console.log("[sigilry] Watching for changes... (Ctrl+C to stop)");
        const stop = watchDars(config);

        process.on("SIGINT", () => {
          console.log("\n[sigilry] Stopping watch...");
          stop();
          process.exit(0);
        });

        // Keep process alive
        await new Promise(() => {});
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sigilry] Error: ${message}`);
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Create a sigilry.config.ts file")
  .option("-f, --force", "Overwrite existing config")
  .action((options: { force?: boolean }) => {
    const configPath = join(process.cwd(), "sigilry.config.ts");

    if (existsSync(configPath) && !options.force) {
      console.error("[sigilry] Config already exists. Use --force to overwrite.");
      process.exit(1);
    }

    const template = `import { defineConfig } from '@sigilry/cli/config'

export default defineConfig({
  // Path(s) to DAR files to generate types from
  dars: [
    // './path/to/your.dar',
  ],

  // Output directory for generated TypeScript files
  output: './src/generated',

  // Clean output directory before generating (default: true)
  cleanup: true,

  // Enable watch mode (default: false)
  watch: false,
})
`;

    writeFileSync(configPath, template);
    console.log(`[sigilry] Created ${configPath}`);
    console.log("[sigilry] Edit the file to add your DAR paths, then run: sigilry codegen");
  });

program.parse();
