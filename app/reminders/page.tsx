import type { ReactNode } from "react";
import { Bell, Moon, Server, Timer } from "lucide-react";

import { PageHeader } from "@/components/page-header";

export default function RemindersPage() {
  return (
    <>
      <PageHeader
        eyebrow="V2 ready"
        title="Reminders"
        subtitle="Reminder preferences are stored now; push delivery can be added with a cloud worker."
      />
      <div className="space-y-3">
        <ReminderCard icon={<Timer className="h-5 w-5" />} title="Meal reminders" body="Schedule a cloud reminder when aligners are out for too long." />
        <ReminderCard icon={<Moon className="h-5 w-5" />} title="Bedtime reminders" body="Keep a future evening reminder time in the same settings model." />
        <ReminderCard icon={<Bell className="h-5 w-5" />} title="Push permission" body="Request notification permission only after a user taps the enable button." />
        <ReminderCard icon={<Server className="h-5 w-5" />} title="Cloud worker" body="The next backend step is a reminder queue and cron sender." />
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
