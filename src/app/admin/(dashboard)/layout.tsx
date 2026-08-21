import { requireAdmin } from "@/lib/auth/admin-auth";
import { siteConfig } from "@/config/site";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export const metadata = { title: `Admin | ${siteConfig.name}` };

/**
 * Protected admin layout.
 * All routes under /admin/(dashboard)/ require admin authentication.
 * Non-admins are redirected to /admin/login by requireAdmin().
 */
export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <AdminSidebar email={admin.email} />
      <div className="flex-1 min-w-0 overflow-y-auto lg:h-[100dvh]">
        {children}
      </div>
    </div>
  );
}
