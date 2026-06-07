import { PageHeader } from "@/components/page-header";
import { PhotoRecordsDashboard } from "@/components/photo-records-dashboard";

export default function PhotosPage() {
  return (
    <>
      <PageHeader
        eyebrow="牙形档案"
        title="阶段对比"
        subtitle="选择两张相同角度照片并排查看；日常补传仍建议从日历当天详情进入。"
      />
      <PhotoRecordsDashboard
        deferUploadForm
        helper="选择两张已保存照片做阶段对比；需要补传时再点击新增。"
        title="照片档案"
      />
    </>
  );
}
