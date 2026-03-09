import { NavBar } from "@/app/components/nav-bar";

export default function MachineLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight">Timecode</span>
          <NavBar />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        {children}
      </main>
    </>
  );
}
