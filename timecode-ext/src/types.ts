export type EditorName = "vscode";

export interface TimecodeEvent {
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

export interface TrackingConfig {
  enabled: boolean;
  dashboardUrl: string;
  heartbeatSeconds: number;
  includeFilePaths: boolean;
  includeProjectPaths: boolean;
  idleThresholdSeconds: number;
}

export interface TrackingContext {
  projectName: string;
  projectPath: string | null;
  filePath: string | null;
  language: string;
}
