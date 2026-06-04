import { PageHeader } from "@/components/page-header";
import { SettingsDashboard } from "@/components/settings-dashboard";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="宝库设置"
        title="设置"
        subtitle="管理每日目标、当前牙套计划、提醒偏好和数据导出。"
      />
      <SettingsDashboard />
    </>
  );
}
