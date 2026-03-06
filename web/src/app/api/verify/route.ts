import { NextRequest, NextResponse } from "next/server";

const APP_ID = process.env.NEXT_PUBLIC_WORLD_APP_ID as string;
const ACTION = "read-feed";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const verifyRes = await fetch(
    `https://developer.worldcoin.org/api/v2/verify/${APP_ID}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nullifier_hash: body.nullifier_hash,
        merkle_root: body.merkle_root,
        proof: body.proof,
        verification_level: body.verification_level,
        action: ACTION,
      }),
    }
  );

  if (!verifyRes.ok) {
    const detail = await verifyRes.json().catch(() => ({}));
    return NextResponse.json(
      { error: "Verification failed", detail },
      { status: 400 }
    );
  }

  // Set a session cookie — HMAC-signed nullifier hash
  const nullifier = body.nullifier_hash;
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
