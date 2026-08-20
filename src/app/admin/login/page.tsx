import type { Metadata } from "next";
import { siteConfig } from "@/config/site";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = {
  title: `Đăng nhập Admin | ${siteConfig.name}`,
};

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            {siteConfig.name}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Đăng nhập quản trị</p>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
