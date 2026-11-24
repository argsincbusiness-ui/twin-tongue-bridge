import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleLiveRequest } from "./lib/live-relay.server";
import { handleMcpRequest } from "./lib/mcp.server";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const pathname = new URL(request.url).pathname;
      if (pathname === "/api/live") return handleLiveRequest(request);
      if (
        request.method === "GET" &&
        (pathname === "/.well-known/oauth-protected-resource" ||
          pathname === "/.well-known/oauth-protected-resource/mcp")
      ) {
        return new Response(JSON.stringify({
          resource: "https://twin-tongue-bridge.vercel.app/mcp",
          authorization_servers: ["https://nyjcsedhyqpriskjzwhd.supabase.co/auth/v1"],
          bearer_methods_supported: ["header"],
          scopes_supported: ["openid", "profile", "email", "offline_access"],
          resource_documentation: "https://twin-tongue-bridge.vercel.app",
        }), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "public, max-age=300",
            "access-control-allow-origin": "*",
          },
        });
      }
      if (pathname === "/mcp/health" && request.method === "GET") {
        return new Response(JSON.stringify({
          name: "Twin Tongue Bridge MCP",
          status: "ok",
          transport: "Streamable HTTP",
          endpoint: "/mcp",
        }), {
          headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
        });
      }
      if (pathname === "/mcp") return handleMcpRequest(request);
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
