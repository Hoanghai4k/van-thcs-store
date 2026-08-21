"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (!mounted) {
    // Render an invisible placeholder with same dimensions to prevent layout shift
    return <div className="w-9 h-9" />;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center w-9 h-9 rounded-xl bg-surface-alt hover:bg-surface-hover text-text-secondary border border-border transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500"
        aria-label="Chuyển sang giao diện sáng/tối"
        title="Giao diện"
      >
        {theme === "dark" ? (
          <Moon className="w-4 h-4" />
        ) : theme === "system" ? (
          <Monitor className="w-4 h-4" />
        ) : (
          <Sun className="w-4 h-4" />
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-36 bg-surface rounded-xl shadow-xl border border-border py-1.5 z-50 animate-in fade-in slide-in-from-top-2">
            <button
              onClick={() => {
                setTheme("light");
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-hover transition-colors ${
                theme === "light" ? "text-primary-600 font-medium" : "text-text-secondary"
              }`}
            >
              <Sun className="w-4 h-4" />
              Sáng
            </button>
            <button
              onClick={() => {
                setTheme("dark");
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-hover transition-colors ${
                theme === "dark" ? "text-primary-600 font-medium" : "text-text-secondary"
              }`}
            >
              <Moon className="w-4 h-4" />
              Tối
            </button>
            <button
              onClick={() => {
                setTheme("system");
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-surface-hover transition-colors ${
                theme === "system" ? "text-primary-600 font-medium" : "text-text-secondary"
              }`}
            >
              <Monitor className="w-4 h-4" />
              Hệ thống
            </button>
          </div>
        </>
      )}
    </div>
  );
}
