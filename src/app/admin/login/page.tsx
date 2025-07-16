import { redirect } from 'next/navigation';

export default function OldAdminLoginRedirect() {
  redirect('/krov/login');
}
