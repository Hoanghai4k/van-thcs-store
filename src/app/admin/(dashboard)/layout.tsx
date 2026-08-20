import { requireAdmin } from "@/lib/auth/admin-auth";
import { siteConfig } from "@/config/site";
import { logoutAdmin } from "@/app/admin/login/actions";

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
    <div className="min-h-screen bg-slate-50">
      {/* Admin top bar */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Xin chào, <span className="font-medium">{admin.email}</span>
        </p>
        <form action={logoutAdmin}>
          <button
            type="submit"
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Đăng xuất
          </button>
        </form>
      </div>
      {children}
    </div>
  );
}
