import { NavLink, Outlet } from "react-router";

const links = [
  { to: "/", label: "Overview" },
  { to: "/projects", label: "Projects" },
  { to: "/languages", label: "Languages" },
  { to: "/weekdays", label: "Weekdays" }
];

export default function DashboardLayout() {
  return (
    <div className="min-h-screen" style={{ background: "#111113" }}>
      {/* Top nav */}
      <header className="border-b border-border">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">Timecode</span>
          </div>

          <nav className="flex items-center rounded-lg border border-border bg-surface p-1 gap-0.5">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${isActive
                    ? "bg-accent-dim text-accent"
                    : "text-muted hover:text-white hover:bg-surface-hover"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <Outlet />
      </main>
    </div>
  );
}
