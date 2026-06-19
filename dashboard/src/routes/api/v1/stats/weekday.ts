import { createFileRoute } from "@tanstack/react-router";
import { resolveRange, resolveMachineId, corsHeaders } from "@/lib/api-utils";
import { queryWeekday } from "@/lib/db.server";

export const Route = createFileRoute("/api/v1/stats/weekday")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const range = resolveRange(url);
        const machineId = resolveMachineId(url);

        if ("error" in range) {
          return Response.json({ error: range.error }, { status: range.status, headers: corsHeaders() });
        }
        if (typeof machineId !== "string") {
          return Response.json({ error: machineId.error }, { status: machineId.status, headers: corsHeaders() });
        }

        const items = await queryWeekday(machineId, range.from, range.to);
        return Response.json({ from: range.from, to: range.to, items }, { headers: corsHeaders() });
      },
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders() }),
    },
  },
});
