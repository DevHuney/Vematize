import { redirect } from 'next/navigation';

export default function OldAdminDashboardRedirect() {
  redirect('/krov/dashboard');
}
