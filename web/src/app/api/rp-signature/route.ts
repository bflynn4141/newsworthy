import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit/signing";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { action } = await req.json();
    const signingKey = process.env.RP_SIGNING_KEY;

    if (!signingKey) {
      return NextResponse.json(
        { error: "RP_SIGNING_KEY not configured" },
        { status: 500 }
      );
    }

    const { sig, nonce, createdAt, expiresAt } = signRequest(action, signingKey);

    return NextResponse.json({
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to sign request", detail: String(err) },
      { status: 500 }
    );
  }
}
