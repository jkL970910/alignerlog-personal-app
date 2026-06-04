import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { sessionCookieName, verifySessionToken } from "@/server/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "AlignerLog",
  description: "Personal clear aligner wear-time tracker.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AlignerLog"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fbfaf7"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const signedIn = Boolean(verifySessionToken(cookieStore.get(sessionCookieName)?.value));

  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <main className={`flex-1 ${signedIn ? "px-4 pb-28 pt-5" : ""}`}>{children}</main>
          {signedIn ? <BottomNav /> : null}
        </div>
      </body>
    </html>
  );
}
