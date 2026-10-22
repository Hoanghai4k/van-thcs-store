import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { siteConfig } from "@/config/site";
import { getCurrentAuthUser, getSafeRedirect } from "@/lib/auth/customer-auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: `Đăng nhập / Tạo tài khoản | ${siteConfig.name}`,
  description: "Đăng nhập không cần mật khẩu bằng mã xác thực gửi qua email để truy cập tài liệu và đơn hàng.",
};

interface LoginPageProps {
  searchParams: Promise<{
    redirect?: string;
    error?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const safeRedirect = getSafeRedirect(params.redirect);

  // If already logged in, redirect directly to intended destination
  const user = await getCurrentAuthUser();
  if (user) {
    redirect(safeRedirect);
  }

  return (
    <div className="container mx-auto px-4 py-12 sm:py-20 flex items-center justify-center min-h-[calc(100vh-16rem)]">
      <LoginForm
        initialRedirect={safeRedirect}
        initialError={params.error}
      />
    </div>
  );
}
