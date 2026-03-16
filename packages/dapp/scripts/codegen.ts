/**
 * Codegen script that generates Zod schemas from OpenRPC JSON Schema components.
 *
 * Uses json-schema-to-zod to convert JSON Schema to Zod source code.
 * Handles cross-file $ref resolution between dapp-api and user-api specs.
 * Post-processes output for Zod 4 compatibility.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { jsonSchemaToZod } from "json-schema-to-zod";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// Load both OpenRPC specs
const dappApiSpec = await Bun.file(join(rootDir, "api-specs/openrpc-dapp-api.json")).json();
const userApiSpec = await Bun.file(join(rootDir, "api-specs/openrpc-user-api.json")).json();

// Merge schemas from both specs (dApp schema definitions take precedence on name collisions)
type JsonSchema = Record<string, unknown>;
const allSchemas: Record<string, JsonSchema> = {
  ...userApiSpec.components.schemas,
  ...dappApiSpec.components.schemas,
};

/**
 * Recursively resolve and inline $refs.
 * For refs to other schemas, inline the full schema definition.
 * This ensures json-schema-to-zod generates proper validators instead of z.any().
 *
 * @param schema - The schema to process
 * @param allSchemas - Map of all available schema definitions
 * @param visited - Set of schema names currently being resolved (for cycle detection)
 */
