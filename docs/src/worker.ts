export default {
  async fetch(request: Request, env: { ASSETS: Fetcher }): Promise<Response> {
    const url = new URL(request.url);
    const accept = request.headers.get("Accept") ?? "";

    // Content negotiation: serve .md when agent requests markdown
    if (accept.includes("text/markdown") && url.pathname !== "/") {
      const mdPath = url.pathname.replace(/\/$/, "") + ".md";
      const mdUrl = new URL(mdPath, url.origin);
      const mdResponse = await env.ASSETS.fetch(new Request(mdUrl));

      if (mdResponse.ok) {
        return new Response(mdResponse.body, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            Vary: "Accept",
          },
        });
      }
    }

    // Default: serve static asset as-is
    return env.ASSETS.fetch(request);
  },
};
