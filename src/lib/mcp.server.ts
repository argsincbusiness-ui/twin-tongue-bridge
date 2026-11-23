/**
 * Public, read-only MCP endpoint for Twin Tongue Bridge.
 *
 * This first integration intentionally exposes only public product information.
 * Translation is not exposed until OAuth can pass a real Supabase user identity
 * through the existing authentication and usage-enforcement path.
 */
const APP_URL = "https://twin-tongue-bridge.vercel.app";

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
];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-allow-headers": "content-type, accept, mcp-session-id, mcp-protocol-version",
    },
  });
}

function rpcError(id: string | number | null, code: number, message: string): Response {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}

export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, GET, OPTIONS",
        "access-control-allow-headers": "content-type, accept, mcp-session-id, mcp-protocol-version",
        "access-control-max-age": "86400",
      },
    });
  }

  if (request.method === "GET") {
    return json({
      name: "Twin Tongue Bridge MCP",
      status: "ok",
      transport: "Streamable HTTP",
      endpoint: "/mcp",
    });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
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
        serverInfo: { name: "twin-tongue-bridge", version: "1.0.0" },
        instructions:
          "Twin Tongue Bridge is an AI-powered multilingual interpreter. Use get_app_overview for public feature information and open_twin_tongue_bridge to direct the user to the app. Live translation remains inside the authenticated app so its existing account and usage protections are preserved.",
      },
    });
  }

  if (isNotification) return new Response(null, { status: 202 });

  if (message.method === "ping") {
    return json({ jsonrpc: "2.0", id, result: {} });
  }

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
              ". Sign in through the app to use protected translation features. This ChatGPT connection currently provides public app information and navigation only.",
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
            translationRequiresAppSignIn: true,
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

    return rpcError(id, -32602, "Unknown tool");
  }

  return rpcError(id, -32601, "Method not found");
}
