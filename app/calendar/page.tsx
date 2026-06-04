import { CalendarDashboard } from "@/components/calendar-dashboard";
import { PageHeader } from "@/components/page-header";

export default function CalendarPage() {
  return (
    <>
      <PageHeader
        eyebrow="Month view"
        title="Calendar"
        subtitle="Review daily goal status and keep short notes for tray fit, meals, and soreness."
      />
      <CalendarDashboard />
    </>
  );
}
