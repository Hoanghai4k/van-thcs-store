import { ExternalLink } from "lucide-react";

interface MobilePreviewCardProps {
  url: string;
}

/**
 * Mobile-friendly preview CTA card.
 *
 * Instead of embedding the react-pdf viewer (which is unreliable on mobile),
 * this component renders a simple card with a button that opens the derived
 * preview PDF in the mobile browser's native PDF viewer.
 *
 * SECURITY: The url must be the short-lived signed URL pointing ONLY to the
 * derived preview PDF (max 25 pages). It must NEVER expose the full source
 * document, DOCX, ZIP, or any other asset.
 */
export function MobilePreviewCard({ url }: MobilePreviewCardProps) {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 space-y-4">
      <p className="text-sm text-text-secondary leading-relaxed">
        Xem tối đa 25 trang đầu để đánh giá nội dung tài liệu trước khi mua.
      </p>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center gap-2 w-full py-3 px-5 rounded-xl text-base font-semibold bg-primary-600 text-white hover:bg-primary-700 shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
      >
        <ExternalLink className="w-5 h-5" />
        Mở bản xem thử
      </a>

      <p className="text-xs text-text-muted text-center">
        PDF • Bản xem thử tối đa 25 trang
      </p>
    </div>
  );
}
