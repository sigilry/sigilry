/**
 * Resolve the dpm executable and the invocation environment used by sigilry
 * codegen.
 */

/**
 * dpm SDK version that codegen is pinned to.
 *
 * `dpm codegen-alpha-typescript` is an *alpha* component that only ships through
 * the `transcode/daml3.4` SDK assembly. dpm SDK 3.4.11+ dropped it, and its
 * `public-unstable` OCI tags have been cleared at least once (sigilry-private#54).
 * Pinning the SDK keeps codegen reproducible until the pure-TS generator lands
 * (sigilry-private#58). This is an interim bridge, not the end state.
 */
export const PINNED_DPM_SDK_VERSION = "3.4.9";

/**
 * Upper bound (ms) on the `java -version` preflight probe.
 *
 * The probe only reads the JVM version, so it should return near-instantly. A
 * `JAVA_BIN`/`JAVA_HOME` that resolves to a hanging or wedged wrapper must not
 * stall `sigilry codegen` forever — repo policy requires external process calls
 * to carry an explicit timeout. 10s is generous for a cold JVM start on a loaded
 * box while still bounding a hang.
 */
export const JAVA_PREFLIGHT_TIMEOUT_MS = 10_000;

/**
 * Resolve the dpm executable used by sigilry codegen.
 *
 * DPM_BIN allows callers (e.g. CI) to provide an absolute path when PATH
 * propagation is constrained by task runners.
 */
export function resolveDpmCommand(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env.DPM_BIN?.trim();
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }

  return "dpm";
}

/**
 * Build the environment for invoking dpm codegen, pinning `DPM_SDK_VERSION` so
 * the alpha TypeScript generator stays resolvable regardless of the box's
 * default/active SDK.
 *
 * An explicit, non-empty `DPM_SDK_VERSION` already present in the environment
 * wins, so CI and power users can override the pin without editing config.
 */
export function buildCodegenEnv(env: NodeJS.ProcessEnv, dpmSdkVersion: string): NodeJS.ProcessEnv {
  return {
    ...env,
    DPM_SDK_VERSION: env.DPM_SDK_VERSION?.trim() || dpmSdkVersion,
  };
}

/**
 * Resolve the `java` executable.
 *
 * dpm runs the TypeScript generator via `java -jar transcode.jar`, so a JVM must
 * be reachable. Prefer an explicit `JAVA_BIN`, then `JAVA_HOME/bin/java`, else
 * rely on a PATH lookup of `java`.
 */
export function resolveJavaCommand(env: NodeJS.ProcessEnv = process.env): string {
  const fromBin = env.JAVA_BIN?.trim();
  if (fromBin) {
    return fromBin;
  }

  const home = env.JAVA_HOME?.trim();
  if (home) {
    return `${home}/bin/java`;
  }

  return "java";
}
