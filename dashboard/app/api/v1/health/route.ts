export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { corsHeaders } from "@/app/lib/api-utils";

const VERSION = "0.1.0";
const SCHEMA_VERSION = 1;

export async function GET() {
  return NextResponse.json(
    { status: "ok", version: VERSION, schemaVersion: SCHEMA_VERSION },
    { headers: corsHeaders() }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
