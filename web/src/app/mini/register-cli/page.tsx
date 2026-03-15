"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import {
  AGENTBOOK_ACTION,
  computeRegistrationSignal,
} from "@/lib/world-id";

const API_BASE = "https://newsworthy-api.bflynn4141.workers.dev";

type Status = "loading" | "ready" | "verifying" | "submitting" | "success" | "error";

function RegisterCliContent() {
  const searchParams = useSearchParams();
  const session = searchParams.get("session");

  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [agentAddress, setAgentAddress] = useState("");

  // Fetch session data from API
  useEffect(() => {
    if (!session) {
      setErrorMessage("Missing session parameter.");
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/register/session/${session}`);
        if (!res.ok) {
          const body = await res.text();
          throw new Error(
            res.status === 404
              ? "Session not found. Please scan the QR code again."
              : res.status === 410
                ? "Session expired. Run `register` in your terminal again."
                : body || `API error ${res.status}`,
          );
        }
        const data = (await res.json()) as {
          agentAddress: string;
          nonce: number;
          status: string;
        };

        if (data.status === "completed") {
          setAgentAddress(data.agentAddress);
          setStatus("success");
          return;
        }

        setAgentAddress(data.agentAddress);
        setStatus("ready");
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Failed to load session",
        );
        setStatus("error");
      }
    })();
  }, [session]);

  const handleVerify = useCallback(async () => {
    if (!session) return;

    try {
      setStatus("verifying");
      setErrorMessage("");

      // Re-fetch session to get fresh nonce
      const sessionRes = await fetch(`${API_BASE}/register/session/${session}`);
      if (!sessionRes.ok) throw new Error("Session no longer valid.");
      const sessionData = (await sessionRes.json()) as {
        agentAddress: string;
        nonce: number;
      };

      const signal = computeRegistrationSignal(
        sessionData.agentAddress as `0x${string}`,
        BigInt(sessionData.nonce),
      );

      // MiniKit.verify() — same pattern as register-view.tsx
      const verifyResult = await MiniKit.commandsAsync.verify({
        action: AGENTBOOK_ACTION,
        signal,
        verification_level: VerificationLevel.Orb,
      });

      if (!verifyResult?.finalPayload) {
        throw new Error("Verification was cancelled or failed.");
      }

      const payload = verifyResult.finalPayload as {
        merkle_root: string;
        nullifier_hash: string;
        proof: string;
        status: string;
      };

      if (payload.status === "error") {
        throw new Error("World ID verification failed. Please try again.");
      }

      // Post proof to API (CLI will pick it up via polling)
      setStatus("submitting");

      const proofRes = await fetch(`${API_BASE}/register/proof/${session}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merkle_root: payload.merkle_root,
          nullifier_hash: payload.nullifier_hash,
          proof: payload.proof,
        }),
      });

      if (!proofRes.ok) {
        const body = await proofRes.text();
        throw new Error(body || `Failed to submit proof (${proofRes.status})`);
      }

      setStatus("success");
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Verification failed",
      );
      setStatus("error");
    }
  }, [session]);

  // --- Loading ---
  if (status === "loading") {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <Spinner />
        <p className="text-[14px] mt-4 font-medium" style={{ color: "#1A1A1A" }}>
          Loading session&hellip;
        </p>
      </div>
    );
  }

  // --- Ready ---
  if (status === "ready") {
    return (
      <div className="flex flex-col items-center text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: "#EFF6FF" }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="1.5"
          >
            <path
              d="M12 2l7 4v5c0 5.25-3.5 8.75-7 10-3.5-1.25-7-4.75-7-10V6l7-4z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M9 12l2 2 4-4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="text-[15px] font-semibold" style={{ color: "#1A1A1A" }}>
          Verify with World ID
        </p>
        <p
          className="text-[13px] mt-1 mb-4 max-w-[240px]"
          style={{ color: "#A8A29E" }}
        >
          Prove you&apos;re human to register your agent on Newsworthy.
        </p>

        <div
          className="w-full rounded-lg border px-4 py-3 mb-5"
          style={{ borderColor: "#E7E5E4", backgroundColor: "#FAFAF8" }}
        >
          <p
            className="text-xs font-medium uppercase tracking-wide"
            style={{ color: "#A8A29E" }}
          >
            Agent Address
          </p>
          <p
            className="mt-1 break-all font-mono text-sm"
            style={{ color: "#1A1A1A" }}
          >
            {agentAddress}
          </p>
        </div>

        <button
          onClick={handleVerify}
          className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-95 transition-transform"
          style={{ backgroundColor: "#1A1A1A", color: "#FFFFFF" }}
        >
          Verify &amp; Register
        </button>
      </div>
    );
  }

  // --- Verifying ---
  if (status === "verifying") {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <Spinner />
        <p className="text-[14px] mt-4 font-semibold" style={{ color: "#1A1A1A" }}>
          Verifying with World ID&hellip;
        </p>
        <p className="text-[12px] mt-1" style={{ color: "#A8A29E" }}>
          Complete the verification prompt
        </p>
      </div>
    );
  }

  // --- Submitting ---
  if (status === "submitting") {
    return (
      <div className="flex flex-col items-center text-center py-6">
        <Spinner />
        <p className="text-[14px] mt-4 font-semibold" style={{ color: "#1A1A1A" }}>
          Submitting proof&hellip;
        </p>
        <p className="text-[12px] mt-1" style={{ color: "#A8A29E" }}>
          Relaying your verification to the terminal
        </p>
      </div>
    );
  }

  // --- Success ---
  if (status === "success") {
    return (
      <div className="flex flex-col items-center text-center py-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
          style={{ backgroundColor: "#DCFCE7" }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#22C55E"
            strokeWidth="2.5"
          >
            <path
              d="M20 6L9 17l-5-5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-[15px] font-semibold" style={{ color: "#1A1A1A" }}>
          Proof Submitted!
        </p>
        <p className="text-[12px] mt-1" style={{ color: "#A8A29E" }}>
          Return to your terminal to complete registration.
        </p>
      </div>
    );
  }

  // --- Error ---
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ backgroundColor: "#FEF2F2" }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#EF4444"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" strokeLinecap="round" />
          <line x1="12" y1="16" x2="12.01" y2="16" strokeLinecap="round" />
        </svg>
      </div>
      <p className="text-[15px] font-semibold" style={{ color: "#1A1A1A" }}>
        Something went wrong
      </p>
      <p
        className="text-[13px] mt-1 mb-5 max-w-[240px]"
        style={{ color: "#A8A29E" }}
      >
        {errorMessage}
      </p>
      <button
        onClick={() => {
          setStatus("loading");
          setErrorMessage("");
          // Re-trigger the session fetch
          window.location.reload();
        }}
        className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-95 transition-transform"
        style={{ backgroundColor: "#3B82F6", color: "#FFFFFF" }}
      >
        Try again
      </button>
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
      style={{ borderColor: "#3B82F6", borderTopColor: "transparent" }}
    />
  );
}

export default function RegisterCliPage() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center px-4 py-8"
      style={{ backgroundColor: "#FAFAF8" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm"
        style={{ borderColor: "#E7E5E4" }}
      >
        <Suspense
          fallback={
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          }
        >
          <RegisterCliContent />
        </Suspense>
      </div>
    </main>
  );
}
