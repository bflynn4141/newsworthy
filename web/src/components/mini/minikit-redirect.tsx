"use client";

import { useEffect } from "react";
import { MiniKit } from "@worldcoin/minikit-js";
import { useRouter } from "next/navigation";

export function MiniKitRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (MiniKit.isInstalled()) {
      router.replace("/mini");
    }
  }, [router]);

  return null;
}
