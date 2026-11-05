"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  FileText,
  AlertCircle,
  Loader2,
  ScrollText,
  BookOpen,
} from "lucide-react";
import type { SafeViewerMetadata, SafeViewerDocument } from "@/features/viewer/types";

interface DocumentViewerProps {
  metadata: SafeViewerMetadata;
  customerEmailMasked: string;
}

type ViewMode = "single" | "scroll";

interface PageCacheEntry {
  url: string;
  fetchedAt: number;
}

export function DocumentViewer({ metadata, customerEmailMasked }: DocumentViewerProps) {
  // Find initial viewable file
  const viewableFiles = metadata.files.filter((f) => f.isViewable && f.documents.length > 0);
  const [selectedFileId, setSelectedFileId] = useState<string>(
    viewableFiles[0]?.fileId || metadata.files[0]?.fileId || "",
  );

  const currentFile = metadata.files.find((f) => f.fileId === selectedFileId) || metadata.files[0];
  const [selectedDocKey, setSelectedDocKey] = useState<string>(
    currentFile?.documents[0]?.documentKey || "doc-0001",
  );

  const currentDoc = useMemo(() => {
    return (
      currentFile?.documents.find((d) => d.documentKey === selectedDocKey) ||
      currentFile?.documents[0] ||
      ({ documentKey: "doc-0001", name: currentFile?.fileName || "Tài liệu", pageCount: 1 } as SafeViewerDocument)
    );
  }, [currentFile, selectedDocKey]);

  const totalPages = currentDoc.pageCount || 1;

  const [currentPage, setCurrentPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [zoom, setZoom] = useState<number>(100);

  // In-memory cache for page signed URLs (never persisted in localStorage)
  const pageCacheRef = useRef<Map<string, PageCacheEntry>>(new Map());

  // Single page loading & error states
  const [singlePageUrl, setSinglePageUrl] = useState<string | null>(null);
  const [isLoadingSinglePage, setIsLoadingSinglePage] = useState<boolean>(true);
  const [singlePageError, setSinglePageError] = useState<string | null>(null);

  // Reset page when switching document or file
  const handleSelectFile = (fileId: string) => {
    setSelectedFileId(fileId);
    const file = metadata.files.find((f) => f.fileId === fileId);
    if (file && file.documents.length > 0) {
      setSelectedDocKey(file.documents[0].documentKey);
    }
    setCurrentPage(1);
    setSinglePageUrl(null);
  };

  const handleSelectDoc = (docKey: string) => {
    setSelectedDocKey(docKey);
    setCurrentPage(1);
    setSinglePageUrl(null);
  };

  /**
   * Fetch a short-lived presigned URL for a given page.
   * If forceRefresh is true, bypasses the in-memory cache (e.g. upon URL expiry).
   */
  const fetchPageUrl = useCallback(
    async (fileId: string, docKey: string, pageNum: number, forceRefresh = false): Promise<string> => {
      const cacheKey = `${metadata.productId}:${fileId}:${docKey}:${pageNum}`;
      const cached = pageCacheRef.current.get(cacheKey);

      // Cache valid for 50 seconds (backend presigned TTL is 60 seconds)
      if (!forceRefresh && cached && Date.now() - cached.fetchedAt < 50_000) {
        return cached.url;
      }

      const endpoint = `/api/account/library/${metadata.productId}/files/${fileId}/documents/${docKey}/pages/${pageNum}`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Lỗi tải trang ${pageNum} (${res.status})`);
      }

      const data = await res.json();
      if (!data.url) {
        throw new Error("Không nhận được địa chỉ trang từ máy chủ.");
      }

      pageCacheRef.current.set(cacheKey, {
        url: data.url,
        fetchedAt: Date.now(),
      });

      return data.url;
    },
    [metadata.productId],
  );

  const docKey = currentDoc.documentKey;
  const fileId = currentFile?.fileId;
  const isViewable = currentFile?.isViewable;

  const retrySinglePage = useCallback(() => {
    if (!fileId || !isViewable) return;
    setIsLoadingSinglePage(true);
    setSinglePageError(null);
    fetchPageUrl(fileId, docKey, currentPage, true)
      .then((url) => {
        setSinglePageUrl(url);
        setIsLoadingSinglePage(false);
      })
      .catch((err) => {
        setSinglePageError(err instanceof Error ? err.message : "Không thể tải trang tài liệu.");
        setIsLoadingSinglePage(false);
      });
  }, [fileId, isViewable, docKey, currentPage, fetchPageUrl]);

  useEffect(() => {
    if (viewMode !== "single" || !isViewable || !fileId) return;

    let cancelled = false;

    Promise.resolve().then(() => {
      if (!cancelled) {
        setIsLoadingSinglePage(true);
        setSinglePageError(null);
      }
    });

    fetchPageUrl(fileId, docKey, currentPage)
      .then((url) => {
        if (!cancelled) {
          setSinglePageUrl(url);
          setIsLoadingSinglePage(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setSinglePageError(err instanceof Error ? err.message : "Không thể tải trang tài liệu.");
          setIsLoadingSinglePage(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [viewMode, currentPage, fileId, isViewable, docKey, fetchPageUrl]);

  // Keyboard navigation for single page mode
  useEffect(() => {
    if (viewMode !== "single") return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentPage((prev) => Math.max(1, prev - 1));
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") {
        e.preventDefault();
        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentPage(1);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentPage(totalPages);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [viewMode, totalPages]);

  // Zoom handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(200, prev + 25));
  const handleZoomOut = () => setZoom((prev) => Math.max(50, prev - 25));
  const handleResetZoom = () => setZoom(100);

  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex flex-col select-none">
      {/* ─── Top Navigation Bar ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 shadow-md">
        {/* Left: Back Link & Document Title */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Link
            href="/account/library"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors shrink-0"
            title="Quay lại Thư viện của tôi"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Thư viện</span>
          </Link>

          <div className="h-4 w-[1px] bg-neutral-700 shrink-0" />

          <div className="min-w-0">
            <h1 className="text-xs sm:text-sm font-semibold text-neutral-100 truncate max-w-[200px] sm:max-w-xs md:max-w-md">
              {currentDoc.name || metadata.productName}
            </h1>
            <p className="text-[10px] sm:text-xs text-neutral-400 truncate">
              {metadata.productName}
            </p>
          </div>
        </div>

        {/* Right: View Controls */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Mode Switcher */}
          <div className="bg-neutral-800 p-0.5 rounded-lg flex items-center border border-neutral-700">
            <button
              type="button"
              onClick={() => setViewMode("single")}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                viewMode === "single"
                  ? "bg-primary-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Xem từng trang"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Từng trang</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("scroll")}
              className={`p-1.5 sm:px-2.5 sm:py-1 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                viewMode === "scroll"
                  ? "bg-primary-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
              title="Cuộn liên tục"
            >
              <ScrollText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Cuộn liên tục</span>
            </button>
          </div>

          {/* Zoom Controls (hidden on very narrow screens) */}
          <div className="hidden sm:flex items-center bg-neutral-800 p-0.5 rounded-lg border border-neutral-700">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
              className="p-1.5 text-neutral-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Thu nhỏ"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="px-2 py-0.5 text-[11px] font-mono text-neutral-300 hover:text-white"
              title="Đặt lại kích thước"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="p-1.5 text-neutral-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
              title="Phóng to"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Multi-Document / Multi-File Selector Bar ──────────────────────── */}
      {metadata.files.length > 1 && (
        <div className="bg-neutral-800/80 border-b border-neutral-700 px-4 py-2 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-neutral-400 shrink-0 font-medium">Tập tin:</span>
          {metadata.files.map((file) => (
            <button
              key={file.fileId}
              type="button"
              onClick={() => handleSelectFile(file.fileId)}
              className={`px-3 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                file.fileId === selectedFileId
                  ? "bg-primary-600 text-white shadow-xs"
                  : "bg-neutral-700/60 text-neutral-300 hover:bg-neutral-700 hover:text-white"
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="truncate max-w-[180px]">{file.fileName}</span>
              {file.pageCount ? (
                <span className="opacity-75 text-[10px]">({file.pageCount} tr)</span>
              ) : null}
            </button>
          ))}
        </div>
      )}

      {/* Sub-documents inside the active file (if multiple) */}
      {currentFile && currentFile.documents.length > 1 && (
        <div className="bg-neutral-850 border-b border-neutral-800 px-4 py-1.5 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-neutral-400 shrink-0">Phần:</span>
          {currentFile.documents.map((doc) => (
            <button
              key={doc.documentKey}
              type="button"
              onClick={() => handleSelectDoc(doc.documentKey)}
              className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap ${
                doc.documentKey === selectedDocKey
                  ? "bg-neutral-700 text-white font-semibold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {doc.name} ({doc.pageCount} trang)
            </button>
          ))}
        </div>
      )}

      {/* ─── Watermark & Ownership Deterrent Notice ────────────────────────── */}
      <div className="bg-neutral-850 border-b border-neutral-800 px-4 py-1.5 text-center text-[11px] text-neutral-400">
        <span>Tài liệu được cấp quyền xem cho tài khoản </span>
        <strong className="text-neutral-300 font-mono">{customerEmailMasked}</strong>
        <span className="hidden sm:inline">. Không chia sẻ hoặc sao chép trái phép.</span>
      </div>

      {/* ─── Main Viewer Stage ────────────────────────────────────────────── */}
      <main className="flex-1 relative flex flex-col items-center justify-start p-2 sm:p-6 overflow-auto">
        {/* Visual Watermark Overlay (deterrent only) */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-30 overflow-hidden opacity-[0.06] flex flex-wrap items-center justify-around select-none rotate-[-25deg] scale-125"
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="p-8 text-center font-bold tracking-widest text-neutral-100 text-sm sm:text-base">
              <div>TÀI LIỆU HẰNG CAO</div>
              <div className="text-xs font-mono">{customerEmailMasked}</div>
            </div>
          ))}
        </div>

        {/* Handling Unready File */}
        {!currentFile?.isViewable ? (
          <div className="my-auto text-center max-w-md p-8 bg-neutral-800/90 rounded-2xl border border-neutral-700 shadow-lg">
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-neutral-100 mb-2">
              {currentFile?.fileName || "Tài liệu"}
            </h2>
            <p className="text-sm text-neutral-300 mb-6 leading-relaxed">
              {currentFile?.statusMessage || "Tài liệu đang được chuẩn bị để xem."}
            </p>
            <Link
              href="/account/library"
              className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-700 hover:bg-neutral-600 text-white rounded-xl text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Thư viện</span>
            </Link>
          </div>
        ) : viewMode === "single" ? (
          /* ─── Single Page Mode ─────────────────────────────────────────── */
          <div
            className="relative flex flex-col items-center justify-center w-full transition-all duration-200"
            style={{ maxWidth: `${Math.round(850 * (zoom / 100))}px` }}
          >
            {/* Page Container */}
            <div className="relative w-full aspect-[1/1.414] bg-white rounded-lg shadow-2xl overflow-hidden flex items-center justify-center">
              {isLoadingSinglePage && (
                <div className="absolute inset-0 bg-neutral-800/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3 z-10">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                  <span className="text-xs text-neutral-300 font-medium">Đang tải trang {currentPage}...</span>
                </div>
              )}

              {singlePageError ? (
                <div className="p-6 text-center text-neutral-800 max-w-sm">
                  <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                  <p className="text-sm font-medium mb-3">{singlePageError}</p>
                  <button
                    type="button"
                    onClick={retrySinglePage}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Thử lại</span>
                  </button>
                </div>
              ) : singlePageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={singlePageUrl}
                  alt={`Trang ${currentPage} - ${currentDoc.name}`}
                  className="w-full h-full object-contain select-none pointer-events-auto"
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  onError={retrySinglePage}
                />
              ) : null}
            </div>

            {/* Single Page Footer Controls */}
            <div className="sticky bottom-4 z-40 mt-4 px-4 py-2 bg-neutral-900/95 backdrop-blur border border-neutral-700 rounded-2xl shadow-xl flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoadingSinglePage}
                className="p-2 rounded-xl text-neutral-200 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Trang trước"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1.5 text-xs font-medium">
                <span>Trang</span>
                <input
                  type="number"
                  min={1}
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= 1 && val <= totalPages) {
                      setCurrentPage(val);
                    }
                  }}
                  className="w-12 px-2 py-1 bg-neutral-800 border border-neutral-700 rounded-md text-center text-xs font-mono text-white focus:outline-hidden focus:border-primary-500"
                />
                <span className="text-neutral-400">/ {totalPages}</span>
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages || isLoadingSinglePage}
                className="p-2 rounded-xl text-neutral-200 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Trang tiếp"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        ) : (
          /* ─── Continuous Scroll Mode with Lazy Loading ─────────────────── */
          <div
            className="flex flex-col items-center gap-6 w-full pb-16"
            style={{ maxWidth: `${Math.round(850 * (zoom / 100))}px` }}
          >
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((pageNum) => (
              <LazyScrollPage
                key={`${currentFile.fileId}-${currentDoc.documentKey}-${pageNum}`}
                pageNum={pageNum}
                fileId={currentFile.fileId}
                docKey={currentDoc.documentKey}
                docName={currentDoc.name}
                fetchPageUrl={fetchPageUrl}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * Lazy loaded individual page in continuous scroll mode.
 * Uses IntersectionObserver to fetch presigned URL only when near viewport.
 */
function LazyScrollPage({
  pageNum,
  fileId,
  docKey,
  docName,
  fetchPageUrl,
}: {
  pageNum: number;
  fileId: string;
  docKey: string;
  docName: string;
  fetchPageUrl: (fileId: string, docKey: string, pageNum: number, forceRefresh?: boolean) => Promise<string>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadPage = useCallback(
    async (forceRefresh = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const pageUrl = await fetchPageUrl(fileId, docKey, pageNum, forceRefresh);
        setUrl(pageUrl);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Lỗi tải trang");
      } finally {
        setIsLoading(false);
      }
    },
    [fetchPageUrl, fileId, docKey, pageNum],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let triggered = false;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !triggered) {
          triggered = true;
          observer.disconnect();
          loadPage();
        }
      },
      { rootMargin: "400px 0px" }, // Pre-fetch when within 400px of viewport
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [loadPage]);

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-[1/1.414] bg-white rounded-lg shadow-xl overflow-hidden flex items-center justify-center"
    >
      {/* Page number pill */}
      <div className="absolute top-3 right-3 z-20 px-2 py-0.5 bg-neutral-900/80 backdrop-blur rounded text-[11px] font-mono text-neutral-300 pointer-events-none">
        {pageNum}
      </div>

      {isLoading && (
        <div className="flex flex-col items-center justify-center gap-2 text-neutral-500">
          <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
          <span className="text-xs">Đang tải trang {pageNum}...</span>
        </div>
      )}

      {error ? (
        <div className="p-4 text-center text-neutral-800">
          <p className="text-xs text-red-600 mb-2">{error}</p>
          <button
            type="button"
            onClick={() => loadPage(true)}
            className="px-3 py-1 bg-primary-600 text-white rounded text-xs font-semibold"
          >
            Thử lại
          </button>
        </div>
      ) : url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={`Trang ${pageNum} - ${docName}`}
          className="w-full h-full object-contain"
          draggable={false}
          onContextMenu={(e) => e.preventDefault()}
          onError={() => {
            // Re-fetch on expired signed URL
            loadPage(true);
          }}
        />
      ) : null}
    </div>
  );
}
