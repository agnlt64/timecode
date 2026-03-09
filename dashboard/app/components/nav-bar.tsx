"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

export function NavBar() {
  const pathname = usePathname();
  const { machineId } = useParams<{ machineId: string }>();

  const links = [
    { href: `/${machineId}`, label: "Overview" },
    { href: `/${machineId}/projects`, label: "Projects" },
    { href: `/${machineId}/languages`, label: "Languages" },
    { href: `/${machineId}/weekdays`, label: "Weekdays" }
  ];

  return (
    <nav className="flex items-center rounded-lg border border-border bg-surface p-1 gap-0.5">
      {links.map((link) => {
        const isActive = link.href === `/${machineId}` ? pathname === `/${machineId}` : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-accent-dim text-accent"
                : "text-muted hover:text-white hover:bg-surface-hover"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
