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

export interface IngestEventsRequest {
  events: TimecodeEvent[];
}

export interface IngestEventsResponse {
  accepted: number;
  duplicates: number;
  rejected: number;
}

export interface HealthResponse {
  status: "ok";
  version: string;
  schemaVersion: number;
}
