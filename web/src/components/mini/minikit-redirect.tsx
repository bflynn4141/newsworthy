"use client";

import { useEffect } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { useRouter } from "next/navigation";

function setWorldAppCookie() {
  document.cookie = "worldapp=1; path=/; max-age=7776000"; // 90 days
}

export function MiniKitRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Check immediately
    if (MiniKit.isInstalled() || (typeof window !== "undefined" && (window as any).WorldApp)) {
      setWorldAppCookie();
      router.replace("/mini");
      return;
    }

    // Poll with retry — MiniKit.install() may not have completed yet
    let attempts = 0;
    const maxAttempts = 20;

    const interval = setInterval(() => {
      attempts++;
      if (MiniKit.isInstalled() || (typeof window !== "undefined" && (window as any).WorldApp)) {
        clearInterval(interval);
        setWorldAppCookie();
        router.replace("/mini");
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
