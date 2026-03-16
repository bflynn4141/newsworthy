import { MiniKit, VerificationLevel } from "@worldcoin/minikit-js";

// MUST match AgentBook's action for cross-path sybil resistance
export const VOTING_ACTION = "newsworthy-register";
export const VOTING_APP_ID = "app_1325590145579e6d6df0809d48040738";

const PROOF_MAX_AGE_MS = 20 * 60 * 1000; // 20 minutes

export interface WorldIdProof {
  merkle_root: string;
  nullifier_hash: string;
  proof: string; // ABI-encoded uint256[8]
  obtainedAt: number;
}

export function isProofFresh(proof: WorldIdProof | null): boolean {
  if (!proof) return false;
  return Date.now() - proof.obtainedAt < PROOF_MAX_AGE_MS;
}

export async function obtainWorldIdProof(
  voterAddress: `0x${string}`
): Promise<WorldIdProof> {
  if (!MiniKit.isInstalled()) {
    throw new Error("MiniKit not available. Open in World App.");
  }

  const verifyResult = await MiniKit.commandsAsync.verify({
    action: VOTING_ACTION,
    signal: voterAddress,
    verification_level: VerificationLevel.Orb,
  });

  if (!verifyResult?.finalPayload) {
    throw new Error("World ID verification was cancelled or failed.");
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

  return {
    merkle_root: payload.merkle_root,
    nullifier_hash: payload.nullifier_hash,
    proof: payload.proof,
    obtainedAt: Date.now(),
  };
}
