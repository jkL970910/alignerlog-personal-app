import { PageHeader } from "@/components/page-header";
import { HistoryDashboard } from "@/components/history-dashboard";

export default function HistoryPage() {
  return (
    <>
      <PageHeader
        eyebrow="佩戴账册"
        title="历史趋势"
        subtitle="查看近期佩戴稳定性、取下时长和达标节奏。"
      />
      <HistoryDashboard />
    </>
  );
}