function resolveAndInlineRefs(
  schema: JsonSchema,
  allSchemas: Record<string, JsonSchema>,
  visited: Set<string> = new Set(),
): JsonSchema {
  if (typeof schema !== "object" || schema === null) {
    return schema;
  }

  if (Array.isArray(schema)) {
    return schema.map((item) =>
      resolveAndInlineRefs(item, allSchemas, visited),
    ) as unknown as JsonSchema;
  }

  // Handle $ref by inlining the referenced schema
  if ("$ref" in schema && typeof schema.$ref === "string") {
    const ref = schema.$ref as string;
    // Extract schema name from any ref format
    const schemaName = ref.split("/").pop()!;

    // Check for circular reference
    if (visited.has(schemaName)) {
      // For circular refs, use $defs format and let json-schema-to-zod handle it
      return { $ref: `#/$defs/${schemaName}` };
    }

    // Find the referenced schema
    const referencedSchema = allSchemas[schemaName];
    if (referencedSchema) {
      // Recursively resolve the referenced schema (with cycle detection)
      const newVisited = new Set(visited);
      newVisited.add(schemaName);
      return resolveAndInlineRefs(referencedSchema, allSchemas, newVisited);
    }

    // If schema not found, keep the ref (will fallback to z.any())
    return { $ref: `#/$defs/${schemaName}` };
  }

  // Process object properties recursively
  const result: JsonSchema = {};
  for (const [key, value] of Object.entries(schema)) {
    if (typeof value === "object" && value !== null) {
      result[key] = resolveAndInlineRefs(value as JsonSchema, allSchemas, visited);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Build schemas with refs inlined
const resolvedSchemas = Object.fromEntries(
  Object.entries(allSchemas).map(([name, schema]) => [
    name,
    resolveAndInlineRefs(schema, allSchemas),
  ]),
);

/**
 * Check if a schema is a oneOf union that should be handled specially.
 */
function isOneOfSchema(schema: JsonSchema): schema is JsonSchema & { oneOf: JsonSchema[] } {
  return "oneOf" in schema && Array.isArray(schema.oneOf);
}

/**
 * Get the names of schemas referenced in a oneOf union.
 * Returns the schema names if all refs are to known schemas, null otherwise.
 */
function _getOneOfSchemaNames(
  schema: JsonSchema,
  allSchemas: Record<string, JsonSchema>,
): string[] | null {
  if (!isOneOfSchema(schema)) return null;

  const names: string[] = [];
  for (const item of schema.oneOf) {
    // Check if item is an inlined schema that matches a known schema
    // After resolveAndInlineRefs, the oneOf items are inlined schemas
    // We need to find which original schema they match
    for (const [name, originalSchema] of Object.entries(allSchemas)) {
      const resolved = resolveAndInlineRefs(originalSchema, allSchemas);
      if (JSON.stringify(item) === JSON.stringify(resolved)) {
        names.push(name);
        break;
      }
    }
  }

  // If we found all the schemas, return the names
  if (names.length === schema.oneOf.length) {
    return names;
  }
  return null;
}

/**
 * Post-process generated Zod code for Zod 4 compatibility.
 *
 * Fixes:
 * 1. z.record(z.any()) -> z.record(z.string(), z.any()) - Zod 4 requires key schema
 */
function postProcessForZod4(code: string): string {
  // Fix z.record() to have two arguments (Zod 4 requirement)
  return code.replace(/z\.record\(z\.any\(\)\)/g, "z.record(z.string(), z.any())");
}

// Track oneOf schemas that need special handling (generate after member schemas)
const oneOfSchemas: Map<string, { refNames: string[]; description: string }> = new Map();

// Generate Zod code for each schema
const schemaEntries: string[] = [];
const typeEntries: string[] = [];

// Deferred entries for oneOf unions (must come after their member schemas)
const deferredSchemaEntries: string[] = [];
const deferredTypeEntries: string[] = [];

// Sort schemas to ensure deterministic output
const sortedSchemaNames = Object.keys(resolvedSchemas).sort();

for (const name of sortedSchemaNames) {
  const schema = resolvedSchemas[name];
  const originalSchema = allSchemas[name];

  // Check if this is a oneOf union - handle specially to avoid superRefine issues
  if (isOneOfSchema(originalSchema)) {
    // Get the original $ref names from the unresolved schema
    const refNames: string[] = [];
    for (const item of originalSchema.oneOf as JsonSchema[]) {
      if ("$ref" in item && typeof item.$ref === "string") {
        const refName = (item.$ref as string).split("/").pop()!;
        refNames.push(refName);
      }
    }

    if (refNames.length === (originalSchema.oneOf as JsonSchema[]).length) {
      // All items are refs - defer generation to after member schemas
      const description = typeof schema.description === "string" ? schema.description : "";
      oneOfSchemas.set(name, { refNames, description });
      const unionCode = `z.union([${refNames.map((n) => `${n}Schema`).join(", ")}])${description ? `.describe(${JSON.stringify(description)})` : ""}`;
      deferredSchemaEntries.push(`export const ${name}Schema = ${unionCode}`);
      deferredTypeEntries.push(`export type ${name} = z.infer<typeof ${name}Schema>`);
      continue;
    }
  }

  // Create schema with $defs for any remaining circular refs
  const schemaWithDefs = {
    ...schema,
    $defs: resolvedSchemas,
  };

  try {
    // json-schema-to-zod returns Zod source code as a string
    let zodCode = jsonSchemaToZod(schemaWithDefs, {
      module: "none",
      name: undefined,
    });

    // Post-process for Zod 4 compatibility
    zodCode = postProcessForZod4(zodCode);

    schemaEntries.push(`export const ${name}Schema = ${zodCode}`);
    typeEntries.push(`export type ${name} = z.infer<typeof ${name}Schema>`);
  } catch (error) {
    console.error(`Failed to generate schema for ${name}:`, error);
    // Fallback to z.unknown() for problematic schemas
    schemaEntries.push(`export const ${name}Schema = z.unknown()`);
    typeEntries.push(`export type ${name} = z.infer<typeof ${name}Schema>`);
  }
}

// Append deferred oneOf union schemas (after their member schemas are defined)
schemaEntries.push(...deferredSchemaEntries);
typeEntries.push(...deferredTypeEntries);

// Extract RPC method definitions from the dapp-api spec
interface OpenRpcMethod {
  name: string;
  params: Array<{ name: string; schema: JsonSchema }>;
  result: { schema: JsonSchema };
  description?: string;
}

const methods = dappApiSpec.methods as OpenRpcMethod[];
const methodEntries: string[] = [];
const inlineSchemas: string[] = [];
const inlineTypes: string[] = [];

/**
 * Convert a method name to a PascalCase type name.
 * e.g., "connect" -> "ConnectResult", "ledgerApi" -> "LedgerApiParams"
 */
function toTypeName(methodName: string, suffix: string): string {
  const pascal = methodName.charAt(0).toUpperCase() + methodName.slice(1);
  return `${pascal}${suffix}`;
}

/**
 * Generate a type for an inline schema (params or result).
 * Returns the type name if successful, or 'unknown' if it fails.
 */
function generateInlineType(schema: JsonSchema, typeName: string): string {
  const resolvedSchema = resolveAndInlineRefs(schema, allSchemas);

  // Some canonical OpenRPC schemas omit `"type": "object"` while still providing `properties`.
  // json-schema-to-zod will degrade these to `z.any()`, so normalize them here.
  const normalizedSchema: JsonSchema =
    typeof resolvedSchema === "object" &&
    resolvedSchema !== null &&
    !Array.isArray(resolvedSchema) &&
    !("type" in resolvedSchema) &&
    "properties" in resolvedSchema
      ? { ...resolvedSchema, type: "object" }
      : resolvedSchema;
  const schemaWithDefs = { ...normalizedSchema, $defs: resolvedSchemas };

  try {
    let zodCode = jsonSchemaToZod(schemaWithDefs, { module: "none", name: undefined });
    zodCode = postProcessForZod4(zodCode);
    inlineSchemas.push(`export const ${typeName}Schema = ${zodCode}`);
    inlineTypes.push(`export type ${typeName} = z.infer<typeof ${typeName}Schema>`);
    return typeName;
  } catch {
    return "unknown";
  }
}

for (const method of methods) {
  let paramsType: string;

  if (method.params.length === 0) {
    paramsType = "void";
  } else if (method.params.length === 1) {
    const p = method.params[0];
    if (typeof p.schema === "object" && p.schema !== null && "$ref" in p.schema) {
      // Param is a $ref
      paramsType = (p.schema.$ref as string).split("/").pop()!;
    } else if (
      typeof p.schema === "object" &&
      p.schema !== null &&
      ("type" in p.schema || "properties" in p.schema)
    ) {
      // Inline param schema
      const typeName = toTypeName(method.name, "Params");
      paramsType = generateInlineType(p.schema, typeName);
    } else {
      paramsType = "unknown";
    }
  } else {
    // Multiple params - treat as unknown for now
    paramsType = "unknown";
  }

  let resultType: string;

  if (
    typeof method.result.schema === "object" &&
    method.result.schema !== null &&
    "$ref" in method.result.schema
  ) {
    // Result is a $ref - use the referenced type
    resultType = (method.result.schema.$ref as string).split("/").pop()!;
  } else if (
    typeof method.result.schema === "object" &&
    method.result.schema !== null &&
    ("type" in method.result.schema || "properties" in method.result.schema)
  ) {
    // Inline result schema - generate a schema and type for it
    const typeName = toTypeName(method.name, "Result");
    resultType = generateInlineType(method.result.schema, typeName);
  } else {
    resultType = "unknown";
  }

  methodEntries.push(
    `  ${method.name}: { params: ${paramsType === "void" ? "void" : paramsType}; result: ${resultType} }`,
  );
}

// Add inline method schemas (params and results) to the schema entries
schemaEntries.push(...inlineSchemas);
typeEntries.push(...inlineTypes);

// Generate the output file
const output = `// AUTO-GENERATED - DO NOT EDIT
// Generated from api-specs/openrpc-dapp-api.json and openrpc-user-api.json
// Run 'bun run codegen' to regenerate
import { z } from 'zod'

// =============================================================================
// Schemas
// =============================================================================

${schemaEntries.join("\n\n")}

// =============================================================================
// Types (inferred from schemas)
// =============================================================================

${typeEntries.join("\n")}

// =============================================================================
// RPC Method Types
// =============================================================================

export interface RpcMethods {
${methodEntries.join("\n")}
}
`;

// Ensure generated directory exists
mkdirSync(join(rootDir, "src/generated"), { recursive: true });

// Write the output
writeFileSync(join(rootDir, "src/generated/schemas.ts"), output);

console.log("Generated src/generated/schemas.ts");
