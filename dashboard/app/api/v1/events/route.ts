export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { corsHeaders } from "@/app/lib/api-utils";
import { ingestEvents } from "@/app/lib/db";
import type { IngestEventsRequest, TimecodeEvent } from "@shared/types";

const MAX_INGEST_EVENTS = 500;

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
    Date.parse(event.endedAt) > Date.parse(event.startedAt) &&
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

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders() });
  }

  const payload = parseIngestRequest(body);
  if (!payload) {
    return NextResponse.json({ error: "Invalid /events payload" }, { status: 400, headers: corsHeaders() });
  }

  if (payload.events.length > MAX_INGEST_EVENTS) {
    return NextResponse.json(
      { error: `Too many events. Max ${MAX_INGEST_EVENTS} per request.` },
      { status: 413, headers: corsHeaders() }
    );
  }

  try {
    const result = await ingestEvents(payload.events);
    return NextResponse.json(result, { headers: corsHeaders() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Server error" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
