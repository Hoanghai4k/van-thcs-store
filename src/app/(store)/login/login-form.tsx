"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, KeyRound, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { requestOtp, verifyOtp } from "./actions";

interface LoginFormProps {
  initialRedirect?: string;
  initialError?: string;
}

export function LoginForm({ initialRedirect, initialError }: LoginFormProps) {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError || "");
  const [cooldown, setCooldown] = useState(0);

  // Cooldown timer for resending OTP
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  const maskEmail = (val: string) => {
    const parts = val.split("@");
    if (parts.length !== 2) return val;
    const [local, domain] = parts;
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError("");

    try {
      const res = await requestOtp(email, initialRedirect);
      if (res.success && res.email) {
        setEmail(res.email);
        setStep("otp");
        setCooldown(60); // 60s cooldown for resend
      } else {
        setError(res.error || "Không thể gửi mã xác thực. Vui lòng thử lại.");
      }
    } catch {
      setError("Không thể kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const res = await verifyOtp(email, token, initialRedirect);
      if (res.success && res.redirectTo) {
        router.push(res.redirectTo);
        router.refresh();
      } else {
        setError(res.error || "Mã xác thực không đúng. Vui lòng thử lại.");
      }
    } catch {
      setError("Không thể kết nối đến máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await requestOtp(email, initialRedirect);
      if (res.success) {
        setCooldown(60);
      } else {
        setError(res.error || "Không thể gửi lại mã.");
      }
    } catch {
      setError("Lỗi kết nối khi gửi lại mã.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-8 bg-surface rounded-2xl shadow-sm border border-border">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary-50 dark:bg-primary-950/50 text-primary-600 rounded-xl flex items-center justify-center mx-auto mb-3 shadow-inner">
          {step === "email" ? (
            <Mail className="w-6 h-6" />
          ) : (
            <KeyRound className="w-6 h-6" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-text-primary">
          {step === "email" ? "Đăng nhập / Tạo tài khoản" : "Nhập mã xác thực"}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          {step === "email"
            ? "Nhập email của bạn để nhận mã xác thực đăng nhập hoặc tạo tài khoản mới."
            : `Chúng tôi đã gửi mã xác thực đến ${maskEmail(email)}.`}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-5 p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl flex items-start gap-2.5 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Email Form */}
      {step === "email" ? (
        <form onSubmit={handleRequestOtp} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1.5 text-text-primary"
            >
              Email của bạn
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-border bg-transparent text-text-primary rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none placeholder:text-text-muted transition-all"
              placeholder="vidu@gmail.com"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang gửi mã...</span>
              </>
            ) : (
              <span>Gửi mã xác thực</span>
            )}
          </button>
        </form>
      ) : (
        /* Step 2: OTP Form */
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div>
            <label
              htmlFor="token"
              className="block text-sm font-medium mb-1.5 text-text-primary text-center"
            >
              Mã xác thực gồm 6 chữ số
            </label>
            <input
              id="token"
              type="text"
              inputMode="numeric"
              required
              autoFocus
              maxLength={8}
              autoComplete="one-time-code"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\s+/g, ""))}
              className="w-full text-center tracking-[0.3em] font-mono text-xl sm:text-2xl px-4 py-3 border border-border bg-transparent text-text-primary rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none placeholder:text-text-muted transition-all"
              placeholder="123456"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || token.length < 6}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-4 rounded-xl shadow-sm hover:shadow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Đang xác nhận...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác nhận</span>
              </>
            )}
          </button>

          <div className="flex items-center justify-between text-xs sm:text-sm text-text-secondary pt-2">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setToken("");
                setError("");
              }}
              className="flex items-center gap-1 hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Đổi email khác</span>
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
              className="font-medium text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed"
            >
              {cooldown > 0 ? `Gửi lại sau ${cooldown}s` : "Gửi lại mã"}
            </button>
          </div>
        </form>
      )}

      {/* Footer Note */}
      <div className="mt-6 pt-5 border-t border-border text-center text-xs text-text-muted">
        Bằng việc tiếp tục, bạn đồng ý với{" "}
        <a href="/terms" className="underline hover:text-text-secondary">
          Điều khoản sử dụng
        </a>{" "}
        và{" "}
        <a href="/privacy" className="underline hover:text-text-secondary">
          Chính sách bảo mật
        </a>{" "}
        của Tài Liệu Hằng Cao.
      </div>
    </div>
  );
}
