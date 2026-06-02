/**
 * Centralised error catalogue.
 *
 * Each error has:
 *  - code:       short stable identifier developers can search logs by
 *  - title:      short user-facing summary (what happened)
 *  - action:     plain-language guidance on what the user should try next
 *  - httpStatus: HTTP status code to return
 *
 * On the server side, prefer `errorResponse(code, ...)` to build a NextResponse
 * with a structured body. The body includes a short reference id (`ref`) so
 * users can quote it to an admin to look up logs.
 */

import { NextResponse } from "next/server";

export type ErrorCode =
  | "RATE_LIMIT_BATCH"
  | "RATE_LIMIT_SINGLE"
  | "API_KEY_MISSING"
  | "MODEL_TIMEOUT"
  | "MODEL_OVERLOADED"
  | "MODEL_REFUSED"
  | "MODEL_AUTH_FAIL"
  | "MODEL_FAILED"
  | "JSON_PARSE_FAIL"
  | "EMPTY_RESPONSE"
  | "INVALID_DAY"
  | "INVALID_REQUEST"
  | "URL_FETCH_FAIL"
  | "NO_URLS"
  | "AUTOFILL_FAIL"
  | "UNKNOWN_FIELD"
  | "NETWORK_FAIL"
  | "UNKNOWN";

interface ErrorMeta {
  title: string;
  action: string;
  httpStatus: number;
}

export const ERROR_CATALOG: Record<ErrorCode, ErrorMeta> = {
  // ── Rate limit (HTTP 429) ──
  RATE_LIMIT_BATCH: {
    title: "今日的「產生一整套」5 次已用完了",
    action:
      "明天台北時間 00:00 會自動補滿額度。如果還是想再產一套，可以等明天，或聯絡管理員。",
    httpStatus: 429,
  },
  RATE_LIMIT_SINGLE: {
    title: "今日的「單封重新生成」5 次已用完了",
    action:
      "明天台北時間 00:00 會自動補滿額度。如果想換個方向，也可以重新跑一次「產生一整套」（如果還有額度）。",
    httpStatus: 429,
  },

  // ── Server configuration (HTTP 500) ──
  API_KEY_MISSING: {
    title: "系統暫時無法產生文案（伺服器設定異常）",
    action:
      "這是後台設定問題，跟你的操作無關。請聯絡管理員處理，並把下方的錯誤代碼一起回報。",
    httpStatus: 500,
  },

  // ── Anthropic API errors (HTTP 502/504) ──
  MODEL_TIMEOUT: {
    title: "AI 想了太久還沒回覆，這封信沒寫完",
    action:
      "點「重新生成」這封信通常就會成功。如果一直失敗，可能是 AI 服務目前繁忙，等幾分鐘再試。",
    httpStatus: 504,
  },
  MODEL_OVERLOADED: {
    title: "AI 服務目前太忙，回不過來",
    action: "等 30~60 秒後再點「重新生成」。如果一直忙線，可以等幾分鐘再回來。",
    httpStatus: 503,
  },
  MODEL_REFUSED: {
    title: "AI 拒絕產生這封信的內容",
    action:
      "通常是內容裡有 AI 不願意處理的字眼（敏感主題、極端說法等）。可以調整品牌描述、痛點或語氣後重試。",
    httpStatus: 502,
  },
  MODEL_AUTH_FAIL: {
    title: "AI 服務認證失敗",
    action:
      "這是後台金鑰過期或失效。請通知管理員更新 ANTHROPIC_API_KEY，並附上下方錯誤代碼。",
    httpStatus: 502,
  },
  MODEL_FAILED: {
    title: "AI 在產生這封信時發生未預期錯誤",
    action:
      "等 30 秒後點「重新生成」。如果重複發生，請告知管理員（含下方錯誤代碼）。",
    httpStatus: 502,
  },

  // ── Response parsing ──
  JSON_PARSE_FAIL: {
    title: "AI 回傳的內容格式怪怪的，解析失敗",
    action:
      "點「重新生成」通常就能解決。如果重複發生，請告知管理員（含下方錯誤代碼）。",
    httpStatus: 502,
  },
  EMPTY_RESPONSE: {
    title: "AI 沒有回傳任何內容",
    action: "點「重新生成」再試一次即可。",
    httpStatus: 502,
  },

  // ── Validation (HTTP 400) ──
  INVALID_DAY: {
    title: "信件編號不正確",
    action: "請重新整理頁面後再操作一次。",
    httpStatus: 400,
  },
  INVALID_REQUEST: {
    title: "送出的資料格式有問題",
    action: "請重新整理頁面後再操作一次。如果一樣有問題，請告知管理員。",
    httpStatus: 400,
  },

  // ── Style analysis ──
  URL_FETCH_FAIL: {
    title: "抓不到你提供的網址內容",
    action:
      "請檢查網址是否打對、網頁是否公開可訪問（不需登入）。也可以略過風格分析，直接繼續下一步。",
    httpStatus: 502,
  },
  NO_URLS: {
    title: "請至少貼上一個過往文章網址",
    action: "在輸入框中貼上 1~3 個你的代表性文章網址，每行一個。",
    httpStatus: 400,
  },

  // ── Auto-fill ──
  AUTOFILL_FAIL: {
    title: "AI 自動填寫失敗",
    action: "等一下再試。如果一直失敗，你可以直接手動輸入這個欄位。",
    httpStatus: 500,
  },
  UNKNOWN_FIELD: {
    title: "系統不認識這個欄位",
    action: "請重新整理頁面後再試一次。如果重複發生，請告知管理員。",
    httpStatus: 400,
  },

  // ── Client-side (not returned by API, used by frontend) ──
  NETWORK_FAIL: {
    title: "無法連線到伺服器",
    action: "檢查網路連線後重試。如果是公司網路，可能被防火牆擋住。",
    httpStatus: 0,
  },

  // ── Fallback ──
  UNKNOWN: {
    title: "發生未知錯誤",
    action: "請重新整理頁面後再試。如果重複發生，請告知管理員（含下方錯誤代碼）。",
    httpStatus: 500,
  },
};

