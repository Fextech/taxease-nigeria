"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode, type MouseEvent } from "react";

/**
 * A link that checks maintenance mode before navigating to /sign-up.
 * If maintenance is active, redirects to /maintenance instead.
 */
export default function SignUpLink({ className, children }: { className?: string; children: ReactNode }) {
  const router = useRouter();
  const [maintenanceActive, setMaintenanceActive] = useState(false);

  useEffect(() => {
    fetch("/api/maintenance")
      .then(r => r.json())
      .then(d => { if (d.enabled) setMaintenanceActive(true); })
      .catch(() => {});
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    e.preventDefault();
    router.push(maintenanceActive ? "/maintenance" : "/sign-up");
  }, [maintenanceActive, router]);

  return (
    <a href="/sign-up" onClick={handleClick} className={className}>
      {children}
    </a>
  );
}
