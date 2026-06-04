import { PageHeader } from "@/components/page-header";
import { HistoryDashboard } from "@/components/history-dashboard";

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="Trends"
        title="History"
        subtitle="Review your recent wear-time consistency and off-tray patterns."
      />
      <HistoryDashboard />
    </>
  );
}
