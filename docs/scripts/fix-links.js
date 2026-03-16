#!/usr/bin/env node
/**
 * Post-build script to fix root-relative links for versioned base path compatibility.
 *
 * Fixes:
 * 1. API reference .md files: converts /api-reference/... to relative paths
 * 2. llms.txt: converts absolute URLs to relative paths
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsRoot = join(__dirname, "..");
const contentDir = join(docsRoot, "src/content/docs/api-reference");
const distDir = join(docsRoot, "dist");

/**
 * Recursively find all .md files in a directory
 */
function findMdFiles(dir, files = []) {
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findMdFiles(fullPath, files);
      } else if (entry.endsWith(".md")) {
        files.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist yet
  }
  return files;
}

/**
 * Fix root-relative links in API reference markdown files
 */
function fixApiReferenceLinks() {
  const mdFiles = findMdFiles(contentDir);
  let fixedCount = 0;

  for (const filePath of mdFiles) {
    const content = readFileSync(filePath, "utf-8");
    const fileDir = dirname(filePath);
    const relativeToApiRef = relative(fileDir, contentDir);

    // Fix links like [text](/api-reference/...) to relative paths
    const fixed = content.replace(
      /\[([^\]]+)\]\(\/api-reference\/([^)]+)\)/g,
      (_match, text, path) => {
        // Calculate relative path from current file to target
        const relativePath = relativeToApiRef ? `${relativeToApiRef}/${path}` : path;
        return `[${text}](${relativePath})`;
      },
    );

    if (fixed !== content) {
      writeFileSync(filePath, fixed);
      fixedCount++;
    }
  }

  console.log(`Fixed ${fixedCount} API reference files`);
}

/**
 * Fix absolute URLs in llms.txt
 */
function fixLlmsTxtLinks() {
  const llmsTxtPath = join(distDir, "llms.txt");

  try {
    const content = readFileSync(llmsTxtPath, "utf-8");

    // Replace absolute URLs with relative paths
    // e.g., https://sigilry.org/llms-small.txt -> llms-small.txt
    const fixed = content
      .replace(/https:\/\/sigilry\.org\/llms-small\.txt/g, "llms-small.txt")
      .replace(/https:\/\/sigilry\.org\/llms-full\.txt/g, "llms-full.txt");

    if (fixed !== content) {
      writeFileSync(llmsTxtPath, fixed);
      console.log("Fixed llms.txt absolute URLs");
    }
  } catch {
    console.log("llms.txt not found in dist (run after build)");
  }
}

/**
 * Fix root-relative links in llms-small.txt and llms-full.txt
 * These files contain content from TypeDoc pages with /api-reference/... links
 */
function fixLlmsContentLinks() {
  const files = ["llms-small.txt", "llms-full.txt"];

  for (const fileName of files) {
    const filePath = join(distDir, fileName);

    try {
      const content = readFileSync(filePath, "utf-8");

      // Convert root-relative links to relative paths
      // e.g., ](/api-reference/...) -> ](api-reference/...)
      // and (/api-reference/...) -> (api-reference/...)
      const fixed = content
        .replace(/\]\(\/api-reference\//g, "](api-reference/")
        .replace(/\(\/api-reference\//g, "(api-reference/");

      if (fixed !== content) {
        writeFileSync(filePath, fixed);
        console.log(`Fixed root-relative links in ${fileName}`);
      }
    } catch {
      console.log(`${fileName} not found in dist (run after build)`);
    }
  }
}

// Run fixes
console.log("Fixing links for versioned base path compatibility...");
fixApiReferenceLinks();
fixLlmsTxtLinks();
fixLlmsContentLinks();
console.log("Done!");
