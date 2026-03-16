"use client";

import { useEffect, useState } from "react";

/**
 * Hides children for a brief period, then fades them in.
 * Used on the landing page so MiniKit redirect has time to fire
 * before the user sees the desktop landing page.
 */
export function DelayedReveal({
  children,
  delay = 200,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 150ms ease-in",
      }}
    >
      {children}
    </div>
  );
}
