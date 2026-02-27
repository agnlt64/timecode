"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Overview" },
  { href: "/projects", label: "Projects" },
  { href: "/languages", label: "Languages" },
  { href: "/weekdays", label: "Weekdays" }
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center rounded-lg border border-border bg-surface p-1 gap-0.5">
      {links.map((link) => {
        const isActive = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
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
