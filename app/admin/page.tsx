import type { Metadata } from 'next'
import AdminDashboard from '@/components/admin-dashboard'

export const metadata: Metadata = {
  title: 'Admin Dashboard | Profit Online Hub',
  description: 'View customer chats and reply as Profit Online Hub.',
}

export default function AdminPage() {
  return <AdminDashboard />
}
