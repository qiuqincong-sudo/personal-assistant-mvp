import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getAppConfig } from "../config.js";

export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function setCorsHeaders(res: VercelResponse): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
}

export function handleOptions(req: VercelRequest, res: VercelResponse): boolean {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }
  return false;
}

export function sendJson(res: VercelResponse, status: number, payload: unknown): void {
  setCorsHeaders(res);
  res.status(status).json(payload);
}

export function requireMethod(req: VercelRequest, allowed: string[]): void {
  if (!req.method || !allowed.includes(req.method)) {
    throw new HttpError(405, `Method ${req.method || "UNKNOWN"} is not allowed`);
  }
}

export function requireApiAuth(req: VercelRequest): void {
  const expected = getAppConfig().apiSharedSecret;
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : "";

  if (!token || token !== expected) {
    throw new HttpError(401, "Unauthorized");
  }
}

export async function parseJsonBody<T>(req: VercelRequest): Promise<T> {
  if (!req.body) {
    return {} as T;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as T;
    } catch {
      throw new HttpError(400, "Request body must be valid JSON");
    }
  }

  return req.body as T;
}

export function queryString(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function getPathParam(value: string | string[] | undefined, name: string): string {
  const resolved = queryString(value);
  if (!resolved) {
    throw new HttpError(400, `Missing path parameter: ${name}`);
  }
  return resolved;
}

export async function withApiHandler(
  req: VercelRequest,
  res: VercelResponse,
  handler: () => Promise<void>
): Promise<void> {
  try {
    if (handleOptions(req, res)) return;
    requireApiAuth(req);
    await handler();
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    const details = error instanceof HttpError ? error.details : undefined;
    sendJson(res, status, { error: message, details });
  }
}
