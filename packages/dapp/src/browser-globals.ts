/**
 * Browser-only global types for `window.canton`.
 *
 * Opt in by importing `@sigilry/dapp/browser-globals` in browser builds.
 */
import type { SpliceProvider } from "./provider/interface.js";

declare global {
  interface Window {
    canton?: SpliceProvider;
  }
}
