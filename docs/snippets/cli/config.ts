import { defineConfig } from "@sigilry/cli/config";

export default defineConfig({
  dars: ["./path/to/your.dar"],
  output: "./src/generated",
  cleanup: true,
  watch: false,
});
