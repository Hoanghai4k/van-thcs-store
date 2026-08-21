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
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-900">
          {siteConfig.name}
        </h2>
        <p className="text-xs text-slate-500 font-medium">Quản trị</p>
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
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary-600" : "text-slate-400"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-200">
        <div className="mb-4 px-3">
          <p className="text-xs text-slate-500 mb-1">Đăng nhập với:</p>
          <p className="text-sm font-medium text-slate-900 truncate" title={email}>
            {email}
          </p>
        </div>
        <div className="space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <Store className="w-5 h-5 text-slate-400" />
            Xem cửa hàng
          </Link>
          <form action={logoutAdmin}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-5 h-5 text-slate-400" />
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
      <div className="lg:hidden flex items-center justify-between bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{siteConfig.name}</h2>
          <p className="text-xs text-slate-500 font-medium">Quản trị</p>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          aria-label="Menu"
        >
          {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
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
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:h-[100dvh] lg:shrink-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>
    </>
  );
}
