import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input: "./api-specs/openapi.yaml",
  output: { path: "./src/generated" },
  plugins: [
    { name: "@hey-api/transformers", bigInt: true, dates: false },
    { name: "@hey-api/typescript", enums: false },
    { name: "zod", definitions: true },
  ],
});
