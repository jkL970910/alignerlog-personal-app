import { NextRequest, NextResponse } from "next/server";

import { sessionCookieName, verifySessionToken } from "@/server/edge-auth";

const publicPaths = [
  "/login",
  "/api/auth/login",
  "/manifest.webmanifest",
  "/sw.js",
  "/icon.svg"
];

function isPublicPath(pathname: string) {
  return publicPaths.some((path) => pathname === path || pathname.startsWith("/_next/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(sessionCookieName)?.value);

  if (session) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"]
};
