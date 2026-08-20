"use client";

import { useActionState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { loginAdmin, type LoginResult } from "./actions";

const initialState: LoginResult = {};

export function AdminLoginForm() {
  const [state, formAction, isPending] = useActionState(
    async (_prev: LoginResult, formData: FormData) => {
      return loginAdmin(formData);
    },
    initialState,
  );

  return (
    <form action={formAction} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="space-y-4">
        <div>
          <label
            htmlFor="admin-email"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Email
          </label>
          <input
            id="admin-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none transition-all text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="admin@example.com"
          />
        </div>
        <div>
          <label
            htmlFor="admin-password"
            className="block text-sm font-medium text-slate-700 mb-1.5"
          >
            Mật khẩu
          </label>
          <input
            id="admin-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 outline-none transition-all text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="••••••••"
          />
        </div>
      </div>

      {state.error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm">
          {state.error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full mt-6 flex items-center justify-center gap-2 bg-slate-900 text-white font-medium py-2.5 rounded-xl hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Đang đăng nhập...
          </>
        ) : (
          <>
            <LogIn className="w-4 h-4" />
            Đăng nhập
          </>
        )}
      </button>
    </form>
  );
}
