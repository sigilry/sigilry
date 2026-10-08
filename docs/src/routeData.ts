import { defineRouteMiddleware } from "@astrojs/starlight/route-data";

/**
 * Advertises each page's Markdown twin (served by starlight-llms-txt at
 * `<page>.md`) so agents that read HTML can discover the plain-text version.
 */
export const onRequest = defineRouteMiddleware((context) => {
  const base = import.meta.env.BASE_URL.replace(/\/?$/, "/");
  const pagePath = context.url.pathname.replace(/\/$/, "");
  const markdownPath = pagePath === base.replace(/\/$/, "") ? `${base}index.md` : `${pagePath}.md`;

  context.locals.starlightRoute.head.push({
    tag: "link",
    attrs: { rel: "alternate", type: "text/markdown", href: markdownPath },
  });
});
