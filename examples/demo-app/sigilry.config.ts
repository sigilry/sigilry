import { defineConfig } from "@sigilry/cli/config";

export default defineConfig({
  // Path(s) to DAR files to generate types from
  dars: ["./dars/demo-todo-package-0.0.1.dar"],

  // Output directory for generated TypeScript files
  output: "./src/generated",

  // Clean output directory before generating (default: true)
  cleanup: true,

  // Enable watch mode (default: false)
  watch: false,
});
