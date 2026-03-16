/**
 * Configuration types for @sigilry/cli
 *
 * Users define a sigilry.config.ts in their project root.
 *
 * @example
 * ```ts
 * // sigilry.config.ts
 * import { defineConfig } from '@sigilry/cli/config'
 *
 * export default defineConfig({
 *   dars: ['./dars/splice-wallet-0.1.0.dar'],
 *   output: './src/generated',
 *   watch: false,
 * })
 * ```
 */

/**
 * CLI configuration options
 */
export interface SigilryConfig {
  /**
   * Path(s) to DAR files to generate types from.
   * Can be absolute or relative to the config file location.
   */
  dars: string[];

  /**
   * Output directory for generated TypeScript files.
   * Defaults to './src/generated'
   */
  output?: string;

  /**
   * Clean output directory before generating.
   * Defaults to true.
   */
  cleanup?: boolean;

  /**
   * Enable watch mode to regenerate on DAR changes.
   * Defaults to false.
   */
  watch?: boolean;
}

/**
 * Type-safe helper for defining configuration.
 *
 * @example
 * ```ts
 * import { defineConfig } from '@sigilry/cli/config'
 *
 * export default defineConfig({
 *   dars: ['./splice-wallet.dar'],
 *   output: './src/generated',
 * })
 * ```
 */
export function defineConfig(config: SigilryConfig): SigilryConfig {
  return config;
}

/**
 * Default configuration values
 */
export const defaultConfig: Required<Omit<SigilryConfig, "dars">> = {
  output: "./src/generated",
  cleanup: true,
  watch: false,
};

/**
 * Merge user config with defaults
 */
export function resolveConfig(userConfig: SigilryConfig): Required<SigilryConfig> {
  return {
    ...defaultConfig,
    ...userConfig,
  };
}
