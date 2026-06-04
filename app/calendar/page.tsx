import { CalendarDashboard } from "@/components/calendar-dashboard";
import { PageHeader } from "@/components/page-header";

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        eyebrow="月度玉历"
        title="佩戴日历"
        subtitle="按天查看达标状态，并记录牙套贴合、进食、酸痛等简短笔记。"
      />
      <CalendarDashboard />
    </>
  );
}
