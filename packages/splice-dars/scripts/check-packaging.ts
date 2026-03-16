#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type NpmPackOutput = {
  filename: string;
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const requiredArchivePaths = [
  "package/dars/splice-amulet-current.dar",
  "package/dars/splice-wallet-payments-current.dar",
] as const;

function parseNpmPackOutput(output: string): NpmPackOutput {
  const parsed = JSON.parse(output) as NpmPackOutput[];
  if (!Array.isArray(parsed) || parsed.length === 0 || typeof parsed[0]?.filename !== "string") {
    throw new Error("npm pack --json returned unexpected output");
  }
  return parsed[0];
}

function log(message: string) {
  console.log(`[splice-dars] ${message}`);
}

execFileSync("bun", ["run", "scripts/ensure-dars.ts"], {
  cwd: packageRoot,
  stdio: "inherit",
});

const packJsonOutput = execFileSync("npm", ["pack", "--json", "--silent", "--ignore-scripts"], {
  cwd: packageRoot,
  encoding: "utf-8",
});

const { filename } = parseNpmPackOutput(packJsonOutput);
const archivePath = join(packageRoot, filename);

if (!existsSync(archivePath)) {
  throw new Error(`Expected npm pack archive not found: ${archivePath}`);
}

try {
  const archiveContents = execFileSync("tar", ["-tf", archivePath], {
    cwd: packageRoot,
    encoding: "utf-8",
  })
    .split("\n")
    .filter((line) => line.length > 0);

  const missingPaths = requiredArchivePaths.filter((entry) => !archiveContents.includes(entry));
  if (missingPaths.length > 0) {
    throw new Error(`Packed tarball is missing required DAR files: ${missingPaths.join(", ")}`);
  }

  log(`Packaging check passed for ${filename}`);
} finally {
  rmSync(archivePath, { force: true });
}
