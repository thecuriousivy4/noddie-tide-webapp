"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CipherText({ value, max = 72 }: { value: string | null; max?: number }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="muted tiny">—</span>;

  const shown = value.length > max ? `${value.slice(0, max)}…` : value;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <span className="row" style={{ gap: 8, alignItems: "flex-start" }}>
      <span className="cipher grow">{shown}</span>
      <button className="btn btn-sm" onClick={copy} title="Copy full ciphertext" type="button">
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </span>
  );
}
