import { defineConfig } from "@sigilry/cli/config";
import { spliceDars } from "@sigilry/splice-dars";

export default defineConfig({
  dars: [spliceDars.amulet, spliceDars.apiTokenHolding, spliceDars.apiTokenTransferInstruction],
  output: "./src/generated",
});
