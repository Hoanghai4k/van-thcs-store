import { ExternalLink } from "lucide-react";

interface MobilePreviewCardProps {
  url: string;
}

/**
 * Mobile-friendly preview CTA card.
 *
 * Opens the derived preview PDF in the mobile browser's native PDF viewer.
 * No react-pdf dependency — just a simple link.
 *
 * SECURITY: The url must be the short-lived signed URL pointing ONLY to the
 * derived preview PDF (max 25 pages). It must NEVER expose the full source
 * document, DOCX, ZIP, or any other asset.
 */
export function MobilePreviewCard({ url }: MobilePreviewCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl text-base font-semibold bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
      >
        <ExternalLink className="w-5 h-5" />
        Xem thử tài liệu
      </a>

      <p className="text-xs text-text-muted text-center">
        Xem trước tối đa 25 trang đầu.
      </p>
    </div>
  );
}
