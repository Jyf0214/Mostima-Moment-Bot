'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import SettingsPage from '@/components/dashboard/SettingsPage';

export default function SettingsRoutePage() {
  return (
    <DashboardLayout activePage="settings">
      <SettingsPage />
    </DashboardLayout>
  );
}
