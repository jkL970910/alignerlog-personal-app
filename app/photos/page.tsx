import { PageHeader } from "@/components/page-header";
import { PhotoRecordsDashboard } from "@/components/photo-records-dashboard";

export default function PhotosPage() {
  return (
    <>
      <PageHeader
        eyebrow="牙形档案"
        title="照片记录"
        subtitle="按阶段保存牙齿照片，并选择两张同角度照片进行对比。"
      />
      <PhotoRecordsDashboard />
    </>
  );
}
