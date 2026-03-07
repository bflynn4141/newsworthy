import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit/signing";

export async function POST(req: Request) {
  const { action } = await req.json();
  const signingKey = process.env.RP_SIGNING_KEY!;

  const { sig, nonce, createdAt, expiresAt } = signRequest(action, signingKey);

  return NextResponse.json({
    sig,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
  });
}
