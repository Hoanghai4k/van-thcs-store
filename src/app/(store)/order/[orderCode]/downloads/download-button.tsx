"use client";

/**
 * Download button component.
 * Posts to /api/downloads/[fileId] and handles the redirect to signed URL.
 */

import { useState } from "react";
import { Download, Loader2, AlertCircle } from "lucide-react";

interface DownloadButtonProps {
  fileId: string;
  fileName: string;
}

export function DownloadButton({ fileId, fileName }: DownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/downloads/${fileId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (!data.success || !data.signedUrl) {
        setError(data.error ?? "Không thể tải tài liệu.");
        setIsLoading(false);
        return;
      }

      // Open signed URL in new tab / trigger download
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = fileName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsLoading(false);
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleDownload}
        disabled={isLoading}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex-shrink-0"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Tải xuống
      </button>
      {error && (
        <div className="flex items-center gap-1 text-xs text-red-600 max-w-[200px]">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{error}</span>
        </div>
      )}
    </div>
  );
}
