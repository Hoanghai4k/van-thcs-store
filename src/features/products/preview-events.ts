/**
 * Preview funnel — stable analytics hooks (no third-party dependency).
 *
 * No analytics provider is wired in this phase. These helpers only:
 * - define stable event names (also used as `data-analytics-event` attributes)
 * - dispatch a DOM CustomEvent that a future analytics integration can
 *   subscribe to:  window.addEventListener(PREVIEW_ANALYTICS_DOM_EVENT, ...)
 *
 * Payloads contain only public, non-sensitive data (product slug, page numbers,
 * CTA placement). Never put customer data, URLs or file identifiers here.
 */

export const PREVIEW_EVENTS = {
  OPEN: "preview_open",
  FINAL_PAGE_REACHED: "preview_page_25_reached",
  BUY_CLICKED: "preview_buy_clicked",
} as const;

export type PreviewEventName = (typeof PREVIEW_EVENTS)[keyof typeof PREVIEW_EVENTS];

export const PREVIEW_ANALYTICS_DOM_EVENT = "tlhc:analytics";

export interface PreviewEventDetail {
  productSlug: string;
  page?: number;
  totalPages?: number;
  placement?: string;
}

export function emitPreviewEvent(event: PreviewEventName, detail: PreviewEventDetail): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(
      new CustomEvent(PREVIEW_ANALYTICS_DOM_EVENT, { detail: { event, ...detail } }),
    );
  } catch {
    // Never let measurement hooks break the purchase funnel.
  }
}
