import { redirect } from 'next/navigation';

// This page now redirects to the main dashboard for the subdomain.
export default function SubdomainRootPage({ params }: { params: { subdomain: string } }) {
  redirect(`/${params.subdomain}/dashboard`);
}
