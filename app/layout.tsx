import type { Metadata, Viewport } from "next";

import { BottomNav } from "@/components/bottom-nav";
import { ServiceWorkerRegister } from "@/components/service-worker-register";

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ServiceWorkerRegister />
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
          <main className="flex-1 px-4 pb-28 pt-5">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
