import type { ReactNode } from "react";
import { Bell, Moon, Server, Timer } from "lucide-react";

import { PageHeader } from "@/components/page-header";

export default function RemindersPage() {
  return (
    <>
      <PageHeader
        eyebrow="提醒阁"
        title="提醒"
        subtitle="当前先保存提醒偏好；正式推送会在后续云端 worker 中接入。"
      />
      <div className="space-y-3">
        <ReminderCard icon={<Timer className="h-5 w-5" />} title="摘下后提醒戴回" body="系统不会自动判断你是否在进食；只有你点击“我取下牙套了”后，才会按设置的分钟数提醒戴回。" />
        <ReminderCard icon={<Moon className="h-5 w-5" />} title="睡前提醒" body="保留晚间提醒时间，避免睡前忘记佩戴。" />
        <ReminderCard icon={<Bell className="h-5 w-5" />} title="推送授权" body="只有你主动开启时，才请求浏览器通知权限。" />
        <ReminderCard icon={<Server className="h-5 w-5" />} title="云端队列" body="下一步会增加提醒队列和定时发送器。" />
      </div>
    </>
  );
}

function ReminderCard(props: { icon: ReactNode; title: string; body: string }) {
  return (
    <section className="rounded-md border border-ink/10 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-mist text-sage">
          {props.icon}
        </div>
        <div>
          <h2 className="font-semibold text-ink">{props.title}</h2>
          <p className="mt-1 text-sm leading-6 text-ink/60">{props.body}</p>
        </div>
      </div>
    </section>
  );
}
