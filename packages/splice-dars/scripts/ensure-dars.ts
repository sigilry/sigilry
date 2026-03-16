#!/usr/bin/env bun

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const darsDir = join(packageRoot, "dars");
const requiredDars = ["splice-amulet-current.dar", "splice-wallet-payments-current.dar"] as const;

function missingDarPaths(): string[] {
  return requiredDars
    .filter((dar) => !existsSync(join(darsDir, dar)))
    .map((dar) => join(darsDir, dar));
}

function log(message: string) {
  console.error(`[splice-dars] ${message}`);
}

const initialMissing = missingDarPaths();
if (initialMissing.length === 0) {
  log("Required DAR files already present");
  process.exit(0);
}

log(`Missing DAR files. Running extraction: ${initialMissing.join(", ")}`);
execFileSync("bun", ["run", "scripts/extract-dars.ts"], {
  cwd: packageRoot,
  stdio: "inherit",
});

const remainingMissing = missingDarPaths();
if (remainingMissing.length > 0) {
  throw new Error(`Missing required DAR files after extraction: ${remainingMissing.join(", ")}`);
}

log("Required DAR files are ready");
