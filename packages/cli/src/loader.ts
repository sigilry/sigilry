/**
 * Configuration file loader for sigilry.config.ts
 */
import { existsSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import debug from "debug";
import { resolveConfig, type SigilryConfig } from "./config.js";

// Register tsx loader for TypeScript config files
import "tsx/esm";

const log = debug("sigilry:loader");

/** Supported config file names in priority order */
const CONFIG_FILES = [
  "sigilry.config.ts",
  "sigilry.config.mts",
  "sigilry.config.js",
  "sigilry.config.mjs",
];

/** Result of loading a config file */
export interface LoadedConfig {
  config: Required<SigilryConfig>;
  configPath: string;
  configDir: string;
}

/**
 * Find the config file in the given directory or any parent directory.
 * Returns undefined if no config file is found.
 */
export function findConfigFile(startDir: string = process.cwd()): string | undefined {
  let dir = resolve(startDir);

  while (true) {
    for (const filename of CONFIG_FILES) {
      const candidate = join(dir, filename);
      if (existsSync(candidate) && statSync(candidate).isFile()) {
        log("found config at %s", candidate);
        return candidate;
      }
    }

    const parent = dirname(dir);
    if (parent === dir) {
      // Reached filesystem root
      log("no config file found starting from %s", startDir);
      return undefined;
    }
    dir = parent;
  }
}

/**
 * Load and parse a sigilry config file.
 *
 * Supports TypeScript (.ts, .mts) and JavaScript (.js, .mjs) configs.
 * TypeScript files are loaded using tsx/register or similar loaders
 * that the user has configured in their project.
 *
 * @param configPath - Path to the config file (optional, will search if not provided)
 * @throws Error if config file not found or invalid
 */
export async function loadConfig(configPath?: string): Promise<LoadedConfig> {
  const resolvedPath = configPath ?? findConfigFile();

  if (!resolvedPath) {
    throw new Error("No sigilry.config.ts found. Run `sigilry init` to create one.");
  }

  if (!existsSync(resolvedPath)) {
    throw new Error(`Config file not found: ${resolvedPath}`);
  }

  const configDir = dirname(resolvedPath);
  log("loading config from %s", resolvedPath);

  // Import the config file
  // For TypeScript files, this requires tsx or similar loader
  const configModule = await import(pathToFileURL(resolvedPath).href);
  const userConfig = configModule.default as SigilryConfig;

  if (!userConfig || typeof userConfig !== "object") {
    throw new Error(`Invalid config: ${resolvedPath} must export a default config object`);
  }

  if (!Array.isArray(userConfig.dars) || userConfig.dars.length === 0) {
    throw new Error(`Invalid config: 'dars' must be a non-empty array of DAR file paths`);
  }

  // Resolve relative paths against config directory
  const resolvedConfig = resolveConfig(userConfig);

  // Resolve DAR paths relative to config directory
  resolvedConfig.dars = resolvedConfig.dars.map((darPath) => resolve(configDir, darPath));

  // Resolve output path relative to config directory
  resolvedConfig.output = resolve(configDir, resolvedConfig.output);

  return {
    config: resolvedConfig,
    configPath: resolvedPath,
    configDir,
  };
}
