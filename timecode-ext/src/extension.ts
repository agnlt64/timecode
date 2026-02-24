import { createHash, randomUUID } from "node:crypto";
import { basename } from "node:path";
import { platform } from "node:os";
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

interface IngestEventsRequest {
  events: TimecodeEvent[];
}

interface IngestEventsResponse {
  accepted: number;
  duplicates: number;
  rejected: number;
}

interface TrackingConfig {
  enabled: boolean;
  apiBaseUrl: string;
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

const QUEUE_STATE_KEY = "timecode.pendingEvents";
const MACHINE_ID_KEY = "timecode.machineId";
const DAILY_TOTAL_KEY = "timecode.dailyTotal";
const MAX_BATCH_SIZE = 500;
const INITIAL_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;

let tracker: TimecodeTracker | undefined;

class TimecodeTracker implements vscode.Disposable {
  private readonly statusBar: vscode.StatusBarItem;
  private readonly subscriptions: vscode.Disposable[] = [];

  private config: TrackingConfig;
  private pendingEvents: TimecodeEvent[] = [];
  private machineId = "";

  private currentContext: TrackingContext | null = null;
  private lastActivityAtMs = Date.now();
  private segmentStartedAtMs = Date.now();
  private writeSinceLastFlush = false;
  private isFocused = vscode.window.state.focused;

  private dailyTotalSeconds = 0;
  private dailyTotalDay = "";

  private heartbeatTimer: NodeJS.Timeout | undefined;
  private retryTimer: NodeJS.Timeout | undefined;
  private persistQueueTimer: NodeJS.Timeout | undefined;

  private isSending = false;
  private serverOffline = false;
  private retryBackoffMs = INITIAL_RETRY_MS;

  public constructor(private readonly extensionContext: vscode.ExtensionContext) {
    this.config = this.loadConfig();
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = "timecode.showTrackingStatus";
    this.statusBar.show();
  }

  public async start(): Promise<void> {
    this.machineId = await this.getOrCreateMachineId();
    this.pendingEvents = this.extensionContext.globalState.get<TimecodeEvent[]>(QUEUE_STATE_KEY, []);
    this.loadDailyTotal();
    this.currentContext = this.resolveTrackingContext(vscode.window.activeTextEditor?.document);

    this.registerEventHandlers();
    this.registerCommands();
    this.restartHeartbeatTimer();
    this.scheduleFlush(0);
    this.updateStatusBar();
  }

