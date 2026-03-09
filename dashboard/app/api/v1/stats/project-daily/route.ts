export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { resolveRange, resolveMachineId, corsHeaders } from "@/app/lib/api-utils";
import { queryProjectDaily } from "@/app/lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = resolveRange(url);
  const machineId = resolveMachineId(url);

  if ("error" in range) {
    return NextResponse.json({ error: range.error }, { status: range.status, headers: corsHeaders() });
  }
  if (typeof machineId !== "string") {
    return NextResponse.json({ error: machineId.error }, { status: machineId.status, headers: corsHeaders() });
  }

  const items = await queryProjectDaily(machineId, range.from, range.to);
  return NextResponse.json({ from: range.from, to: range.to, items }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
