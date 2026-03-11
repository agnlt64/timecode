export const dynamic = "force-dynamic";

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { resolveRange, resolveMachineId } from "@/app/lib/api-utils";
import { queryProjectDaily, queryDailyTotals, queryLanguages } from "@/app/lib/db";
import { formatDuration, rangeLabel } from "@/app/lib/stats";
import type { DateRange } from "@/app/lib/stats";

const BG = "#111113";
const SURFACE = "#1a1a1e";
const BORDER = "#2a2a2e";
const TEXT = "#e4e4e7";
const MUTED = "#a1a1aa";
const TEAL = "#2dd4bf";
const CHART_COLORS = ["#2dd4bf", "#f59e0b", "#ef4444", "#3b82f6", "#a78bfa", "#f97316"];

// Track width for project bars (px)
const TRACK_W = 456;

let fontRegular: ArrayBuffer | null = null;
let fontSemiBold: ArrayBuffer | null = null;

async function loadFonts() {
  if (!fontRegular) {
    const buf = await readFile(join(process.cwd(), "public", "SpaceGrotesk-Regular.ttf"));
    fontRegular = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  if (!fontSemiBold) {
    const buf = await readFile(join(process.cwd(), "public", "SpaceGrotesk-SemiBold.ttf"));
    fontSemiBold = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  }
  return { fontRegular: fontRegular!, fontSemiBold: fontSemiBold! };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const range = resolveRange(url);
  const machineId = resolveMachineId(url);

  if ("error" in range) {
    return new Response(range.error, { status: range.status });
  }
  if (typeof machineId !== "string") {
    return new Response(machineId.error, { status: machineId.status });
  }

  const [projectRows, dailyRows, languageRows] = await Promise.all([
    queryProjectDaily(machineId, range.from, range.to),
    queryDailyTotals(machineId, range.from, range.to),
    queryLanguages(machineId, range.from, range.to)
  ]);

  const totalSeconds = dailyRows.reduce((acc, r) => acc + r.seconds, 0);

  const projectTotals = projectRows.reduce(
    (acc, r) => {
      acc[r.projectName] = (acc[r.projectName] ?? 0) + r.seconds;
      return acc;
    },
    {} as Record<string, number>
  );

  const projects = Object.entries(projectTotals)
    .map(([name, seconds]) => ({ name, seconds }))
    .sort((a, b) => b.seconds - a.seconds)
    .slice(0, 6);

  const languages = languageRows.slice(0, 5);

  const { fontRegular: fontReg, fontSemiBold: fontSemi } = await loadFonts();

  const label = rangeLabel(range as DateRange);
  const maxSeconds = projects[0]?.seconds ?? 1;
  const noData = totalSeconds === 0;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 800,
          height: 420,
          background: BG,
          fontFamily: "SpaceGrotesk",
          color: TEXT
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            height: 52,
            paddingLeft: 28,
            paddingRight: 28,
            borderBottom: `1px solid ${BORDER}`,
            gap: 10
          }}
        >
          <span style={{ display: "flex", fontSize: 18, fontWeight: 600, color: TEAL }}>
            Timecode
          </span>
          <span style={{ display: "flex", fontSize: 14, color: MUTED }}>·</span>
          <span style={{ display: "flex", fontSize: 14, color: MUTED }}>{label}</span>
        </div>

        {noData ? (
          <div
            style={{
              display: "flex",
              flexGrow: 1,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <span style={{ display: "flex", fontSize: 20, color: MUTED }}>
              No data for this period
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
            {/* Hero */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "baseline",
                height: 70,
                paddingLeft: 28,
                paddingRight: 28,
                gap: 10,
                borderBottom: `1px solid ${BORDER}`
              }}
            >
              <span style={{ display: "flex", fontSize: 36, fontWeight: 600, color: TEAL }}>
                {formatDuration(totalSeconds)}
              </span>
              <span style={{ display: "flex", fontSize: 15, color: MUTED }}>total coded</span>
            </div>

            {/* Projects */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                paddingTop: 14,
                paddingBottom: 12,
                paddingLeft: 28,
                paddingRight: 28,
                gap: 10
              }}
            >
              {projects.map((p, i) => {
                const filled = Math.max(4, Math.round((p.seconds / maxSeconds) * TRACK_W));
                const empty = TRACK_W - filled;
                const name = p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name;
                const color = CHART_COLORS[i % CHART_COLORS.length];
                return (
                  <div
                    key={p.name}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12
                    }}
                  >
                    <span
                      style={{ display: "flex", fontSize: 12, color: TEXT, width: 160 }}
                    >
                      {name}
                    </span>
                    <div style={{ display: "flex", flexDirection: "row", width: TRACK_W, height: 10 }}>
                      <div
                        style={{ width: filled, height: 10, background: color, borderRadius: 3 }}
                      />
                      {empty > 0 && (
                        <div
                          style={{ width: empty, height: 10, background: BORDER, borderRadius: 3 }}
                        />
                      )}
                    </div>
                    <span
                      style={{
                        display: "flex",
                        fontSize: 12,
                        color: MUTED,
                        width: 56,
                        justifyContent: "flex-end"
                      }}
                    >
                      {formatDuration(p.seconds)}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Languages */}
            {languages.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  height: 44,
                  paddingLeft: 28,
                  paddingRight: 28,
                  gap: 8,
                  borderTop: `1px solid ${BORDER}`,
                  background: SURFACE
                }}
              >
                {languages.map((lang, i) => (
                  <div
                    key={lang.language}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      background: BG,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 20,
                      paddingTop: 3,
                      paddingBottom: 3,
                      paddingLeft: 10,
                      paddingRight: 10
                    }}
                  >
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: CHART_COLORS[i % CHART_COLORS.length]
                      }}
                    />
                    <span style={{ display: "flex", fontSize: 12, color: MUTED }}>
                      {lang.language}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "flex-end",
            alignItems: "center",
            height: 34,
            paddingLeft: 28,
            paddingRight: 28,
            borderTop: `1px solid ${BORDER}`
          }}
        >
          <span style={{ display: "flex", fontSize: 11, color: BORDER }}>
            timecode.agnlt64.xyz
          </span>
        </div>
      </div>
    ),
    {
      width: 800,
      height: 420,
      fonts: [
        { name: "SpaceGrotesk", data: fontReg, weight: 400, style: "normal" },
        { name: "SpaceGrotesk", data: fontSemi, weight: 600, style: "normal" }
      ]
    }
  );
}
