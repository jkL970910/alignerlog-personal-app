"use client";

import { LogOut } from "lucide-react";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <button
      aria-label="Sign out"
      className="flex h-10 w-10 items-center justify-center rounded-md border border-ink/10 bg-white text-ink/60"
      onClick={logout}
      type="button"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
