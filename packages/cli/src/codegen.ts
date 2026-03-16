/**
 * TypeScript code generation from DAML DARs
 *
 * Wraps `dpm codegen-alpha-typescript` to generate TypeScript types.
 */
import { execFile as execFileCallback } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { promisify } from "node:util";
import chokidar from "chokidar";
import debug from "debug";
import type { SigilryConfig } from "./config.js";
import { resolveDpmCommand } from "./dpm.js";

const execFile = promisify(execFileCallback);
const log = debug("sigilry:codegen");

/** Result of a codegen operation */
export interface CodegenResult {
  success: boolean;
  outputDir: string;
  darsProcessed: string[];
  error?: string;
}

/**
 * Generate TypeScript types from DAR files.
 *
 * @param config - Resolved configuration
 * @returns Result of the codegen operation
 */
export async function generateTypes(config: Required<SigilryConfig>): Promise<CodegenResult> {
  const { dars, output, cleanup } = config;

  // Validate DAR files exist
  const missingDars = dars.filter((dar) => !existsSync(dar));
  if (missingDars.length > 0) {
    return {
      success: false,
      outputDir: output,
      darsProcessed: [],
      error: `DAR files not found: ${missingDars.join(", ")}`,
    };
  }

  // Ensure output directory exists
  if (!existsSync(output)) {
    mkdirSync(output, { recursive: true });
    log("created output directory %s", output);
  }

  const dpmCommand = resolveDpmCommand();
  const args = ["codegen-alpha-typescript", "generate"];
  for (const dar of dars) {
    args.push("--dar", dar);
  }
  args.push("--output", output);
  if (cleanup) {
    args.push("--cleanup");
  }

  log("executing: %s %O", dpmCommand, args);

  try {
    const { stdout, stderr } = await execFile(dpmCommand, args);

    if (stdout) {
      log("stdout: %s", stdout);
    }
    if (stderr) {
      // dpm may output info to stderr
      log("stderr: %s", stderr);
    }

    log("codegen complete: %d DARs -> %s", dars.length, output);

    return {
      success: true,
      outputDir: output,
      darsProcessed: dars,
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    log("codegen failed: %s", error);

    return {
      success: false,
      outputDir: output,
      darsProcessed: [],
      error,
    };
  }
}

/**
 * Watch DAR files and regenerate types on changes.
 *
 * @param config - Resolved configuration
 * @param onChange - Callback when regeneration completes
 * @returns Cleanup function to stop watching
 */
export function watchDars(
  config: Required<SigilryConfig>,
  onChange?: (result: CodegenResult) => void,
): () => void {
  const { dars } = config;

  log("watching %d DAR files", dars.length);

  const watcher = chokidar.watch(dars, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 500,
      pollInterval: 100,
    },
  });

  const handleChange = async (path: string) => {
    log("DAR changed: %s", path);
    console.log(`\n[sigilry] DAR changed: ${path}`);
    console.log("[sigilry] Regenerating types...");

    const result = await generateTypes(config);

    if (result.success) {
      console.log(`[sigilry] Generated types in ${result.outputDir}`);
    } else {
      console.error(`[sigilry] Codegen failed: ${result.error}`);
    }

    onChange?.(result);
  };

  watcher.on("change", handleChange);
  watcher.on("add", handleChange);

  return () => {
    log("stopping watcher");
    watcher.close();
  };
}
