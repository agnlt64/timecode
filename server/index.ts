import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type {
  HealthResponse,
  IngestEventsRequest,
  IngestEventsResponse,
  TimecodeEvent
} from "@/shared";

const PORT = Number(process.env.TIMECODE_PORT ?? 4821);
const HOST = process.env.TIMECODE_HOST ?? "127.0.0.1";
const VERSION = "0.1.0";
const SCHEMA_VERSION = 1;

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(data));
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function isTimecodeEvent(value: unknown): value is TimecodeEvent {
  if (!value || typeof value !== "object") return false;

  const event = value as Partial<TimecodeEvent>;

  return (
    typeof event.id === "string" &&
    typeof event.machineId === "string" &&
    typeof event.os === "string" &&
    typeof event.editor === "string" &&
    typeof event.projectName === "string" &&
    (event.projectPath === null || typeof event.projectPath === "string") &&
    (event.filePath === null || typeof event.filePath === "string") &&
    typeof event.language === "string" &&
    typeof event.startedAt === "string" &&
    isIsoDate(event.startedAt) &&
    typeof event.endedAt === "string" &&
    isIsoDate(event.endedAt) &&
    typeof event.durationSeconds === "number" &&
    event.durationSeconds > 0 &&
    typeof event.isWrite === "boolean"
  );
}

function parseIngestRequest(value: unknown): IngestEventsRequest | null {
  if (!value || typeof value !== "object") return null;

  const payload = value as Partial<IngestEventsRequest>;
  if (!Array.isArray(payload.events)) return null;

  return payload.events.every(isTimecodeEvent)
    ? ({ events: payload.events } as IngestEventsRequest)
    : null;
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8");
  return JSON.parse(rawBody);
}

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${HOST}:${PORT}`);

  if (method === "GET" && url.pathname === "/api/v1/health") {
    const response: HealthResponse = {
      status: "ok",
      version: VERSION,
      schemaVersion: SCHEMA_VERSION
    };
    sendJson(res, 200, response);
    return;
  }

  if (method === "POST" && url.pathname === "/api/v1/events") {
    let body: unknown;
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const payload = parseIngestRequest(body);
    if (!payload) {
      sendJson(res, 400, { error: "Invalid /events payload" });
      return;
    }

    const result: IngestEventsResponse = {
      accepted: payload.events.length,
      duplicates: 0,
      rejected: 0
    };

    sendJson(res, 200, result);
    return;
  }
});

server.listen(PORT, HOST, () => {
  console.log(`timecode server listening on http://${HOST}:${PORT}`);
});
