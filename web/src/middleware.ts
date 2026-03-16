import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Only run on the root path
  if (request.nextUrl.pathname !== "/") return NextResponse.next();

  // 1. Cookie from a previous MiniKit detection → instant redirect
  if (request.cookies.get("worldapp")?.value === "1") {
    return NextResponse.redirect(new URL("/mini", request.url));
  }

  // 2. UA heuristics — World App specific identifiers only
  const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
  if (
    ua.includes("worldapp") ||
    ua.includes("world app") ||
    ua.includes("minikit")
  ) {
    const res = NextResponse.redirect(new URL("/mini", request.url));
    res.cookies.set("worldapp", "1", { maxAge: 60 * 60 * 24 * 90, path: "/" });
    return res;
  }

  // 3. ?app=1 query param (manual override)
  if (request.nextUrl.searchParams.get("app") === "1") {
    const res = NextResponse.redirect(new URL("/mini", request.url));
    res.cookies.set("worldapp", "1", { maxAge: 60 * 60 * 24 * 90, path: "/" });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/"],
};
