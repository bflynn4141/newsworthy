import { cookies } from "next/headers";

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get("nw_session")?.value;
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 2) return false;

  const [nullifier, sig] = parts;
  const secret = process.env.SESSION_SECRET || "newsworthy-dev-secret";
  const encoder = new TextEncoder();

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );
    const sigBytes = Buffer.from(sig, "base64url");
    return crypto.subtle.verify(
      "HMAC",
      key,
      sigBytes,
      encoder.encode(nullifier)
    );
  } catch {
    return false;
  }
}
