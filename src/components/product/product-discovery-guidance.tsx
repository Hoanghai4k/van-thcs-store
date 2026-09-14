import { Info } from "lucide-react";

export function ProductDiscoveryGuidance() {
  return (
    <div className="mb-6 bg-primary-50 dark:bg-primary-900/30 border border-primary-100 dark:border-primary-800/50 rounded-xl p-4 flex items-start sm:items-center gap-3 text-sm text-primary-800 dark:text-primary-200 shadow-sm transition-colors">
      <Info className="w-5 h-5 text-primary-500 shrink-0 mt-0.5 sm:mt-0" />
      <p>
        👉 Nhấn vào ảnh hoặc tên sản phẩm để xem chi tiết và xem thử tài liệu.
      </p>
    </div>
  );
}
