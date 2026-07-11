'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import EnvVarsPage from '@/components/dashboard/EnvVarsPage';

export default function EnvRoutePage() {
  return (
    <DashboardLayout activePage="env">
      <EnvVarsPage />
    </DashboardLayout>
  );
}
