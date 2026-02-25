import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { homedir, platform } from "node:os";
import { basename, dirname, join } from "node:path";
import * as vscode from "vscode";

type EditorName = "vscode";

interface TimecodeEvent {
  id: string;
  machineId: string;
  os: string;
  editor: EditorName;
  projectName: string;
  projectPath: string | null;
  filePath: string | null;
  language: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  isWrite: boolean;
}

interface TrackingConfig {
  enabled: boolean;
  dashboardUrl: string;
  dbPath: string;
  heartbeatSeconds: number;
  includeFilePaths: boolean;
  includeProjectPaths: boolean;
  idleThresholdSeconds: number;
}

interface TrackingContext {
  projectName: string;
  projectPath: string | null;
  filePath: string | null;
  language: string;
}

type SqliteRunResult = { changes?: number };
type SqliteStatement = {
  run: (params?: Record<string, unknown> | unknown[] | unknown) => SqliteRunResult;
  get: (params?: Record<string, unknown> | unknown[] | unknown) => Record<string, unknown> | undefined;
};
type SqliteDatabase = {
  exec: (sql: string) => void;
  prepare: (sql: string) => SqliteStatement;
  close: () => void;
};

type DatabaseSyncCtor = new (path: string) => SqliteDatabase;

const MACHINE_ID_KEY = "timecode.machineId";

let tracker: TimecodeTracker | undefined;

class LocalStore {
  private db: SqliteDatabase | null = null;
  private dbPath = "";

  private insertEventStmt: SqliteStatement | null = null;
  private upsertDailyStmt: SqliteStatement | null = null;
  private queryTodayStmt: SqliteStatement | null = null;

