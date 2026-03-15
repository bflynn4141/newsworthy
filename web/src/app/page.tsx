import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { MiniKitRedirect } from "@/components/mini/minikit-redirect";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const params = await searchParams;
  const headersList = await headers();
  const ua = headersList.get("user-agent") ?? "";

  // Fast path: server-side UA detection
  const isWorldApp = ua.includes("WorldApp");
  const forceApp = params.app === "1";

  if (isWorldApp || forceApp) {
    redirect("/mini");
  }

  // Landing page with client-side MiniKit fallback
  // If MiniKit is installed (World App webview), redirect to /mini
  return (
    <>
      <MiniKitRedirect />
      <LandingPage />
    </>
  );
}
