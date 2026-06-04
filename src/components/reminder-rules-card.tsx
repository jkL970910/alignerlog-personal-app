"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock3, Loader2 } from "lucide-react";

import type { ReminderSettings } from "@/lib/types";

type ReminderRulesState =
  | { status: "loading" }
  | { status: "ready"; settings: ReminderSettings }
  | { status: "error"; message: string };

export function ReminderRulesCard() {
  const [state, setState] = useState<ReminderRulesState>({ status: "loading" });

  useEffect(() => {
    fetch("/api/settings")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "无法读取提醒偏好。");
        }
        setState({ status: "ready", settings: payload.reminderSettings });
      })
      .catch((error: Error) => {
        setState({ status: "error", message: error.message });
      });
  }, []);

  return (
    <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-mist text-sage">
          <Clock3 className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">当前提醒规则</h2>
              <p className="mt-1 text-sm leading-6 text-ink/60">{getRuleText(state)}</p>
            </div>
            {state.status === "loading" ? <Loader2 className="mt-1 h-4 w-4 animate-spin text-ink/40" /> : null}
          </div>
          {state.status === "error" ? <p className="mt-2 text-xs text-coral">{state.message}</p> : null}
          <Link
            className="mt-3 inline-flex min-h-10 items-center justify-center rounded-md border border-ink/15 px-4 text-sm font-semibold text-ink"
            href="/settings"
          >
            修改提醒设置
          </Link>
        </div>
      </div>
    </section>
  );
}

function getRuleText(state: ReminderRulesState) {
  if (state.status === "loading") {
    return "正在读取你的提醒偏好。";
  }

  if (state.status === "error") {
    return "提醒规则暂时不可用。";
  }

  if (!state.settings.enableMealReminder) {
    return "摘下后提醒尚未开启。开启后，点击“我取下牙套了”才会按设定时间提醒戴回。";
  }

  return `摘下牙套 ${state.settings.mealReminderMinutes} 分钟后提醒戴回。系统不会自动识别进食，计时从你手动点击“我取下牙套了”开始。`;
}
