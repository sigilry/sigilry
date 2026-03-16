/**
 * @sigilry/cli
 *
 * CLI and programmatic API for generating TypeScript types from DAML contracts.
 *
 * @example CLI usage:
 * ```bash
 * # Generate types from DARs
 * sigilry codegen
 *
 * # Watch mode
 * sigilry codegen --watch
 *
 * # Initialize config
 * sigilry init
 * ```
 *
 * @example Programmatic usage:
 * ```ts
 * import { generateTypes, loadConfig } from '@sigilry/cli'
 *
 * const config = await loadConfig()
 * await generateTypes(config)
 * ```
 */

export { generateTypes, watchDars } from "./codegen.js";
export type { SigilryConfig } from "./config.js";
export { defaultConfig, defineConfig, resolveConfig } from "./config.js";
export { loadConfig } from "./loader.js";
