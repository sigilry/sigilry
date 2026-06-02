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
import { PINNED_DPM_SDK_VERSION } from "./dpm.js";

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

  /**
   * dpm SDK version to pin codegen to.
   *
   * The `codegen-alpha-typescript` generator only ships through dpm SDK 3.4.9;
   * newer SDKs dropped the alpha component (see sigilry-private#54). Defaults to
   * the pinned version; override only if you know a different SDK still provides
   * the generator. An explicit `DPM_SDK_VERSION` in the environment takes
   * precedence over this value.
   */
  dpmSdkVersion?: string;
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
  dpmSdkVersion: PINNED_DPM_SDK_VERSION,
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
