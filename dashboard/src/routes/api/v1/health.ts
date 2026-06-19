import { createFileRoute } from "@tanstack/react-router";
import { corsHeaders } from "@/lib/api-utils";

const VERSION = "0.1.0";
const SCHEMA_VERSION = 1;

export const Route = createFileRoute("/api/v1/health")({
  server: {
    handlers: {
      GET: async () => {
        return Response.json(
          { status: "ok", version: VERSION, schemaVersion: SCHEMA_VERSION },
          { headers: corsHeaders() }
        );
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
    },
  },
});