  public open(requestedPath: string): string {
    this.close();

    const resolvedPath = requestedPath.length > 0 ? requestedPath : join(homedir(), ".config", "timecode", "timecode.db");
    mkdirSync(dirname(resolvedPath), { recursive: true });

    const dbCtor = this.loadDatabaseSync();
    const db = new dbCtor(resolvedPath);

    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec("PRAGMA temp_store = MEMORY;");

    db.exec(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        machine_id TEXT NOT NULL,
        editor TEXT NOT NULL,
        os TEXT NOT NULL,
        project_name TEXT NOT NULL,
        project_path TEXT,
        file_path TEXT,
        language TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        is_write INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_events_started_at ON events(started_at);
      CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_name);
      CREATE INDEX IF NOT EXISTS idx_events_language ON events(language);

      CREATE TABLE IF NOT EXISTS daily_stats (
        day TEXT NOT NULL,
        project_name TEXT NOT NULL,
        language TEXT NOT NULL,
        total_seconds INTEGER NOT NULL,
        active_seconds INTEGER NOT NULL,
        events_count INTEGER NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        PRIMARY KEY (day, project_name, language)
      );
    `);

    this.insertEventStmt = db.prepare(`
      INSERT INTO events (
        id, machine_id, editor, os, project_name, project_path, file_path,
        language, started_at, ended_at, duration_seconds, is_write
      ) VALUES (
        @id, @machine_id, @editor, @os, @project_name, @project_path, @file_path,
        @language, @started_at, @ended_at, @duration_seconds, @is_write
      )
      ON CONFLICT(id) DO NOTHING
    `);

    this.upsertDailyStmt = db.prepare(`
      INSERT INTO daily_stats (day, project_name, language, total_seconds, active_seconds, events_count)
      VALUES (@day, @project_name, @language, @duration_seconds, @duration_seconds, 1)
      ON CONFLICT(day, project_name, language) DO UPDATE SET
        total_seconds = total_seconds + excluded.total_seconds,
        active_seconds = active_seconds + excluded.active_seconds,
        events_count = events_count + 1,
        updated_at = (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    `);

    this.queryTodayStmt = db.prepare(`
      SELECT COALESCE(SUM(total_seconds), 0) AS seconds
      FROM daily_stats
      WHERE day = ?
    `);

    this.db = db;
    this.dbPath = resolvedPath;
    return resolvedPath;
  }

  public close(): void {
    if (this.db) {
      this.db.close();
    }
    this.db = null;
    this.dbPath = "";
    this.insertEventStmt = null;
    this.upsertDailyStmt = null;
    this.queryTodayStmt = null;
  }

  public getPath(): string {
    return this.dbPath;
  }

  public isOpen(): boolean {
    return this.db !== null;
  }

  public insertEvent(event: TimecodeEvent): boolean {
    if (!this.db || !this.insertEventStmt || !this.upsertDailyStmt) {
      throw new Error("Database is not open.");
    }

    this.db.exec("BEGIN");
    try {
      const insertResult = this.insertEventStmt.run({
        id: event.id,
        machine_id: event.machineId,
        editor: event.editor,
        os: event.os,
        project_name: event.projectName,
        project_path: event.projectPath,
        file_path: event.filePath,
        language: event.language,
        started_at: event.startedAt,
        ended_at: event.endedAt,
        duration_seconds: event.durationSeconds,
        is_write: event.isWrite ? 1 : 0
      });

      const inserted = (insertResult.changes ?? 0) > 0;
      if (inserted) {
        this.upsertDailyStmt.run({
          day: this.localDayFromISO(event.startedAt),
          project_name: event.projectName,
          language: event.language,
          duration_seconds: event.durationSeconds
        });
      }

      this.db.exec("COMMIT");
      return inserted;
    } catch {
      this.db.exec("ROLLBACK");
      throw new Error("Failed to write event to database.");
    }
  }

  public todayTotalSeconds(day: string): number {
    if (!this.queryTodayStmt) {
      return 0;
    }

    const row = this.queryTodayStmt.get([day]);
    const seconds = row?.seconds;
    if (typeof seconds === "number") {
      return seconds;
    }
    return 0;
  }

  private localDayFromISO(isoUtc: string): string {
    const d = new Date(isoUtc);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private loadDatabaseSync(): DatabaseSyncCtor {
    const dynamicRequire = require as (id: string) => unknown;
    const mod = dynamicRequire("node:sqlite") as { DatabaseSync?: DatabaseSyncCtor };
    if (!mod.DatabaseSync) {
      throw new Error("node:sqlite is unavailable in this VS Code runtime.");
    }
    return mod.DatabaseSync;
  }
}

class TimecodeTracker implements vscode.Disposable {
  private readonly statusBar: vscode.StatusBarItem;
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly store = new LocalStore();

  private config: TrackingConfig;
  private machineId = "";

  private currentContext: TrackingContext | null = null;
  private lastActivityAtMs = Date.now();
  private segmentStartedAtMs = Date.now();
  private writeSinceLastFlush = false;
  private isFocused = vscode.window.state.focused;

  private dailyTotalSeconds = 0;
  private dailyTotalDay = "";

  private heartbeatTimer: NodeJS.Timeout | undefined;
  private dbError: string | null = null;

  public constructor(private readonly extensionContext: vscode.ExtensionContext) {
    this.config = this.loadConfig();
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = "timecode.showTrackingStatus";
    this.statusBar.show();
  }

  public async start(): Promise<void> {
    this.machineId = await this.getOrCreateMachineId();
    this.currentContext = this.resolveTrackingContext(vscode.window.activeTextEditor?.document);
    this.reopenStore();

    this.registerEventHandlers();
    this.registerCommands();
    this.restartHeartbeatTimer();
    this.updateStatusBar();
  }

  public dispose(): void {
    this.flushSegmentIfNeeded(Date.now());
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    for (const disposable of this.subscriptions) {
      disposable.dispose();
    }
    this.store.close();
    this.statusBar.dispose();
  }

  private registerEventHandlers(): void {
    this.subscriptions.push(
      vscode.window.onDidChangeWindowState((state) => {
        const now = Date.now();
        if (!state.focused && this.isFocused) {
          this.flushSegmentIfNeeded(now);
          this.segmentStartedAtMs = now;
        }

        this.isFocused = state.focused;
        if (state.focused) {
          this.markActivity(false);
        }
        this.updateStatusBar();
      })
    );

    this.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        this.markActivity(false, editor?.document);
      })
    );

    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.markActivity(true, event.document);
      })
    );

    this.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((document) => {
        this.markActivity(true, document);
      })
    );

    this.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((event) => {
        if (!event.affectsConfiguration("timecode")) {
          return;
        }

        const previousHeartbeat = this.config.heartbeatSeconds;
        const previousDbPath = this.config.dbPath;
        this.config = this.loadConfig();

        if (previousHeartbeat !== this.config.heartbeatSeconds) {
          this.restartHeartbeatTimer();
        }
        if (previousDbPath !== this.config.dbPath) {
          this.reopenStore();
        }
        this.updateStatusBar();
      })
    );
  }

  private registerCommands(): void {
    this.subscriptions.push(
      vscode.commands.registerCommand("timecode.openDashboard", async () => {
        await vscode.env.openExternal(vscode.Uri.parse(this.config.dashboardUrl));
      })
    );

    this.subscriptions.push(
      vscode.commands.registerCommand("timecode.showTrackingStatus", async () => {
        const state = this.statusLabel();
        const details = [
          `State: ${state}`,
          `Spent today: ${this.formatDuration(this.dailyTotalSeconds + this.currentSegmentSeconds())}`,
          `DB: ${this.store.getPath() || "not opened"}`
        ];
        if (this.dbError) {
          details.push(`DB error: ${this.dbError}`);
        }
        await vscode.window.showInformationMessage(details.join(" | "));
      })
    );

    this.subscriptions.push(
      vscode.commands.registerCommand("timecode.reopenDatabase", async () => {
        this.reopenStore();
        await vscode.window.showInformationMessage(this.dbError ? `Database error: ${this.dbError}` : "Database reopened.");
      })
    );
  }

  private loadConfig(): TrackingConfig {
    const config = vscode.workspace.getConfiguration("timecode");
    return {
      enabled: config.get<boolean>("enabled", true),
      dashboardUrl: config.get<string>("dashboardUrl", "http://127.0.0.1:5173"),
      dbPath: config.get<string>("dbPath", ""),
      heartbeatSeconds: Math.max(5, config.get<number>("heartbeatSeconds", 30)),
      includeFilePaths: config.get<boolean>("includeFilePaths", false),
      includeProjectPaths: config.get<boolean>("includeProjectPaths", false),
      idleThresholdSeconds: Math.max(30, config.get<number>("idleThresholdSeconds", 120))
    };
  }

  private async getOrCreateMachineId(): Promise<string> {
    const existing = this.extensionContext.globalState.get<string>(MACHINE_ID_KEY);
    if (existing && existing.length > 0) {
      return existing;
    }

    const machineId = randomUUID();
    await this.extensionContext.globalState.update(MACHINE_ID_KEY, machineId);
    return machineId;
  }

  private reopenStore(): void {
    try {
      this.store.open(this.config.dbPath);
      this.dbError = null;
      this.syncDailyTotalFromDb();
    } catch (error) {
      this.dbError = error instanceof Error ? error.message : "Unknown database error";
    }
  }

  private restartHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      this.handleHeartbeatTick();
    }, this.config.heartbeatSeconds * 1_000);
  }

  private handleHeartbeatTick(): void {
    const now = Date.now();

    if (!this.config.enabled || !this.isFocused) {
      this.updateStatusBar();
      return;
    }

    if (now - this.lastActivityAtMs > this.config.idleThresholdSeconds * 1_000) {
      this.updateStatusBar();
      return;
    }

    if (!this.currentContext) {
      this.currentContext = this.resolveTrackingContext(vscode.window.activeTextEditor?.document);
      if (!this.currentContext) {
        this.updateStatusBar();
        return;
      }
    }

    const event = this.buildEvent(this.segmentStartedAtMs, now, this.currentContext, this.writeSinceLastFlush);
    this.segmentStartedAtMs = now;
    this.writeSinceLastFlush = false;

    if (event) {
      this.writeEvent(event);
    }

    this.updateStatusBar();
  }

  private markActivity(isWrite: boolean, document?: vscode.TextDocument): void {
    const now = Date.now();
    const nextContext = this.resolveTrackingContext(document ?? vscode.window.activeTextEditor?.document);

    if (nextContext && this.currentContext && !this.isSameContext(this.currentContext, nextContext)) {
      this.flushSegmentIfNeeded(now);
      this.segmentStartedAtMs = now;
      this.writeSinceLastFlush = false;
    }

    if (!this.currentContext && nextContext) {
      this.currentContext = nextContext;
      this.segmentStartedAtMs = now;
    } else if (nextContext) {
      this.currentContext = nextContext;
    }

    this.lastActivityAtMs = now;
    if (isWrite) {
      this.writeSinceLastFlush = true;
    }
    this.updateStatusBar();
  }

  private flushSegmentIfNeeded(now: number): void {
    if (!this.currentContext) {
      return;
    }

    const event = this.buildEvent(this.segmentStartedAtMs, now, this.currentContext, this.writeSinceLastFlush);
    this.segmentStartedAtMs = now;
    this.writeSinceLastFlush = false;

    if (event) {
      this.writeEvent(event);
    }
  }

  private buildEvent(
    startedAtMs: number,
    endedAtMs: number,
    context: TrackingContext,
    isWrite: boolean
  ): TimecodeEvent | null {
    if (endedAtMs <= startedAtMs) {
      return null;
    }

    const durationSeconds = Math.floor((endedAtMs - startedAtMs) / 1_000);
    if (durationSeconds <= 0) {
      return null;
    }

    const startedAt = new Date(startedAtMs).toISOString();
    const endedAt = new Date(endedAtMs).toISOString();
    const projectPath = this.config.includeProjectPaths ? context.projectPath : null;
    const filePath = this.config.includeFilePaths ? context.filePath : null;

    const payload = {
      machineId: this.machineId,
      os: platform(),
      editor: "vscode" as const,
      projectName: context.projectName,
      projectPath,
      filePath,
      language: context.language,
      startedAt,
      endedAt,
      durationSeconds,
      isWrite
    };

    return {
      id: this.makeEventId(payload),
      ...payload
    };
  }

  private makeEventId(payload: Omit<TimecodeEvent, "id">): string {
    return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  }

  private resolveTrackingContext(document?: vscode.TextDocument): TrackingContext | null {
    const active = document ?? vscode.window.activeTextEditor?.document;
    if (!active) {
      return null;
    }

    const workspaceFolder = vscode.workspace.getWorkspaceFolder(active.uri);
    const projectPath = workspaceFolder?.uri.fsPath ?? null;
    const projectName = workspaceFolder ? basename(workspaceFolder.uri.fsPath) : "no-project";
    const filePath = active.uri.scheme === "file" ? active.uri.fsPath : null;
    const language = active.languageId || "plaintext";

    return {
      projectName,
      projectPath,
      filePath,
      language
    };
  }

  private isSameContext(a: TrackingContext, b: TrackingContext): boolean {
    return (
      a.projectName === b.projectName &&
      a.projectPath === b.projectPath &&
      a.filePath === b.filePath &&
      a.language === b.language
    );
  }

  private localDayString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  private syncDailyTotalFromDb(): void {
    const today = this.localDayString(new Date());
    this.dailyTotalDay = today;
    this.dailyTotalSeconds = this.store.todayTotalSeconds(today);
  }

  private writeEvent(event: TimecodeEvent): void {
    if (!this.store.isOpen()) {
      this.reopenStore();
      if (!this.store.isOpen()) {
        this.updateStatusBar();
        return;
      }
    }

    try {
      const inserted = this.store.insertEvent(event);
      this.dbError = null;
      if (inserted) {
        const today = this.localDayString(new Date());
        const eventDay = this.localDayString(new Date(event.startedAt));

        if (this.dailyTotalDay !== today) {
          this.syncDailyTotalFromDb();
        }
        if (eventDay === today) {
          this.dailyTotalSeconds += event.durationSeconds;
        }
      }
    } catch (error) {
      this.dbError = error instanceof Error ? error.message : "Failed writing to DB";
    }
  }

  private statusLabel(): string {
    if (!this.config.enabled) {
      return "Disabled";
    }
    if (this.dbError) {
      return "DB Error";
    }
    if (!this.isFocused || Date.now() - this.lastActivityAtMs > this.config.idleThresholdSeconds * 1_000) {
      return "Idle";
    }
    return "Tracking";
  }

  private formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  private currentSegmentSeconds(): number {
    const trackingNow =
      this.config.enabled &&
      !this.dbError &&
      this.currentContext !== null &&
      this.isFocused &&
      Date.now() - this.lastActivityAtMs <= this.config.idleThresholdSeconds * 1_000;

    if (!trackingNow) {
      return 0;
    }

    return Math.max(0, Math.floor((Date.now() - this.segmentStartedAtMs) / 1_000));
  }

  private updateStatusBar(): void {
    const state = this.statusLabel();
    const spent = this.formatDuration(this.dailyTotalSeconds + this.currentSegmentSeconds());

    if (!this.config.enabled) {
      this.statusBar.text = "Timecode: Disabled";
    } else if (state === "Tracking") {
      this.statusBar.text = `Timecode: Spent ${spent} coding`;
    } else {
      this.statusBar.text = `Timecode: Spent ${spent} coding (${state})`;
    }

    const dbPart = this.store.getPath() || "unavailable";
    this.statusBar.tooltip = `State: ${state} | DB: ${dbPart}`;
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  tracker = new TimecodeTracker(context);
  await tracker.start();
  context.subscriptions.push(tracker);
}

export function deactivate(): void {
  tracker?.dispose();
  tracker = undefined;
}
