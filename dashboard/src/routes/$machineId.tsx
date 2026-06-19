import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/$machineId")({
  component: MachineLayout,
});

function MachineLayout() {
  const { machineId } = Route.useParams();

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 h-12 flex items-center gap-3">
          <span className="text-[11px] font-mono tracking-[0.22em] uppercase text-muted-2 font-medium">
            Timecode
          </span>
          <span className="text-border-2">·</span>
          <span className="text-[11px] font-mono text-muted truncate">{machineId}</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-12">
        <Outlet />
      </main>
    </div>
  );
}
