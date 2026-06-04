"use client";

import { LogOut } from "lucide-react";

type LogoutButtonProps = {
  variant?: "icon" | "wide";
};

export function LogoutButton({ variant = "icon" }: LogoutButtonProps) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  if (variant === "wide") {
    return (
      <button
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-coral/20 bg-white px-4 text-sm font-semibold text-coral"
        onClick={logout}
        type="button"
      >
        <LogOut className="h-4 w-4" />
        退出登录
      </button>
    );
  }

  return (
    <button
      aria-label="退出登录"
      className="flex h-10 w-10 items-center justify-center rounded-md border border-ink/10 bg-white text-ink/60"
      onClick={logout}
      type="button"
    >
      <LogOut className="h-4 w-4" />
    </button>
  );
}
