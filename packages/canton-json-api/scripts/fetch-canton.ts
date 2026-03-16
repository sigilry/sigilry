import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface VersionConfig {
  version: string;
  hash: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const configPath = join(__dirname, "version-config.json");
const apiSpecsDir = join(rootDir, "api-specs");

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function loadVersionConfig(): Promise<VersionConfig> {
  return JSON.parse(await Bun.file(configPath).text()) as VersionConfig;
}

function saveVersionConfig(config: VersionConfig): void {
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

async function sha256(filePath: string): Promise<string> {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest("hex")));
    stream.on("error", reject);
  });
}

async function downloadTarball(url: string, destinationPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`failed to download Canton archive: ${url} (${response.status})`);
  }

  const archiveBytes = new Uint8Array(await response.arrayBuffer());
  await Bun.write(destinationPath, archiveBytes);
}

function findOpenApiEntry(tarballPath: string): string {
  const output = execFileSync("tar", ["-tzf", tarballPath], { encoding: "utf8" });
  const entries = output.split("\n").filter(Boolean);

  const preferred = entries.find((entry) =>
    entry.endsWith("/openapi/json-ledger-api/openapi.yaml"),
  );
  if (preferred) return preferred;

  const legacy = entries.find((entry) =>
    entry.endsWith("/examples/09-json-api/typescript/openapi.yaml"),
  );
  if (legacy) return legacy;

  throw new Error("openapi/json-ledger-api/openapi.yaml not found in Canton archive");
}

function extractOpenApi(tarballPath: string, entry: string, destinationPath: string): void {
  const extractRoot = join(dirname(destinationPath), ".tmp-canton-openapi");
  rmSync(extractRoot, { recursive: true, force: true });
  mkdirSync(extractRoot, { recursive: true });

  execFileSync("tar", ["-xzf", tarballPath, "-C", extractRoot, entry], { stdio: "pipe" });

  const sourcePath = join(extractRoot, entry);
  copyFileSync(sourcePath, destinationPath);
  rmSync(extractRoot, { recursive: true, force: true });
}

async function main(): Promise<void> {
  const updateHash = hasFlag("updateHash");
  const config = await loadVersionConfig();
  const archiveUrl = `https://www.canton.io/releases/canton-open-source-${config.version}.tar.gz`;

  const cacheDir = join(rootDir, ".canton", config.version);
  const tarballPath = join(cacheDir, `canton-open-source-${config.version}.tar.gz`);
  const openApiPath = join(apiSpecsDir, "openapi.yaml");

  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(apiSpecsDir, { recursive: true });

  if (!existsSync(tarballPath)) {
    console.log(`Downloading ${archiveUrl}`);
    await downloadTarball(archiveUrl, tarballPath);
  }

  const downloadedHash = await sha256(tarballPath);

  if (updateHash || !config.hash) {
    config.hash = downloadedHash;
    saveVersionConfig(config);
    console.log(`Updated SHA256 hash for Canton ${config.version}`);
  } else if (downloadedHash !== config.hash) {
    throw new Error(
      `checksum mismatch for ${tarballPath}\nexpected: ${config.hash}\nreceived: ${downloadedHash}`,
    );
  }

  const entry = findOpenApiEntry(tarballPath);
  extractOpenApi(tarballPath, entry, openApiPath);

  console.log(`Wrote ${openApiPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`fetch-canton failed: ${message}`);
  process.exit(1);
});
