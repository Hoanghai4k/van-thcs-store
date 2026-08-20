"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CopyOrderCodeProps {
  orderCode: string;
}

export function CopyOrderCode({ orderCode }: CopyOrderCodeProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(orderCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono font-bold text-text-primary bg-surface-alt px-2 py-0.5 rounded border border-border">
        {orderCode}
      </span>
      <button
        onClick={handleCopy}
        className="p-1.5 text-text-muted hover:text-primary-600 hover:bg-primary-50 rounded-md transition-colors"
        title="Sao chép mã đơn"
        aria-label="Sao chép mã đơn"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
