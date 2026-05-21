'use client';

import { useUserStore } from '../lib/store';
import UserManagement from './UserManagement';

export default function MasterAdminDashboard() {
  const { currentUser } = useUserStore();

  if (currentUser?.role !== 'MASTER_ADMIN') {
    return <div>Access Denied</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Master Admin Dashboard</h1>
      <UserManagement />
    </div>
  );
}
