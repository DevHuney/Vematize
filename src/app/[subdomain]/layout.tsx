import ClientSidebar from "@/components/layout/client-sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { Toaster } from "@/components/ui/toaster";
import { getCurrentPlanInfo } from "./plan/actions";
import { SubscriptionStatusAlerter } from './components/subscription-status-alerter';
import { SubscriptionAlerter } from "./components/subscription-alerter";

export default async function ClientDashboardLayout({
    children,
    params,
}: {
    children: React.ReactNode,
    params: { subdomain: string },
}) {
    const planInfo = await getCurrentPlanInfo(params.subdomain);

    return (
        <div className="flex min-h-screen bg-secondary/10">
            <ClientSidebar />
            <main className="flex-1 flex-col overflow-y-auto">
                <div className="absolute top-4 right-4 z-20">
                    <UserNav userType="client" />
                </div>
                {children}
                <SubscriptionStatusAlerter expiresAt={planInfo.expiresAt} subdomain={params.subdomain} />
                <SubscriptionAlerter subdomain={params.subdomain} />
                <Toaster />
            </main>
        </div>
    );
}
