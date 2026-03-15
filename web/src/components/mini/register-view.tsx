"use client";

import { useState } from "react";
import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";
import { decodeAbiParameters } from "viem";
import {
  AGENTBOOK_ADDRESS,
  agentBookAbi,
  agentBookRegisterAbi,
  getPublicClient,
} from "@/lib/contracts";
import { AGENTBOOK_ACTION, computeRegistrationSignal } from "@/lib/world-id";

type RegistrationState = "idle" | "verifying" | "signing" | "success" | "error";

interface RegisterViewProps {
  onRegistered: () => void;
}

export function RegisterView({ onRegistered }: RegisterViewProps) {
  const [state, setState] = useState<RegistrationState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRegister() {
    try {
      setState("verifying");
      setErrorMessage(null);

      const walletAddress = MiniKit.user?.walletAddress;
      if (!walletAddress) {
        throw new Error("Wallet not connected. Open in World App.");
      }

      // 1. Fetch nonce from AgentBook
      const client = getPublicClient();
      const nonce = (await client.readContract({
        address: AGENTBOOK_ADDRESS,
        abi: agentBookAbi,
        functionName: "getNextNonce",
        args: [walletAddress as `0x${string}`],
      })) as bigint;

      // 2. Compute signal for World ID verification
      const signal = computeRegistrationSignal(
        walletAddress as `0x${string}`,
        nonce,
      );

      // 3. Verify with World ID via MiniKit
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

      // 4. Decode the proof (ABI-encoded uint256[8])
      const decodedProof = decodeAbiParameters(
        [{ type: "uint256[8]" }],
        payload.proof as `0x${string}`,
      )[0];

      // 5. Send the register transaction via MiniKit
      setState("signing");

      const txResult = await MiniKit.commandsAsync.sendTransaction({
        transaction: [
          {
            address: AGENTBOOK_ADDRESS,
            abi: agentBookRegisterAbi,
            functionName: "register",
            args: [
              walletAddress,
              payload.merkle_root,
              nonce.toString(),
              payload.nullifier_hash,
              decodedProof,
            ],
          },
        ],
      });

      if (!txResult?.finalPayload) {
        throw new Error("Transaction was cancelled.");
      }

      const txPayload = txResult.finalPayload as {
        status: string;
        transaction_id?: string;
      };

      if (txPayload.status === "error") {
        throw new Error("Registration transaction failed.");
      }

      // 6. Success
      setState("success");

      // Wait a moment for the user to see the success state, then notify parent
      setTimeout(() => {
        onRegistered();
      }, 1500);
    } catch (err) {
      console.error("Registration failed:", err);
      setState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Registration failed",
      );
    }
  }

  // --- Idle state ---
  if (state === "idle") {
    return (
      <div className="px-4 mb-4">
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #F0EDE8",
          }}
        >
          <div className="flex flex-col items-center text-center">
            {/* Shield icon */}
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

            <p
              className="text-[15px] font-semibold"
              style={{ color: "#1A1A1A" }}
            >
              Verify with World ID
            </p>
            <p
              className="text-[13px] mt-1 mb-5 max-w-[240px]"
              style={{ color: "#A8A29E" }}
            >
              Register to vote on news items and earn USDC
            </p>

            <button
              onClick={handleRegister}
              className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-95 transition-transform"
              style={{ backgroundColor: "#3B82F6", color: "#FFFFFF" }}
            >
              Verify & Register
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Verifying state ---
  if (state === "verifying") {
    return (
      <div className="px-4 mb-4">
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #F0EDE8",
          }}
        >
          <div className="flex flex-col items-center text-center py-4">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-4"
              style={{
                borderColor: "#3B82F6",
                borderTopColor: "transparent",
              }}
            />
            <p
              className="text-[14px] font-semibold"
              style={{ color: "#1A1A1A" }}
            >
              Verifying with World ID...
            </p>
            <p className="text-[12px] mt-1" style={{ color: "#A8A29E" }}>
              Complete the verification in World App
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Signing state ---
  if (state === "signing") {
    return (
      <div className="px-4 mb-4">
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #F0EDE8",
          }}
        >
          <div className="flex flex-col items-center text-center py-4">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-4"
              style={{
                borderColor: "#3B82F6",
                borderTopColor: "transparent",
              }}
            />
            <p
              className="text-[14px] font-semibold"
              style={{ color: "#1A1A1A" }}
            >
              Confirming registration...
            </p>
            <p className="text-[12px] mt-1" style={{ color: "#A8A29E" }}>
              Approve the transaction in World App
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Success state ---
  if (state === "success") {
    return (
      <div className="px-4 mb-4">
        <div
          className="rounded-2xl p-5"
          style={{
            backgroundColor: "#FFFFFF",
            border: "1px solid #F0EDE8",
          }}
        >
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
            <p
              className="text-[15px] font-semibold"
              style={{ color: "#1A1A1A" }}
            >
              Registration complete!
            </p>
            <p className="text-[12px] mt-1" style={{ color: "#A8A29E" }}>
              You can now vote on news items and earn USDC
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- Error state ---
  return (
    <div className="px-4 mb-4">
      <div
        className="rounded-2xl p-5"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid #F0EDE8",
        }}
      >
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
              <line
                x1="12"
                y1="8"
                x2="12"
                y2="12"
                strokeLinecap="round"
              />
              <line
                x1="12"
                y1="16"
                x2="12.01"
                y2="16"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p
            className="text-[15px] font-semibold"
            style={{ color: "#1A1A1A" }}
          >
            Registration failed
          </p>
          <p
            className="text-[13px] mt-1 mb-5 max-w-[240px]"
            style={{ color: "#A8A29E" }}
          >
            {errorMessage ?? "Something went wrong. Please try again."}
          </p>
          <button
            onClick={() => {
              setState("idle");
              setErrorMessage(null);
            }}
            className="w-full py-3 rounded-xl text-[14px] font-semibold active:scale-95 transition-transform"
            style={{ backgroundColor: "#3B82F6", color: "#FFFFFF" }}
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
