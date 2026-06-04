import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

import { PageHeader } from "@/components/page-header";
import { TodayDashboard } from "@/components/today-dashboard";

export default function TodayPage() {
  return (
    <>
      <PageHeader
        eyebrow="Loo牙管理器"
        title="今日佩戴"
        subtitle={format(new Date(), "M月d日 EEEE", { locale: zhCN })}
      />
      <TodayDashboard />
    </>
  );
}
