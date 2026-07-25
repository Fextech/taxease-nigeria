"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const mobileNavItems = [
  { label: "Overview",    href: "/overview",    icon: "dashboard" },
  { label: "Statements",  href: "/statements",   icon: "description" },
  { label: "Annotations", href: "/annotations",  icon: "draw" },
  { label: "Reports",     href: "/reports",      icon: "bar_chart" },
  { label: "Settings",    href: "/settings",     icon: "settings" },
];

export default function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/overview" ? pathname === "/overview" : pathname.startsWith(href);

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {mobileNavItems.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mobile-nav-item ${active ? "mobile-nav-item--active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className="material-symbols-outlined mobile-nav-icon">
              {item.icon}
            </span>
            <span className="mobile-nav-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
