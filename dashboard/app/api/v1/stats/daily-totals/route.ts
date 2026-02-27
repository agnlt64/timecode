export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveRange, corsHeaders } from "@/app/lib/api-utils";
import { queryDailyTotals } from "@/app/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = resolveRange(url);

  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: range.status, headers: corsHeaders() });
  }

  const items = await queryDailyTotals(range.from, range.to);
  return NextResponse.json({ from: range.from, to: range.to, items }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
