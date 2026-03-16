#!/usr/bin/env bun
/**
 * Extract DAR files from Splice GitHub release tarball
 *
 * Downloads the release tarball, verifies its SHA256, and extracts DAR files
 * into the dars/ directory for use with @sigilry/cli codegen.
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");
const darsDir = join(packageRoot, "dars");

const SPLICE_VERSION = "0.5.14";
const TARBALL_URL = `https://github.com/digital-asset/decentralized-canton-sync/releases/download/v${SPLICE_VERSION}/${SPLICE_VERSION}_splice-node.tar.gz`;
const TARBALL_SHA256 = "7ec972d2051d5e37975bfa50015cfd8057ee1925285465a165a1b9e9ce6881ab";

const DARS = [
  "splice-amulet-0.1.16.dar",
  "splice-util-0.1.5.dar",
  "splice-api-featured-app-v1-1.0.0.dar",
  "splice-api-token-allocation-instruction-v1-1.0.0.dar",
  "splice-api-token-allocation-request-v1-1.0.0.dar",
  "splice-api-token-allocation-v1-1.0.0.dar",
  "splice-api-token-burn-mint-v1-1.0.0.dar",
  "splice-api-token-holding-v1-1.0.0.dar",
  "splice-api-token-metadata-v1-1.0.0.dar",
  "splice-api-token-transfer-instruction-v1-1.0.0.dar",
  "splice-util-batched-markers-1.0.1.dar",
  "splice-util-token-standard-wallet-1.0.0.dar",
] as const;

function log(msg: string) {
  console.error(`[splice-dars] ${msg}`);
}

function exec(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}

function checkDarsExist(): boolean {
  if (!existsSync(darsDir)) return false;
  for (const dar of DARS) {
    if (!existsSync(join(darsDir, dar))) return false;
  }
  return true;
}

function verifySha256(filePath: string, expected: string): void {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  const actual = hash.digest("hex");
  if (actual !== expected) {
    throw new Error(`SHA256 mismatch: expected ${expected}, got ${actual}`);
  }
}

async function main() {
  if (checkDarsExist()) {
    log("DARs already extracted, skipping extraction");
    const existing = readdirSync(darsDir).filter((f) => f.endsWith(".dar"));
    log(`Found ${existing.length} DAR files: ${existing.join(", ")}`);
    return;
  }

  log(`Extracting DARs from Splice v${SPLICE_VERSION} release tarball`);

  if (!existsSync(darsDir)) {
    mkdirSync(darsDir, { recursive: true });
  }

  const tmpDir = join(tmpdir(), `splice-dars-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    const tarball = join(tmpDir, "splice-node.tar.gz");

    log(`Downloading ${TARBALL_URL}`);
    exec(`curl -fSL -o ${tarball} "${TARBALL_URL}"`);

    log("Verifying SHA256...");
    verifySha256(tarball, TARBALL_SHA256);
    log("SHA256 verified");

    log("Extracting tarball...");
    exec(`tar xzf ${tarball} -C ${tmpDir}`);

    // Find and copy DAR files from extracted tarball
    const darFiles = exec(`find ${tmpDir} -name "*.dar" -type f`).split("\n").filter(Boolean);

    if (darFiles.length === 0) {
      throw new Error("No DAR files found in tarball");
    }

    log(`Found ${darFiles.length} DAR files in tarball`);

    let extracted = 0;
    for (const dar of DARS) {
      const source = darFiles.find((f) => f.endsWith(`/${dar}`));
      if (source) {
        exec(`cp "${source}" "${join(darsDir, dar)}"`);
        extracted++;
      } else {
        log(`Warning: ${dar} not found in tarball`);
      }
    }

    if (extracted === 0) {
      throw new Error("No expected DAR files were found in tarball");
    }

    log(`Successfully extracted ${extracted}/${DARS.length} DAR files`);
    const result = readdirSync(darsDir).filter((f) => f.endsWith(".dar"));
    log(`DARs: ${result.join(", ")}`);
  } finally {
    log("Cleaning up temp directory...");
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error("[splice-dars] Error:", err.message);
  process.exit(1);
});
