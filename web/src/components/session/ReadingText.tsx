"use client";
import { normalizeWord } from "@/lib/signals/text";

/**
 * Reading text with live highlighting: read / current / pending.
 * Words read differently are marked in red ONLY in the adult view (RF-54).
 */
export function ReadingText({
  text,
  progress,
  adult = false,
  different = [],
  size,
  tracking = true,
  provisional = false,
}: {
  text: string;
  progress: number;
  adult?: boolean;
  different?: number[];
  size?: number;
  tracking?: boolean;
  provisional?: boolean;
}) {
  const diff = new Set(adult && !provisional ? different : []);
  let idx = -1;
  const tokens = text.split(/(\s+)/);
  return (
    <p className="reading" style={size ? { fontSize: size, lineHeight: 1.6 } : undefined} lang="und" data-tracking={!tracking ? "manual" : provisional ? "provisional" : "confirmed"}>
      {tokens.map((tok, i) => {
        if (/^\s+$/.test(tok) || tok === "") return tok;
        const counts = normalizeWord(tok).length > 0;
        if (counts) idx++;
        const k = idx;
        const state = !counts || !tracking ? "read" : diff.has(k) ? "diff" : k < progress ? "read" : k === progress ? "now" : "pending";
        return (
          <span key={i} className={`w ${state}`} aria-current={state === "now" ? "true" : undefined}>
            {tok}
          </span>
        );
      })}
    </p>
  );
}
