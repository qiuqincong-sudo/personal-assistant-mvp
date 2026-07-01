import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { URL } from "node:url";
import healthHandler from "../api/health.js";
import itemsHandler from "../api/items/index.js";
import itemHandler from "../api/items/[id].js";
import calendarSyncHandler from "../api/calendar/sync.js";
import briefingTodayHandler from "../api/briefing/today.js";

type QueryValue = string | string[];
type LocalQuery = Record<string, QueryValue>;

interface LocalRequest extends IncomingMessage {
  query: LocalQuery;
  body?: unknown;
}

interface LocalResponse extends ServerResponse {
  status: (code: number) => LocalResponse;
  json: (payload: unknown) => void;
}

type Handler = (req: LocalRequest, res: LocalResponse) => Promise<void> | void;

const PORT = Number(process.env.PORT || 3000);

function loadDotEnvLocal(): void {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsIndex = trimmed.indexOf("=");
    if (equalsIndex <= 0) continue;

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value.replace(/\\n/g, "\n");
    }
  }
}

function addQueryValue(query: LocalQuery, key: string, value: string): void {
  const current = query[key];
  if (current === undefined) {
    query[key] = value;
    return;
  }

  query[key] = Array.isArray(current) ? [...current, value] : [current, value];
}

function queryFromUrl(url: URL): LocalQuery {
  const query: LocalQuery = {};
  for (const [key, value] of url.searchParams.entries()) {
    addQueryValue(query, key, value);
  }
  return query;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) return undefined;

  const rawBody = Buffer.concat(chunks).toString("utf8");
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("application/json")) {
    return rawBody ? JSON.parse(rawBody) : undefined;
  }

  return rawBody;
}

function decorateResponse(res: ServerResponse): LocalResponse {
  const localRes = res as LocalResponse;

  localRes.status = (code: number) => {
    localRes.statusCode = code;
    return localRes;
  };

  localRes.json = (payload: unknown) => {
    if (!localRes.headersSent) {
      localRes.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    localRes.end(JSON.stringify(payload));
  };

  return localRes;
}

function matchRoute(method: string, pathname: string, query: LocalQuery): Handler | undefined {
  if (pathname === "/api/health" && method === "GET") return healthHandler as Handler;
  if (pathname === "/api/items" && (method === "GET" || method === "POST")) return itemsHandler as Handler;
  if (pathname === "/api/calendar/sync" && method === "POST") return calendarSyncHandler as Handler;
  if (pathname === "/api/briefing/today" && method === "GET") return briefingTodayHandler as Handler;

  const itemMatch = /^\/api\/items\/([^/]+)$/.exec(pathname);
  if (itemMatch && method === "PATCH") {
    query.id = decodeURIComponent(itemMatch[1]);
    return itemHandler as Handler;
  }

  return undefined;
}

function serveOpenApi(pathname: string, res: LocalResponse): boolean {
  if (pathname !== "/openapi.yaml" && pathname !== "/public/openapi.yaml") return false;

  const schema = readFileSync(join(process.cwd(), "public", "openapi.yaml"), "utf8");
  res.status(200);
  res.setHeader("Content-Type", "application/yaml; charset=utf-8");
  res.end(schema);
  return true;
}

loadDotEnvLocal();

const server = createServer(async (req, res) => {
  const localRes = decorateResponse(res);

  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || `localhost:${PORT}`}`);
    const query = queryFromUrl(url);

    if (serveOpenApi(url.pathname, localRes)) return;

    const handler = matchRoute(req.method || "GET", url.pathname, query);
    if (!handler) {
      localRes.status(404).json({ error: "Not Found" });
      return;
    }

    const localReq = req as LocalRequest;
    localReq.query = query;
    localReq.body = await readBody(req);

    await handler(localReq, localRes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    if (!localRes.headersSent) {
      localRes.status(500).json({ error: message });
    } else {
      localRes.end();
    }
  }
});

server.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing process or set PORT to another value.`);
    process.exit(1);
  }

  if (error.code === "EPERM") {
    console.error(
      `Permission denied while listening on 127.0.0.1:${PORT}. ` +
        "Run this command in a normal local terminal, or use an environment that allows localhost ports."
    );
    process.exit(1);
  }

  console.error(error);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Personal assistant MVP dev server listening on http://localhost:${PORT}`);
});
