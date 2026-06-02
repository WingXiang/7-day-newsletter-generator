"use client";

import { useState } from "react";
import type { ErrorCode } from "@/lib/error-codes";

/**
 * Parsed error info, either from server API response or client-side fallback.
 */
export interface ParsedError {
  code: ErrorCode;
  title: string;
  action: string;
  ref?: string;
}

/**
 * Parse a failed fetch response or thrown Error into a friendly ParsedError.
 * Use this in catch blocks before calling `setError(...)`.
 */
export async function parseErrorResponse(
  res: Response,
): Promise<ParsedError> {
  try {
    const body = await res.json();
    if (body && body.code && body.title && body.action) {
      return {
        code: body.code,
        title: body.title,
        action: body.action,
        ref: body.ref,
      };
    }
  } catch {
    // fall through
  }
  return {
    code: "UNKNOWN",
    title: "發生未知錯誤",
    action: `伺服器回傳 HTTP ${res.status}。請重新整理頁面後再試。`,
  };
}

export function networkError(): ParsedError {
  return {
    code: "NETWORK_FAIL",
    title: "無法連線到伺服器",
    action: "檢查網路連線後重試。如果是公司網路，可能被防火牆擋住。",
  };
}

interface ErrorBannerProps {
  error: ParsedError | null;
  onDismiss: () => void;
}

export default function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const debugLine = error.ref
    ? `錯誤代碼：${error.code} ｜ 參考編號：${error.ref}`
    : `錯誤代碼：${error.code}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(debugLine);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  // Tone based on category
  const isRateLimit = error.code.startsWith("RATE_LIMIT_");
  const isUserFixable =
    error.code === "NO_URLS" ||
    error.code === "MODEL_REFUSED" ||
    error.code === "URL_FETCH_FAIL";

  const palette = isRateLimit
    ? {
        border: "border-amber-300",
        bg: "bg-amber-50",
        iconBg: "bg-amber-100",
        iconColor: "text-amber-700",
        title: "text-amber-900",
        body: "text-amber-800",
      }
    : isUserFixable
    ? {
        border: "border-blue-200",
        bg: "bg-blue-50",
        iconBg: "bg-blue-100",
        iconColor: "text-blue-700",
        title: "text-blue-900",
        body: "text-blue-800",
      }
    : {
        border: "border-red-200",
        bg: "bg-red-50",
        iconBg: "bg-red-100",
        iconColor: "text-red-700",
        title: "text-red-900",
        body: "text-red-800",
      };

  return (
    <div className={`mb-4 overflow-hidden rounded-xl border ${palette.border} ${palette.bg} shadow-sm`}>
      <div className="flex gap-3 p-4">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${palette.iconBg}`}>
          <svg className={`h-5 w-5 ${palette.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d={isRateLimit
                ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                : "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              } />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${palette.title}`}>{error.title}</p>
          <p className={`mt-1 text-sm leading-relaxed ${palette.body}`}>{error.action}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-current/10 pt-2.5">
            <code className="rounded bg-white/60 px-2 py-0.5 font-mono text-[11px] text-gray-600">
              {debugLine}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] text-gray-600 hover:bg-gray-50"
            >
              {copied ? "已複製" : "複製給管理員"}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className={`shrink-0 self-start rounded p-1 text-gray-400 hover:bg-white/40 hover:text-gray-600`}
          aria-label="關閉"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
