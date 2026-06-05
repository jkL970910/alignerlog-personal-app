"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, ChartColumn, Settings, Smile } from "lucide-react";

const items = [
  { href: "/today", label: "今日", icon: Smile },
  { href: "/history", label: "趋势", icon: ChartColumn },
  { href: "/calendar", label: "日历", icon: CalendarDays },
  { href: "/reminders", label: "提醒", icon: Bell },
  { href: "/settings", label: "设置", icon: Settings }
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-20 border-t border-ink/10 bg-paper/90 px-3 pt-2 shadow-[0_-18px_40px_rgba(91,47,55,0.08)] backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-md text-[11px] font-medium transition ${
                active ? "bg-mist text-ink shadow-sm" : "text-ink/60 hover:bg-mist/70 hover:text-ink"
              }`}
              href={item.href}
              key={item.href}
            >
              <Icon aria-hidden className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
