"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Package, 
  FolderOpen, 
  ShoppingBag, 
  Users, 
  Menu, 
  X,
  LogOut,
  Store
} from "lucide-react";
import { siteConfig } from "@/config/site";
import { adminNavigation } from "@/config/navigation";
import { logoutAdmin } from "@/app/admin/login/actions";
import { ThemeToggle } from "@/components/theme/theme-toggle";

interface AdminSidebarProps {
  email: string;
}

const iconMap: Record<string, React.ElementType> = {
  "/admin": LayoutDashboard,
  "/admin/products": Package,
  "/admin/categories": FolderOpen,
  "/admin/orders": ShoppingBag,
  "/admin/customers": Users,
};

export function AdminSidebar({ email }: AdminSidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Close sidebar on mobile when navigating
  const handleNavClick = () => {
    if (window.innerWidth < 1024) {
      setIsOpen(false);
    }
  };

  const navContent = (
    <>
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-text-primary">
            {siteConfig.name}
          </h2>
          <p className="text-xs text-text-secondary font-medium">Quản trị</p>
        </div>
        <ThemeToggle />
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3">
        <nav className="space-y-1">
          {adminNavigation.map((item) => {
            const Icon = iconMap[item.href] || Package;
            const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
            
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={handleNavClick}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary-600" : "text-text-muted"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-border">
        <div className="mb-4 px-3">
          <p className="text-xs text-text-secondary mb-1">Đăng nhập với:</p>
          <p className="text-sm font-medium text-text-primary truncate" title={email}>
            {email}
          </p>
        </div>
        <div className="space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
          >
            <Store className="w-5 h-5 text-text-muted" />
            Xem cửa hàng
          </Link>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-text-secondary hover:text-red-600 hover:bg-red-50/50 transition-colors"
            >
              <LogOut className="w-5 h-5 text-text-muted" />
              Đăng xuất
            </button>
          </form>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between bg-surface border-b border-border px-4 py-3 sticky top-0 z-20">
        <div>
          <h2 className="text-sm font-bold text-text-primary">{siteConfig.name}</h2>
          <p className="text-xs text-text-secondary font-medium">Quản trị</p>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 -mr-2 text-text-secondary hover:bg-surface-hover rounded-lg"
            aria-label="Menu"
          >
            {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-30 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-surface border-r border-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-[100dvh] lg:shrink-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
