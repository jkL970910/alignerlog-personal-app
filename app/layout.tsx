import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";

import { BottomNav } from "@/components/bottom-nav";
import { LooDentalMinister } from "@/components/loo-dental-minister";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { sessionCookieName, verifySessionToken } from "@/server/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "Loo牙管理器",
  description: "中文隐形牙套佩戴计划与打卡管理器。",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Loo牙"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#fff7f4"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const signedIn = Boolean(verifySessionToken(cookieStore.get(sessionCookieName)?.value));

  return (
    <html lang="zh-Hans">
      <body>
        <ServiceWorkerRegister />
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <main className={`flex-1 ${signedIn ? "px-4 pb-28 pt-5" : ""}`}>{children}</main>
          {signedIn ? <LooDentalMinister /> : null}
          {signedIn ? <BottomNav /> : null}
        </div>
      </body>
    </html>
  );
}
