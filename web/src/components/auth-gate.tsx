"use client";

import { IDKitWidget, VerificationLevel } from "@worldcoin/idkit";
import type { ISuccessResult } from "@worldcoin/idkit";
import { useRouter } from "next/navigation";

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID as `app_${string}`;

export function AuthGate() {
  const router = useRouter();

  async function handleVerify(proof: ISuccessResult) {
    const res = await fetch("/api/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(proof),
    });
    if (!res.ok) throw new Error("Verification failed");
  }

  function onSuccess() {
    router.refresh();
  }

  return (
    <div className="relative">
      {/* Fade overlay */}
      <div className="h-32 bg-gradient-to-b from-transparent to-background" />

      {/* Auth wall */}
      <div className="flex flex-col items-center justify-center py-12 px-4 bg-background">
        <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-secondary"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l3 3" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Verify to read more
        </h2>
        <p className="text-secondary text-[15px] text-center max-w-xs mb-6">
          Newsworthy is free for humans. Sign in with World ID to access the
          full feed.
        </p>
        <IDKitWidget
          app_id={APP_ID}
          action="read-feed"
          verification_level={VerificationLevel.Device}
          handleVerify={handleVerify}
          onSuccess={onSuccess}
        >
          {({ open }: { open: () => void }) => (
            <button
              onClick={open}
              className="flex items-center gap-2 px-6 py-3 bg-foreground text-background rounded-full font-semibold text-[15px] hover:opacity-90 transition-opacity"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 256 256"
                fill="currentColor"
              >
                <path d="M128 0C57.3 0 0 57.3 0 128s57.3 128 128 128 128-57.3 128-128S198.7 0 128 0zm0 48c44.2 0 80 35.8 80 80s-35.8 80-80 80-80-35.8-80-80 35.8-80 80-80z" />
              </svg>
              Sign in with World ID
            </button>
          )}
        </IDKitWidget>
      </div>
    </div>
  );
}
