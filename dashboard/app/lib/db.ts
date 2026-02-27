import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";
import type { TimecodeEvent, IngestEventsResponse } from "@/app/lib/types";

const DB_PATH = process.env.TIMECODE_DB_PATH ?? join(homedir(), ".config", "timecode", "timecode.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ datasources: { db: { url: `file:${DB_PATH}` } } });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

function localDayFromISO(isoUtc: string): string {
  const d = new Date(isoUtc);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function ingestEvents(events: TimecodeEvent[]): Promise<IngestEventsResponse> {
  const result: IngestEventsResponse = { accepted: 0, duplicates: 0, rejected: 0 };

  for (const event of events) {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.event.findUnique({
        where: { id: event.id },
        select: { id: true }
      });

      if (existing) {
        result.duplicates += 1;
        return;
      }

      await tx.event.create({
        data: {
          id: event.id,
          machineId: event.machineId,
          editor: event.editor,
          os: event.os,
          projectName: event.projectName,
          projectPath: event.projectPath,
          filePath: event.filePath,
          language: event.language,
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          durationSeconds: event.durationSeconds,
          isWrite: event.isWrite
        }
      });

      const day = localDayFromISO(event.startedAt);

      await tx.dailyStat.upsert({
        where: { day_projectName_language: { day, projectName: event.projectName, language: event.language } },
        update: {
          totalSeconds: { increment: event.durationSeconds },
          activeSeconds: { increment: event.durationSeconds },
          eventsCount: { increment: 1 },
          updatedAt: new Date().toISOString()
        },
        create: {
          day,
          projectName: event.projectName,
          language: event.language,
          totalSeconds: event.durationSeconds,
          activeSeconds: event.durationSeconds,
          eventsCount: 1
        }
      });

      result.accepted += 1;
    });
  }

  return result;
}

export async function queryProjectDaily(from: string, to: string) {
  const rows = await prisma.dailyStat.groupBy({
    by: ["day", "projectName"],
    where: { day: { gte: from, lte: to } },
    _sum: { totalSeconds: true },
    orderBy: [{ day: "asc" }, { _sum: { totalSeconds: "desc" } }]
  });

  return rows.map((r) => ({
    day: r.day,
    projectName: r.projectName,
    seconds: r._sum.totalSeconds ?? 0
  }));
}

export async function queryWeekday(from: string, to: string) {
  const rows = await prisma.$queryRaw<Array<{ dayOfWeek: bigint; seconds: bigint }>>`
    SELECT CAST(strftime('%w', day) AS INTEGER) AS dayOfWeek, SUM(total_seconds) AS seconds
    FROM daily_stats
    WHERE day BETWEEN ${from} AND ${to}
    GROUP BY dayOfWeek
  `;
  return rows.map((r) => ({ dayOfWeek: Number(r.dayOfWeek), seconds: Number(r.seconds) }));
}

export async function queryLanguages(from: string, to: string) {
  const rows = await prisma.dailyStat.groupBy({
    by: ["language"],
    where: { day: { gte: from, lte: to } },
    _sum: { totalSeconds: true },
    orderBy: { _sum: { totalSeconds: "desc" } }
  });

  return rows.map((r) => ({
    language: r.language,
    seconds: r._sum.totalSeconds ?? 0
  }));
}

export async function queryDailyTotals(from: string, to: string) {
  const rows = await prisma.dailyStat.groupBy({
    by: ["day"],
    where: { day: { gte: from, lte: to } },
    _sum: { totalSeconds: true },
    orderBy: { day: "asc" }
  });

  return rows.map((r) => ({
    day: r.day,
    seconds: r._sum.totalSeconds ?? 0
  }));
}
