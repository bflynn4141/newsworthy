import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const RP_ID = process.env.RP_ID as string;

export async function POST(req: NextRequest) {
  const { rp_id, idkitResponse } = await req.json();

  // Forward the IDKit result payload as-is to v4 endpoint
  const verifyRes = await fetch(
    `https://developer.world.org/api/v4/verify/${rp_id || RP_ID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(idkitResponse),
    }
  );

  if (!verifyRes.ok) {
    const detail = await verifyRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Verification failed", detail },
      { status: 400 }
    );
  }

  // Extract nullifier from v4 response for session cookie
  const verifyData = await verifyRes.json();
  // v4 responses have nullifier in the first response item
  const nullifier =
    verifyData.responses?.[0]?.nullifier ||
    verifyData.nullifier_hash ||
    crypto.randomUUID();

  // Set a session cookie — HMAC-signed nullifier hash
  const secret = process.env.SESSION_SECRET || "newsworthy-dev-secret";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(nullifier)
  );
  const token = `${nullifier}.${Buffer.from(sig).toString("base64url")}`;

  const res = NextResponse.json({ success: true });
  res.cookies.set("nw_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return res;
}
