import { createFileRoute } from "@tanstack/react-router";
import { resolveRange, corsHeaders } from "@/lib/api-utils";
import { queryLeaderboard } from "@/lib/db.server";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export const Route = createFileRoute("/api/v1/leaderboard")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const range = resolveRange(url);

        if ("error" in range) {
          return Response.json({ error: range.error }, { status: range.status, headers: corsHeaders() });
        }

        const rawLimit = url.searchParams.get("limit");
        const limit = rawLimit !== null ? parseInt(rawLimit, 10) : DEFAULT_LIMIT;

        if (isNaN(limit) || limit < 1 || limit > MAX_LIMIT) {
          return Response.json(
            { error: `Invalid limit. Must be an integer between 1 and ${MAX_LIMIT}.` },
            { status: 400, headers: corsHeaders() }
          );
        }

        const items = await queryLeaderboard(range.from, range.to, limit);
        return Response.json({ from: range.from, to: range.to, limit, items }, { headers: corsHeaders() });
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
    },
  },
});
