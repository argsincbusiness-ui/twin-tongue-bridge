/**
 * Authenticated, read-only MCP endpoint for Twin Tongue Bridge.
 * Supabase OAuth access tokens are verified before MCP methods are served.
 */
import { createClient } from "@supabase/supabase-js";
import { translateForMcp } from "@/lib/mcp-translate.server";

const APP_URL = "https://twin-tongue-bridge.vercel.app";
const RESOURCE_METADATA = APP_URL + "/.well-known/oauth-protected-resource/mcp";
const AUTH_SERVER = "https://nyjcsedhyqpriskjzwhd.supabase.co/auth/v1";

const tools = [
  {
    name: "get_app_overview",
    description:
      "Get the public overview of Twin Tongue Bridge, its interpreter workflows, and how to access them.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "open_twin_tongue_bridge",
    description:
      "Get the official Twin Tongue Bridge website link and instructions for opening its translation experience.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "translate_text",
    description: "Translate text using the authenticated user Twin Tongue Bridge account. Uses the app translation providers and the same daily usage limits and Pro access rules. Set sourceLang to auto for language detection.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", minLength: 1, maxLength: 10000, description: "Text to translate." },
        sourceLang: { type: "string", minLength: 2, maxLength: 35, description: "Source language name or BCP-47 tag; use auto to detect." },
        targetLang: { type: "string", minLength: 2, maxLength: 35, description: "Target language name or BCP-47 tag." },
        style: { type: "string", enum: ["natural", "casual", "professional", "formal", "friendly", "business"] },
      },
      required: ["text", "targetLang"],
      additionalProperties: false,
    },
  },
];

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type, accept, mcp-session-id, mcp-protocol-version",
      "access-control-expose-headers": "WWW-Authenticate, MCP-Protocol-Version",
      ...extraHeaders,
    },
  });
}

function rpcError(id: string | number | null, code: number, message: string): Response {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}

function unauthorized(): Response {
  return json(
    { error: "Unauthorized" },
    401,
    {
      "www-authenticate": `Bearer resource_metadata="${RESOURCE_METADATA}", authorization_uri="${AUTH_SERVER}/oauth/authorize", scope="openid profile email offline_access"`,
    },
  );
}

async function verifyBearerToken(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return false;
  const token = authorization.slice(7).trim();
  if (!token || token.length > 8192 || token.split(".").length !== 3) return false;

  const projectUrl = process.env["SUPABASE_URL"];
  const publishableKey =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ??
    process.env["SUPABASE_ANON_KEY"];
  if (!projectUrl || !publishableKey) {
    throw new Error("Supabase token verification is not configured");
  }

  const supabase = createClient(projectUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  return !error && !!data?.claims?.sub && data.claims.role === "authenticated" ? token : null;
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, GET, OPTIONS",
        "access-control-allow-headers": "authorization, content-type, accept, mcp-session-id, mcp-protocol-version",
        "access-control-expose-headers": "WWW-Authenticate, MCP-Protocol-Version",
        "access-control-max-age": "86400",
      },
    });
  }

  if (request.method === "GET") {
    return new Response(null, {
      status: 405,
      headers: {
        allow: "POST, OPTIONS",
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let accessToken: string;
  try {
    const verified = await verifyBearerToken(request);
    if (!verified) return unauthorized();
    accessToken = verified;
  } catch (error) {
    console.error("MCP auth verification failed:", error);
    return json({ error: "Authentication service unavailable" }, 503);
  }

  let message: any;
  try {
    message = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  if (!message || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message?.id ?? null, -32600, "Invalid Request");
  }

  const id = message.id;
  const isNotification = id === undefined;

  if (message.method === "notifications/initialized" || message.method === "notifications/cancelled") {
    return new Response(null, { status: 202 });
  }

  if (message.method === "initialize") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: message.params?.protocolVersion ?? "2025-03-26",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "twin-tongue-bridge", version: "1.1.0" },
        instructions:
          "Twin Tongue Bridge is an AI-powered multilingual interpreter. Use get_app_overview for public feature information and open_twin_tongue_bridge to direct the user to the app. This connection authenticates with the user's Twin Tongue Bridge account. Use translate_text to translate text through the app, subject to the account's plan and usage limits.",
      },
    });
  }

  if (isNotification) return new Response(null, { status: 202 });
  if (message.method === "ping") return json({ jsonrpc: "2.0", id, result: {} });
  if (message.method === "tools/list") {
    return json({ jsonrpc: "2.0", id, result: { tools } });
  }

  if (message.method === "tools/call") {
    const name = message.params?.name;
    if (name === "get_app_overview") {
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text:
              "Twin Tongue Bridge is an AI-powered multilingual interpreter for conversations. Publicly described workflows include Duplex Talk, Face-to-Face interpretation, Photo Translation, Conference Rooms, Learning Mode, Sing It, and Studio. The service is available at " +
              APP_URL +
              ". Sign in through the app to use protected translation features.",
          }],
          structuredContent: {
            appName: "Twin Tongue Bridge",
            website: APP_URL,
            workflows: [
              "Duplex Talk",
              "Face-to-Face",
              "Photo Translation",
              "Conference Rooms",
              "Learning Mode",
              "Sing It",
              "Studio",
            ],
          },
        },
      });
    }

    if (name === "open_twin_tongue_bridge") {
      return json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [{
            type: "text",
            text: "Open Twin Tongue Bridge here: " + APP_URL + ". Sign in on the website to access the translation experience.",
          }],
          structuredContent: { url: APP_URL },
        },
      });
    }

    if (name === "translate_text") {
      const args = message.params?.arguments ?? {};
      if (typeof args.text !== "string" || typeof args.targetLang !== "string") {
        return rpcError(id, -32602, "translate_text requires text and targetLang.");
      }
      try {
        const translated = await translateForMcp(accessToken, {
          text: args.text,
          sourceLang: typeof args.sourceLang === "string" ? args.sourceLang : "auto",
          targetLang: args.targetLang,
          style: args.style,
        });
        return json({
          jsonrpc: "2.0",
          id,
          result: {
            content: [{ type: "text", text: translated.translated }],
            structuredContent: translated,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Translation failed.";
        return json({
          jsonrpc: "2.0",
          id,
          result: { isError: true, content: [{ type: "text", text: message }] },
        });
      }
    }
    return rpcError(id, -32602, "Unknown tool");
  }

  return rpcError(id, -32601, "Method not found");
}
