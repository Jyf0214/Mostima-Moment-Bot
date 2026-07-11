'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import WorkflowLogsPage from '@/components/dashboard/WorkflowLogsPage';

export default function LogsPage() {
  return (
    <DashboardLayout activePage="logs">
      <WorkflowLogsPage />
    </DashboardLayout>
  );
}
