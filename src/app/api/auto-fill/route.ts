import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  TRUST_FIELD_HINTS,
  SALES_FIELD_HINTS,
  SINGLE_FIELD_HINTS,
} from "@/lib/email-prompts";
import { getAnthropicApiKey } from "@/lib/api-key";
import { errorResponse, classifyAnthropicError } from "@/lib/error-codes";

export async function POST(req: NextRequest) {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return errorResponse("API_KEY_MISSING", { logContext: "auto-fill" });
  }
  const anthropic = new Anthropic({ apiKey, authToken: null });

  let parsed: {
    fieldName: string;
    sequenceType: "trust" | "sales" | "article" | "single";
    currentData?: Record<string, unknown>;
    articleTexts?: string[];
    emailType?: "trust" | "sales";
    brandTheme?: string;
    issueTopic?: string;
  };
  try {
    parsed = await req.json();
  } catch (err) {
    return errorResponse("INVALID_REQUEST", { logContext: "auto-fill: bad json", cause: err });
  }
  const { fieldName, sequenceType } = parsed;

  // ── Single weekly newsletter auto-fill ──
  if (sequenceType === "single") {
    const fieldHint = SINGLE_FIELD_HINTS[fieldName];
    if (!fieldHint) {
      return errorResponse("UNKNOWN_FIELD", { logContext: `field=${fieldName} single` });
    }

    const brandTheme = (parsed.brandTheme ?? "").trim();
    const issueTopic = (parsed.issueTopic ?? "").trim();
    const articleTexts = parsed.articleTexts ?? [];
    const articleSection = articleTexts
      .slice(0, 5)
      .map((t, i) => `=== 文章 ${i + 1} ===\n${t.slice(0, 500)}`)
      .join("\n\n");

    const ctx = [
      brandTheme ? `品牌主題 / 定位：${brandTheme}` : "",
      issueTopic ? `本期主題：${issueTopic}` : "",
      articleSection ? `品牌過往文章：\n${articleSection}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const prompt = `你是一位行銷顧問，正在協助使用者填寫「單篇週電子報」表單。

目前已知資訊：

${ctx || "（尚未提供資訊）"}

請根據以上資訊，推斷並填寫「${fieldHint.label}」欄位。
欄位說明：${fieldHint.why}

要求：
- 使用繁體中文
- 內容要具體、有用，貼合本期主題，不要太泛泛
- 字數適中，不要太長
- 直接回覆欄位內容，不要加任何額外說明`;

    let message;
    try {
      message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (err) {
      const cls = classifyAnthropicError(err);
      if (cls === "MODEL_AUTH_FAIL" || cls === "MODEL_REFUSED") {
        return errorResponse(cls, { logContext: `auto-fill single field=${fieldName}`, cause: err });
      }
      return errorResponse("AUTOFILL_FAIL", { logContext: `auto-fill single field=${fieldName}`, cause: err });
    }

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return errorResponse("EMPTY_RESPONSE", { logContext: `auto-fill single empty` });
    }
    return NextResponse.json({ value: textBlock.text.trim() });
  }

  // ── Article-based auto-fill ──
  if (sequenceType === "article") {
    const articleTexts = parsed.articleTexts ?? [];
    const emailType = parsed.emailType ?? "trust";
    const hints = emailType === "trust" ? TRUST_FIELD_HINTS : SALES_FIELD_HINTS;
    const fieldHint = hints[fieldName];
    if (!fieldHint) {
      return errorResponse("UNKNOWN_FIELD", {
        logContext: `field=${fieldName} article emailType=${emailType}`,
      });
    }

    const articleSection = articleTexts
      .slice(0, 5)
      .map((t, i) => `=== 文章 ${i + 1} ===\n${t.slice(0, 600)}`)
      .join("\n\n");

    const prompt = `你是一位行銷顧問，正在協助使用者根據過往文章自動填寫電子報表單。

以下是使用者提供的部分文章內容（供推斷品牌資訊）：

${articleSection || "（尚未提供文章內容）"}

請根據上方的文章內容，推斷並填寫「${fieldHint.label}」欄位。
欄位說明：${fieldHint.why}

要求：
- 使用繁體中文
- 直接從文章中推斷，不要憑空捏造
- 若文章中無法判斷（例如價格、折扣碼），請輸出「請手動填寫」
- 字數適中，不要太長
- 直接回覆欄位內容，不要加任何額外說明`;

    let message;
    try {
      message = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      });
    } catch (err) {
      const cls = classifyAnthropicError(err);
      if (cls === "MODEL_AUTH_FAIL" || cls === "MODEL_REFUSED") {
        return errorResponse(cls, { logContext: `auto-fill article field=${fieldName}`, cause: err });
      }
      return errorResponse("AUTOFILL_FAIL", { logContext: `auto-fill article field=${fieldName}`, cause: err });
    }

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return errorResponse("EMPTY_RESPONSE", { logContext: `auto-fill article empty` });
    }
    return NextResponse.json({ value: textBlock.text.trim() });
  }

  // ── Trust / Sales auto-fill (original) ──
  const currentData = parsed.currentData ?? {};
  const hints = sequenceType === "trust" ? TRUST_FIELD_HINTS : SALES_FIELD_HINTS;
  const fieldHint = hints[fieldName];
  if (!fieldHint) {
    return errorResponse("UNKNOWN_FIELD", {
      logContext: `field=${fieldName} seq=${sequenceType}`,
    });
  }

  const filledFields = Object.entries(currentData)
    .filter(([, v]) => {
      if (typeof v === "string") return v.trim() !== "";
      if (Array.isArray(v)) return v.some((item) => typeof item === "string" && item.trim() !== "");
      return false;
    })
    .map(([k, v]) => {
      const h = hints[k];
      const label = h?.label || k;
      const value = Array.isArray(v) ? (v as string[]).filter((s) => s.trim()).join("、") : v;
      return `- ${label}：${value}`;
    })
    .join("\n");

  const prompt = `你是一位行銷顧問，正在協助使用者填寫電子報文案產生器的表單。

使用者正在填寫「${sequenceType === "trust" ? "信任信" : "銷售信"}」的資料。

目前已填寫的資料：
${filledFields || "（尚未填寫任何欄位）"}

請根據已填寫的資料，幫使用者自動產生「${fieldHint.label}」欄位的內容。
欄位說明：${fieldHint.why}

要求：
- 使用繁體中文
- 內容要具體、有用，不要太泛泛
- 字數適中，不要太長
- 直接回覆欄位內容，不要加任何額外說明或標點符號包裝`;

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const cls = classifyAnthropicError(err);
    if (cls === "MODEL_AUTH_FAIL" || cls === "MODEL_REFUSED") {
      return errorResponse(cls, { logContext: `auto-fill field=${fieldName}`, cause: err });
    }
    return errorResponse("AUTOFILL_FAIL", { logContext: `auto-fill field=${fieldName}`, cause: err });
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return errorResponse("EMPTY_RESPONSE", {
      logContext: `auto-fill empty stop=${message.stop_reason}`,
    });
  }

  return NextResponse.json({ value: textBlock.text.trim() });
}
