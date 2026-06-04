import { Bell, Cloud, Timer } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { PushNotificationCard } from "@/components/push-notification-card";
import { ReminderRulesCard } from "@/components/reminder-rules-card";

export default function RemindersPage() {
  return (
    <>
      <PageHeader
        eyebrow="提醒阁"
        title="提醒"
        subtitle="先开启当前设备推送，再按你的提醒偏好接收戴回牙套提醒。"
      />
      <div className="space-y-3">
        <PushNotificationCard />
        <ReminderRulesCard />
        <details className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer font-semibold text-ink">工作原理</summary>
          <div className="mt-4 space-y-3 text-sm leading-6 text-ink/65">
            <HowItWorksRow
              icon={<Timer className="h-4 w-4" />}
              title="从手动摘下开始计时"
              body="系统不会自动判断你是否在吃饭；只有你在今日页点击“我取下牙套了”，才会开始计算戴回提醒。"
            />
            <HowItWorksRow
              icon={<Bell className="h-4 w-4" />}
              title="到期才发送通知"
              body="后台每几分钟检查一次是否有到期提醒。没有到期任务时不会发通知，也不会重复通知。"
            />
            <HowItWorksRow
              icon={<Cloud className="h-4 w-4" />}
              title="戴回后自动取消"
              body="如果你已经点击“我戴回牙套了”，这次摘下对应的提醒会取消。"
            />
          </div>
        </details>
      </div>
    </>
  );
}

function HowItWorksRow(props: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-mist text-sage">
        {props.icon}
      </div>
      <div>
        <p className="font-medium text-ink">{props.title}</p>
        <p className="mt-0.5">{props.body}</p>
      </div>
    </div>
  );
}
