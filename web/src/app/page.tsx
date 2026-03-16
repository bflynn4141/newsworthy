import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";
import { MiniKitRedirect } from "@/components/mini/minikit-redirect";
import { DelayedReveal } from "@/components/delayed-reveal";

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
  const uaLower = ua.toLowerCase();
  const isWorldApp =
    uaLower.includes("worldapp") ||
    uaLower.includes("world app") ||
    uaLower.includes("minikit");
  const forceApp = params.app === "1";

  if (isWorldApp || forceApp) {
    redirect("/mini");
  }

  // Landing page with client-side MiniKit fallback
  // DelayedReveal hides content for 200ms so MiniKit redirect can fire
  // before the landing page is visible (prevents flash in World App)
  return (
    <>
      <MiniKitRedirect />
      <DelayedReveal>
        <LandingPage />
      </DelayedReveal>
    </>
  );
}
