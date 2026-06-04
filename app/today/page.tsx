import { format } from "date-fns";

import { PageHeader } from "@/components/page-header";
import { TodayDashboard } from "@/components/today-dashboard";

export default function TodayPage() {
  return (
    <>
      <PageHeader
        eyebrow="AlignerLog"
        title="Today"
        subtitle={format(new Date(), "EEEE, MMMM d")}
      />
      <TodayDashboard />
    </>
  );
}
