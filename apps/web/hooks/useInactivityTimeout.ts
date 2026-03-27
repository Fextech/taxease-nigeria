"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { signOut } from "next-auth/react";

const TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const WARNING_MS = 58 * 60 * 1000; // show warning at 58 minutes

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "click",
];

export function useInactivityTimeout() {
  const [isWarning, setIsWarning] = useState(false);
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
  }, []);

  const resetTimer = useCallback(() => {
    clearTimers();
    setIsWarning(false);

    warningTimer.current = setTimeout(() => {
      setIsWarning(true);
    }, WARNING_MS);

    logoutTimer.current = setTimeout(() => {
      void signOut({ callbackUrl: "/sign-in?reason=timeout" });
    }, TIMEOUT_MS);
  }, [clearTimers]);

  useEffect(() => {
    // Start the timers on mount
    resetTimer();

    // Listen for activity on the window
    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, handler, { passive: true })
    );

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, handler)
      );
    };
  }, [resetTimer, clearTimers]);

  return { isWarning, resetTimer };
}
