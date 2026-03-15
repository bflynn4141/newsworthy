"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

const API_BASE = "https://newsworthy-api.bflynn4141.workers.dev";
const APP_ID = "app_1325590145579e6d6df0809d48040738";

function RegisterContent() {
  const searchParams = useSearchParams();
  const session = searchParams.get("session");

  const [agentAddress, setAgentAddress] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const deepLink = session
    ? `https://world.org/mini-app?app_id=${APP_ID}&path=${encodeURIComponent(`/mini/register-cli?session=${session}`)}`
    : "";

  // Validate session and fetch agent address
  useEffect(() => {
    if (!session) {
      setError("Missing session parameter. Please scan the QR code from your terminal.");
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/register/session/${session}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? "Session not found. Please scan the QR code again."
              : res.status === 410
                ? "Session expired. Run `register` in your terminal again."
                : `Failed to load session (${res.status})`,
          );
        }
        const data = (await res.json()) as { agentAddress: string; status: string };

        if (data.status === "completed") {
          setAgentAddress(data.agentAddress);
          setLoading(false);
          return;
        }

        setAgentAddress(data.agentAddress);
        setLoading(false);

        // Auto-redirect after 1s — phone may handle the universal link
        setTimeout(() => {
          window.location.href = deepLink;
        }, 1000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load session");
        setLoading(false);
      }
    })();
  }, [session, deepLink]);

  if (loading) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 text-center">
          <Spinner />
          <p className="text-sm" style={{ color: "#A8A29E" }}>
            Validating session&hellip;
          </p>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <svg className="h-7 w-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold" style={{ color: "#1A1A1A" }}>
            Invalid Registration Link
          </h1>
          <p className="text-sm" style={{ color: "#A8A29E" }}>
            {error}
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "#EFF6FF" }}>
          <svg className="h-7 w-7" style={{ color: "#3B82F6" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <div>
          <h1 className="text-xl font-semibold" style={{ color: "#1A1A1A" }}>
            Verify with World ID
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "#A8A29E" }}>
            Open in World App to verify your identity and register your agent.
          </p>
        </div>

        <div className="w-full rounded-lg border px-4 py-3" style={{ borderColor: "#E7E5E4", backgroundColor: "#FAFAF8" }}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "#A8A29E" }}>
            Agent Address
          </p>
          <p className="mt-1 break-all font-mono text-sm" style={{ color: "#1A1A1A" }}>
            {agentAddress}
          </p>
        </div>

        <a
          href={deepLink}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90"
          style={{ backgroundColor: "#1A1A1A" }}
        >
          Open in World App
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>

        <p className="text-xs" style={{ color: "#D6D3D1" }}>
          Redirecting automatically&hellip;
        </p>
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-dvh items-center justify-center px-4 py-8"
      style={{ backgroundColor: "#FAFAF8" }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm"
        style={{ borderColor: "#E7E5E4" }}
      >
        {children}
      </div>
    </main>
  );
}

function Spinner() {
  return (
    <svg
      className="h-10 w-10 animate-spin"
      style={{ color: "#3B82F6" }}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-dvh items-center justify-center"
          style={{ backgroundColor: "#FAFAF8" }}
        >
          <Spinner />
        </main>
      }
    >
      <RegisterContent />
    </Suspense>
  );
}
