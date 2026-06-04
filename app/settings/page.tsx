import { PageHeader } from "@/components/page-header";
import { SettingsDashboard } from "@/components/settings-dashboard";

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Cloud profile"
        title="Settings"
        subtitle="Configure goals, tray details, reminders, and export your cloud data."
      />
      <SettingsDashboard />
    </>
  );
}