/**
 * Generate a short reference id (5 chars, alphanumeric, easy to read aloud).
 * Use this to correlate user reports with server logs.
 */
export function generateRef(): string {
  // No vowels / lookalikes to reduce phone-confusion (0/o, 1/l/i)
  const alphabet = "23456789bcdfghjkmnpqrstvwxyz";
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export interface ApiErrorPayload {
  /** Stable error code, e.g. "MODEL_TIMEOUT" */
  code: ErrorCode;
  /** Short user-friendly title */
  title: string;
  /** Plain-language guidance for the user */
  action: string;
  /** Short reference id for support / log lookup */
  ref: string;
  /** Optional extra payload (e.g. rate limit details) */
  extra?: Record<string, unknown>;
}

/**
 * Build a structured error response and log it server-side with the reference id.
 */
export function errorResponse(
  code: ErrorCode,
  options: {
    logContext?: string;
    cause?: unknown;
    extra?: Record<string, unknown>;
  } = {},
): NextResponse {
  const meta = ERROR_CATALOG[code];
  const ref = generateRef();
  const causeStr =
    options.cause instanceof Error
      ? `${options.cause.name}: ${options.cause.message}`
      : options.cause
      ? String(options.cause)
      : undefined;

  // Server log: include code + ref so admins can grep
  console.error(
    `[err:${code}] ref=${ref} ${options.logContext ?? ""}${causeStr ? ` cause=${causeStr}` : ""}`,
  );

  const body: ApiErrorPayload = {
    code,
    title: meta.title,
    action: meta.action,
    ref,
    ...(options.extra ? { extra: options.extra } : {}),
  };

  return NextResponse.json(body, { status: meta.httpStatus });
}

/**
 * Inspect an Anthropic SDK error and classify it into one of our codes.
 */
export function classifyAnthropicError(err: unknown): ErrorCode {
  if (!err) return "MODEL_FAILED";

  // The SDK throws errors with `status` (HTTP code) and `name`
  const e = err as { status?: number; name?: string; message?: string };
  const status = e.status;
  const msg = (e.message || "").toLowerCase();

  if (status === 401 || status === 403) return "MODEL_AUTH_FAIL";
  if (status === 429) {
    // Could be model rate limit (different from our rate limiter) or overloaded
    return "MODEL_OVERLOADED";
  }
  if (status === 503 || status === 529) return "MODEL_OVERLOADED";
  if (status === 504 || msg.includes("timeout") || msg.includes("timed out")) {
    return "MODEL_TIMEOUT";
  }
  if (msg.includes("refus") || msg.includes("declin") || msg.includes("content")) {
    // Anthropic's safety refusals
    return "MODEL_REFUSED";
  }
  return "MODEL_FAILED";
}
