import { encodePacked } from "viem";

export const AGENTBOOK_ACTION = "newsworthy-register";
export const AGENTBOOK_APP_ID = "app_1325590145579e6d6df0809d48040738";

export function computeRegistrationSignal(
  agent: `0x${string}`,
  nonce: bigint,
): string {
  return encodePacked(["address", "uint256"], [agent, nonce]);
}
