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
