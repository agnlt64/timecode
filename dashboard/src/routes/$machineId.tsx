import { createFileRoute, Outlet } from "@tanstack/react-router";
import { NavBar } from "@/components/nav-bar";

export const Route = createFileRoute("/$machineId")({
  component: MachineLayout,
});

function MachineLayout() {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Timecode</span>
          <NavBar />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <Outlet />
      </main>
    </>
  );
}
