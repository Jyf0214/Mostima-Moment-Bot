'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import RunnersPage from '@/components/dashboard/RunnersPage';

export default function RunnersRoutePage() {
  return (
    <DashboardLayout activePage="runners">
      <RunnersPage />
    </DashboardLayout>
  );
}
