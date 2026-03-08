"use client";

import { ReactNode, useEffect } from "react";
import { MiniKit } from "@worldcoin/minikit-js";

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`;

export function MiniKitSetup({ children }: { children: ReactNode }) {
  useEffect(() => {
    MiniKit.install(APP_ID);
  }, []);

  return <>{children}</>;
}
