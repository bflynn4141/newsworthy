import { Geist } from "next/font/google";
import "../globals.css";
import { MiniKitSetup } from "@/components/mini/minikit-provider";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata = {
  title: "Newsworthy",
  description: "Curate crypto news. Earn USDC.",
};

export default function MiniLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MiniKitSetup>
      <div
        className={`${geist.variable} font-sans min-h-screen`}
        style={{ backgroundColor: "#FAFAF8" }}
      >
        {children}
      </div>
    </MiniKitSetup>
  );
}
