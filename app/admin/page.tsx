import type { Metadata } from 'next'
import AdminDashboard from '@/components/admin-dashboard'

export const metadata: Metadata = {
  title: 'Admin Dashboard | Profit Online Hub',
  description: 'View all chat room messages.',
}

export default function AdminPage() {
  return <AdminDashboard />
}
