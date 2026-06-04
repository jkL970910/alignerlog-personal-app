import { LocalDateSubtitle } from "@/components/local-date-subtitle";
import { PageHeader } from "@/components/page-header";
import { TodayDashboard } from "@/components/today-dashboard";

export default function TodayPage() {
  return (
    <>
      <PageHeader
        eyebrow="Loo牙管理器"
        title="今日佩戴"
        subtitle={<LocalDateSubtitle />}
      />
      <TodayDashboard />
    </>
  );
}
