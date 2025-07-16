import { redirect } from 'next/navigation';

export default function ProfilePage() {
  // This page is deprecated and now redirects to the dashboard.
  redirect('/krov/dashboard');
}
