/**
 * @sigilry/splice-dars - Splice DAR file paths
 *
 * Provides resolved paths to Splice DAR files for use with @sigilry/cli codegen.
 * DARs are extracted from the GitHub release tarball during package preparation.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const darsDir = join(__dirname, "../dars");

/**
 * Paths to Splice DAR files
 */
export const spliceDars = {
  /** splice-amulet - Core Amulet contracts (AmuletRules, TransferPreapproval, etc.) */
  amulet: join(darsDir, "splice-amulet-0.1.16.dar"),

  /** splice-util - Shared utility modules */
  util: join(darsDir, "splice-util-0.1.5.dar"),

  /** splice-api-featured-app-v1 - Featured app API */
  apiFeaturedApp: join(darsDir, "splice-api-featured-app-v1-1.0.0.dar"),

  /** splice-api-token-allocation-instruction-v1 */
  apiTokenAllocationInstruction: join(
    darsDir,
    "splice-api-token-allocation-instruction-v1-1.0.0.dar",
  ),

  /** splice-api-token-allocation-request-v1 */
  apiTokenAllocationRequest: join(darsDir, "splice-api-token-allocation-request-v1-1.0.0.dar"),

  /** splice-api-token-allocation-v1 */
  apiTokenAllocation: join(darsDir, "splice-api-token-allocation-v1-1.0.0.dar"),

  /** splice-api-token-burn-mint-v1 */
  apiTokenBurnMint: join(darsDir, "splice-api-token-burn-mint-v1-1.0.0.dar"),

  /** splice-api-token-holding-v1 */
  apiTokenHolding: join(darsDir, "splice-api-token-holding-v1-1.0.0.dar"),

  /** splice-api-token-metadata-v1 */
  apiTokenMetadata: join(darsDir, "splice-api-token-metadata-v1-1.0.0.dar"),

  /** splice-api-token-transfer-instruction-v1 */
  apiTokenTransferInstruction: join(darsDir, "splice-api-token-transfer-instruction-v1-1.0.0.dar"),

  /** splice-util-batched-markers - Batched marker utilities */
  utilBatchedMarkers: join(darsDir, "splice-util-batched-markers-1.0.1.dar"),

  /** splice-util-token-standard-wallet - Token standard wallet utilities */
  utilTokenStandardWallet: join(darsDir, "splice-util-token-standard-wallet-1.0.0.dar"),
} as const;

/** All DAR file paths */
export const allSpliceDars: readonly string[] = Object.values(spliceDars);

/** Splice version this package provides DARs for */
export const SPLICE_VERSION = "0.5.14";
