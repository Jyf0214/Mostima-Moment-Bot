'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ApiKeyPage from '@/components/dashboard/ApiKeyPage';

export default function ApiKeysRoutePage() {
  return (
    <DashboardLayout activePage="apikeys">
      <ApiKeyPage />
    </DashboardLayout>
  );
}
