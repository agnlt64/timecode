import { NavLink, Outlet } from "react-router";

const links = [
  { to: "/", label: "Overview" },
  { to: "/projects", label: "Projects" },
  { to: "/languages", label: "Languages" },
  { to: "/weekdays", label: "Weekdays" },
  { to: "/settings", label: "Settings" }
];

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-[1400px] px-4 py-6 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        <aside className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 h-fit">
          <h1 className="text-xl font-semibold">Timecode</h1>
          <p className="mt-1 text-xs text-slate-400">Local dashboard</p>
          <nav className="mt-5 space-y-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `block rounded-md px-3 py-2 text-sm transition ${
                    isActive ? "bg-cyan-400/15 text-cyan-200" : "text-slate-300 hover:bg-slate-800"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="space-y-4">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
