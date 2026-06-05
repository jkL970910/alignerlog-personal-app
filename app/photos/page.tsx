import { PageHeader } from "@/components/page-header";
import { PhotoRecordsDashboard } from "@/components/photo-records-dashboard";

export default function PhotosPage() {
  return (
    <>
      <PageHeader
        eyebrow="牙形档案"
        title="全部阶段照片"
        subtitle="这是完整照片档案入口；日常补传建议从日历或趋势的日期详情进入。"
      />
      <PhotoRecordsDashboard />
    </>
  );
}
