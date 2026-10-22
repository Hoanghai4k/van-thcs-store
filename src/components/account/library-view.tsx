"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, FileText, Gift, Sparkles, ExternalLink, Archive } from "lucide-react";
import type { LibraryItem } from "@/features/account/library-queries";
import { getProductAssetUrl } from "@/lib/storage/storage";
import { formatDate } from "@/lib/utils";

interface LibraryViewProps {
  items: LibraryItem[];
}

export function LibraryView({ items }: LibraryViewProps) {
  const [filter, setFilter] = useState<"ALL" | "PAID" | "BONUS">("ALL");

  const paidCount = items.filter((i) => i.acquisitionType === "PAID").length;
  const bonusCount = items.filter((i) => i.acquisitionType === "BONUS").length;

  const filteredItems = items.filter((item) => {
    if (filter === "PAID") return item.acquisitionType === "PAID";
    if (filter === "BONUS") return item.acquisitionType === "BONUS";
    return true;
  });

  if (items.length === 0) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 flex items-center justify-center mx-auto mb-4 shadow-inner">
          <BookOpen className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-text-primary mb-2">
          Bạn chưa có tài liệu nào trong thư viện
        </h2>
        <p className="text-text-secondary text-sm mb-6 leading-relaxed">
          Các tài liệu bạn thanh toán thành công hoặc được tặng kèm sẽ tự động xuất hiện tại đây để bạn học tập và giảng dạy.
        </p>
        <Link
          href="/products"
          className="inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-xl transition-all shadow-sm hover:shadow"
        >
          <Sparkles className="w-4 h-4" />
          <span>Khám phá tài liệu</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <button
          type="button"
          onClick={() => setFilter("ALL")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            filter === "ALL"
              ? "bg-primary-600 text-white shadow-sm"
              : "bg-surface-alt hover:bg-surface text-text-secondary hover:text-text-primary border border-border"
          }`}
        >
          Tất cả ({items.length})
        </button>

        <button
          type="button"
          onClick={() => setFilter("PAID")}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
            filter === "PAID"
              ? "bg-primary-600 text-white shadow-sm"
              : "bg-surface-alt hover:bg-surface text-text-secondary hover:text-text-primary border border-border"
          }`}
        >
          Đã mua ({paidCount})
        </button>

        {bonusCount > 0 && (
          <button
            type="button"
            onClick={() => setFilter("BONUS")}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-1.5 ${
              filter === "BONUS"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-surface-alt hover:bg-surface text-text-secondary hover:text-text-primary border border-border"
            }`}
          >
            <span>🎁 Tặng kèm ({bonusCount})</span>
          </button>
        )}
      </div>

      {/* Filter Empty State */}
      {filteredItems.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-border p-8 text-center text-text-secondary text-sm">
          Không có tài liệu nào thuộc bộ lọc này.
        </div>
      ) : (
        /* Library Cards Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const thumbUrl = getProductAssetUrl(item.thumbnailUrl);

            return (
              <div
                key={item.productId}
                className="group bg-surface rounded-2xl border border-border hover:border-primary-300 dark:hover:border-primary-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Thumbnail / Header Area */}
                  <div className="relative h-44 bg-gradient-to-br from-primary-50/60 via-surface-alt to-surface dark:from-primary-950/20 dark:via-surface-alt dark:to-surface flex items-center justify-center border-b border-border overflow-hidden">
                    {thumbUrl ? (
                      <Image
                        src={thumbUrl}
                        alt={item.name}
                        fill
                        className="object-contain p-3 group-hover:scale-105 transition-transform duration-500"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <FileText className="w-14 h-14 text-primary-300 dark:text-primary-700/60 group-hover:scale-110 transition-transform duration-500" />
                    )}

                    {/* Source Badge */}
                    <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                      {item.acquisitionType === "PAID" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
                          Đã mua
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 shadow-xs">
                          <Gift className="w-3 h-3" />
                          Tặng kèm
                        </span>
                      )}

                      {!item.isActive && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                          <Archive className="w-3 h-3" />
                          Lưu trữ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5">
                    <h3 className="font-bold text-text-primary line-clamp-2 text-base group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mb-2">
                      {item.name}
                    </h3>

                    {item.shortDescription && (
                      <p className="text-xs text-text-secondary line-clamp-2 mb-3 leading-relaxed">
                        {item.shortDescription}
                      </p>
                    )}

                    {/* Acquisition Timestamp */}
                    <div className="text-xs text-text-muted">
                      {item.acquisitionType === "PAID"
                        ? `Đã mua: ${formatDate(item.acquiredAt)}`
                        : `Được tặng kèm: ${formatDate(item.acquiredAt)}`}
                    </div>
                  </div>
                </div>

                {/* Card Actions Footer */}
                <div className="p-5 pt-0 space-y-2">
                  {/* Primary CTA (Disabled Viewer Placeholder) */}
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    className="w-full py-2.5 px-4 rounded-xl text-sm font-medium bg-surface-alt text-text-muted border border-border cursor-not-allowed flex items-center justify-center gap-2 select-none"
                    title="Tính năng xem trực tuyến đang được hoàn thiện"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Xem tài liệu</span>
                  </button>

                  <p className="text-center text-[11px] text-text-muted">
                    Tính năng xem đầy đủ đang được hoàn thiện
                  </p>

                  {/* Optional secondary link to public product page if active */}
                  {item.slug && item.isActive && (
                    <Link
                      href={`/products/${item.slug}`}
                      className="inline-flex items-center justify-center gap-1 w-full text-center text-xs text-primary-600 dark:text-primary-400 hover:underline pt-1"
                    >
                      <span>Xem thông tin giới thiệu</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
