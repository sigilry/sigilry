import { defineConfig } from "@sigilry/cli/config";
import { allSpliceDars } from "@sigilry/splice-dars";

// Pass every Splice DAR to codegen
export default defineConfig({
  dars: [...allSpliceDars],
  output: "./src/generated",
});
