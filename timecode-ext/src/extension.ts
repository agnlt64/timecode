import { createHash, randomUUID } from "node:crypto";
import { platform } from "node:os";
import { basename } from "node:path";
import * as vscode from "vscode";
import { EventQueue, localDayString } from "./queue";
import type { TimecodeEvent, TrackingConfig, TrackingContext } from "./types";

const MACHINE_ID_KEY = "timecode.machineId";

let tracker: TimecodeTracker | undefined;

class TimecodeTracker implements vscode.Disposable {
  private readonly statusBar: vscode.StatusBarItem;
  private readonly subscriptions: vscode.Disposable[] = [];
  private readonly queue = new EventQueue();

  private config: TrackingConfig;
  private machineId = "";

  private currentContext: TrackingContext | null = null;
  private lastActivityAtMs = Date.now();
  private segmentStartedAtMs = Date.now();
  private writeSinceLastFlush = false;
  private isFocused = vscode.window.state.focused;

  private heartbeatTimer: NodeJS.Timeout | undefined;

  public constructor(private readonly extensionContext: vscode.ExtensionContext) {
    this.config = this.loadConfig();
    this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.statusBar.command = "timecode.showTrackingStatus";
    this.statusBar.show();
  }

  public async start(): Promise<void> {
    this.machineId = await this.getOrCreateMachineId();
    this.currentContext = this.resolveTrackingContext(vscode.window.activeTextEditor?.document);
    this.queue.configure(this.config.dashboardUrl);
    this.registerEventHandlers();
    this.registerCommands();
    this.restartHeartbeatTimer();
    this.updateStatusBar();
  }

  /** Synchronous cleanup — call flushQueue() first when shutting down. */
  public dispose(): void {
    this.flushSegmentIfNeeded(Date.now());
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
    for (const disposable of this.subscriptions) {
      disposable.dispose();
    }
    this.queue.stop();
    this.statusBar.dispose();
  }

  /** Async: send all pending events to the API before shutting down. */
  public async flushQueue(): Promise<void> {
    await this.queue.flush();
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
        const previousDashboardUrl = this.config.dashboardUrl;
        const previousHeartbeat = this.config.heartbeatSeconds;
        this.config = this.loadConfig();
        if (previousDashboardUrl !== this.config.dashboardUrl) {
          this.queue.configure(this.config.dashboardUrl);
        }
        if (previousHeartbeat !== this.config.heartbeatSeconds) {
          this.restartHeartbeatTimer();
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
        const today = localDayString(new Date());
        const state = this.statusLabel();
        const error = this.queue.getError();
        const details = [
          `State: ${state}`,
          `Spent today: ${this.formatDuration(this.queue.getTodaySeconds(today) + this.currentSegmentSeconds())}`,
          `API: ${this.config.dashboardUrl}`,
          `Queued: ${this.queue.getPendingCount()} event(s)`
        ];
        if (error) {
          details.push(`Error: ${error}`);
        }
        await vscode.window.showInformationMessage(details.join(" | "));
      })
    );

    this.subscriptions.push(
      vscode.commands.registerCommand("timecode.flushQueue", async () => {
        await this.queue.flush();
        const error = this.queue.getError();
        const pending = this.queue.getPendingCount();
        await vscode.window.showInformationMessage(
          error
            ? `Flush failed: ${error}`
            : `Flushed successfully. ${pending > 0 ? `${pending} event(s) still queued.` : "Queue empty."}`
        );
      })
    );
  }

  private loadConfig(): TrackingConfig {
    const config = vscode.workspace.getConfiguration("timecode");
    return {
      enabled: config.get<boolean>("enabled", true),
      dashboardUrl: config.get<string>("dashboardUrl", "http://127.0.0.1:3000"),
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

    return { id: this.makeEventId(payload), ...payload };
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
    return { projectName, projectPath, filePath, language };
  }

  private isSameContext(a: TrackingContext, b: TrackingContext): boolean {
    return (
      a.projectName === b.projectName &&
      a.projectPath === b.projectPath &&
      a.filePath === b.filePath &&
      a.language === b.language
    );
  }

  private writeEvent(event: TimecodeEvent): void {
    this.queue.enqueue(event);
    this.updateStatusBar();
  }

  private statusLabel(): string {
    if (!this.config.enabled) {
      return "Disabled";
    }
    if (this.queue.getError()) {
      return "API Error";
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
      !this.queue.getError() &&
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
    const today = localDayString(new Date());
    const spent = this.formatDuration(this.queue.getTodaySeconds(today) + this.currentSegmentSeconds());

    if (!this.config.enabled) {
      this.statusBar.text = "Timecode: Disabled";
    } else if (state === "Tracking") {
      this.statusBar.text = `Timecode: Spent ${spent} coding`;
    } else {
      this.statusBar.text = `Timecode: Spent ${spent} coding (${state})`;
    }

    const pending = this.queue.getPendingCount();
    const error = this.queue.getError();
    const pendingInfo = pending > 0 ? ` | ${pending} queued` : "";
    const errorInfo = error ? ` | Error: ${error}` : "";
    this.statusBar.tooltip = `State: ${state} | API: ${this.config.dashboardUrl}${pendingInfo}${errorInfo}`;
  }
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  tracker = new TimecodeTracker(context);
  await tracker.start();
  context.subscriptions.push(tracker);
}

export async function deactivate(): Promise<void> {
  if (tracker) {
    // Seal the current segment into the queue, then flush everything to the API.
    tracker.dispose();
    await tracker.flushQueue();
    tracker = undefined;
  }
}
