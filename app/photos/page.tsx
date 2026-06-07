import { PageHeader } from "@/components/page-header";
import { PhotoRecordsDashboard } from "@/components/photo-records-dashboard";

export default function PhotosPage() {
  return (
    <>
      <PageHeader
        eyebrow="牙形档案"
        title="阶段对比"
        subtitle="跨日期比较同一拍摄角度的变化；添加照片请从日历当天详情进入。"
      />
      <PhotoRecordsDashboard
        mode="comparison"
      />
    </>
  );
}