  public dispose(): void {
    this.flushSegmentIfNeeded(Date.now());
    this.persistQueueNow();

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
    if (this.persistQueueTimer) {
      clearTimeout(this.persistQueueTimer);
    }

    for (const disposable of this.subscriptions) {
      disposable.dispose();
    }
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

        const previousInterval = this.config.heartbeatSeconds;
        this.config = this.loadConfig();
        if (previousInterval !== this.config.heartbeatSeconds) {
          this.restartHeartbeatTimer();
        }
        this.updateStatusBar();
      })
    );
  }

  private registerCommands(): void {
    this.subscriptions.push(
      vscode.commands.registerCommand("timecode.openDashboard", async () => {
        await vscode.env.openExternal(vscode.Uri.parse(this.config.apiBaseUrl));
      })
    );

    this.subscriptions.push(
      vscode.commands.registerCommand("timecode.showTrackingStatus", async () => {
        const state = this.statusLabel();
        const details = [
          `State: ${state}`,
          `Spent today: ${this.formatDuration(this.dailyTotalSeconds + this.currentSegmentSeconds())}`,
          `Queued events: ${this.pendingEvents.length}`,
          `Server URL: ${this.config.apiBaseUrl}`
        ];
        await vscode.window.showInformationMessage(details.join(" | "));
      })
    );

    this.subscriptions.push(
      vscode.commands.registerCommand("timecode.restartConnection", async () => {
        this.serverOffline = false;
        this.retryBackoffMs = INITIAL_RETRY_MS;
        if (this.retryTimer) {
          clearTimeout(this.retryTimer);
          this.retryTimer = undefined;
        }
        this.scheduleFlush(0);
        await vscode.window.showInformationMessage("Timecode connection restarted.");
      })
    );
  }

  private loadConfig(): TrackingConfig {
    const config = vscode.workspace.getConfiguration("timecode");
    return {
      enabled: config.get<boolean>("enabled", true),
      apiBaseUrl: config.get<string>("apiBaseUrl", "http://127.0.0.1:4821"),
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
      this.enqueueEvent(event);
      this.scheduleFlush(0);
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

    if (!event) {
      return;
    }

    this.enqueueEvent(event);
    this.scheduleFlush(0);
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

    const id = this.makeEventId({
      machineId: this.machineId,
      editor: "vscode",
      os: platform(),
      projectName: context.projectName,
      projectPath,
      filePath,
      language: context.language,
      startedAt,
      endedAt,
      durationSeconds,
      isWrite
    });

    return {
      id,
      machineId: this.machineId,
      os: platform(),
      editor: "vscode",
      projectName: context.projectName,
      projectPath,
      filePath,
      language: context.language,
      startedAt,
      endedAt,
      durationSeconds,
      isWrite
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

  private loadDailyTotal(): void {
    const stored = this.extensionContext.globalState.get<{ day: string; seconds: number } | undefined>(
      DAILY_TOTAL_KEY
    );
    const today = this.localDayString(new Date());

    if (stored && stored.day === today) {
      this.dailyTotalDay = stored.day;
      this.dailyTotalSeconds = stored.seconds;
      return;
    }

    this.dailyTotalDay = today;
    this.dailyTotalSeconds = 0;
    this.persistDailyTotal();
  }

  private persistDailyTotal(): void {
    void this.extensionContext.globalState.update(DAILY_TOTAL_KEY, {
      day: this.dailyTotalDay,
      seconds: this.dailyTotalSeconds
    });
  }

  private incrementDailyTotal(seconds: number): void {
    const today = this.localDayString(new Date());
    if (this.dailyTotalDay !== today) {
      this.dailyTotalDay = today;
      this.dailyTotalSeconds = 0;
    }

    this.dailyTotalSeconds += seconds;
    this.persistDailyTotal();
  }

  private enqueueEvent(event: TimecodeEvent): void {
    this.pendingEvents.push(event);
    this.incrementDailyTotal(event.durationSeconds);
    this.persistQueueSoon();
  }

  private persistQueueSoon(): void {
    if (this.persistQueueTimer) {
      clearTimeout(this.persistQueueTimer);
    }

    this.persistQueueTimer = setTimeout(() => {
      this.persistQueueNow();
    }, 300);
  }

  private persistQueueNow(): void {
    void this.extensionContext.globalState.update(QUEUE_STATE_KEY, this.pendingEvents);
  }

  private scheduleFlush(delayMs: number): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.retryTimer = setTimeout(() => {
      void this.flushQueue();
    }, delayMs);
  }

  private async postEvents(payload: IngestEventsRequest): Promise<IngestEventsResponse> {
    const response = await fetch(`${this.config.apiBaseUrl}/api/v1/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Ingest failed with status ${response.status}`);
    }

    return (await response.json()) as IngestEventsResponse;
  }

  private async flushQueue(): Promise<void> {
    if (this.isSending || this.pendingEvents.length === 0 || !this.config.enabled) {
      return;
    }

    this.isSending = true;
    const batch = this.pendingEvents.slice(0, MAX_BATCH_SIZE);
    const payload: IngestEventsRequest = { events: batch };

    try {
      await this.postEvents(payload);
      this.pendingEvents.splice(0, batch.length);
      this.retryBackoffMs = INITIAL_RETRY_MS;
      this.serverOffline = false;
      this.persistQueueSoon();
    } catch {
      this.serverOffline = true;
      this.retryBackoffMs = Math.min(this.retryBackoffMs * 2, MAX_RETRY_MS);
      this.scheduleFlush(this.retryBackoffMs);
    } finally {
      this.isSending = false;
      this.updateStatusBar();
      if (!this.serverOffline && this.pendingEvents.length > 0) {
        this.scheduleFlush(0);
      }
    }
  }

  private statusLabel(): string {
    if (!this.config.enabled) {
      return "Disabled";
    }
    if (this.serverOffline) {
      return "Server Offline";
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

    this.statusBar.tooltip = `State: ${state} | Queued events: ${this.pendingEvents.length}`;
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
