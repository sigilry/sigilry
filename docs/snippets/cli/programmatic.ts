import { generateTypes, loadConfig } from "@sigilry/cli";

async function generate() {
  const { config } = await loadConfig();
  const result = await generateTypes(config);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result;
}

generate();
