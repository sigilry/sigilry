/**
 * Custom TypeDoc plugin that adds unique slugs to generated markdown files.
 *
 * This ensures each API reference page has a unique content ID in Starlight,
 * preventing duplicate ID issues when multiple pages have the same title.
 */

import { MarkdownPageEvent } from "typedoc-plugin-markdown";

/**
 * @param {import("typedoc-plugin-markdown").MarkdownApplication} app
 */
export function load(app) {
  app.renderer.on(
    MarkdownPageEvent.BEGIN,
    /** @param {MarkdownPageEvent} page */
    (page) => {
      // Generate a unique slug based on the output file path
      // e.g., "dapp/src/functions/jsonRpcRequest.md"
      // becomes "api-reference/dapp/src/functions/jsonrpcrequest"
      // The api-reference/ prefix is needed to match the output directory
      const slug =
        "api-reference/" +
        page.url
          .replace(/\.md$/, "") // Remove .md extension
          .replace(/README$/, "readme") // Normalize README to lowercase
          .toLowerCase(); // Lowercase for consistent URLs

      // Add the slug to frontmatter
      page.frontmatter = {
        ...page.frontmatter,
        slug,
      };
    },
  );
}
