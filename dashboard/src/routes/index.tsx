import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md w-full space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Timecode</h1>
        <p className="text-muted text-sm leading-relaxed">
          To access your dashboard, open VS Code and run the{" "}
          <span className="font-mono text-accent">Timecode: Open Dashboard</span>{" "}
          command. Your personal URL will be opened automatically.
        </p>
        <p className="text-muted text-xs">
          Or navigate directly to{" "}
          <span className="font-mono text-white/60">/{"{your-machine-id}"}</span>
        </p>
      </div>
    </div>
  );
}
