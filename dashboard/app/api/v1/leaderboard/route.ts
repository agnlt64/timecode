export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveRange, corsHeaders } from "@/app/lib/api-utils";
import { queryLeaderboard } from "@/app/lib/db";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = resolveRange(url);

  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: range.status, headers: corsHeaders() });
  }

  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit !== null ? parseInt(rawLimit, 10) : DEFAULT_LIMIT;

  if (isNaN(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `Invalid limit. Must be an integer between 1 and ${MAX_LIMIT}.` },
      { status: 400, headers: corsHeaders() }
    );
  }

  const items = await queryLeaderboard(range.from, range.to, limit);
  return NextResponse.json({ from: range.from, to: range.to, limit, items }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
