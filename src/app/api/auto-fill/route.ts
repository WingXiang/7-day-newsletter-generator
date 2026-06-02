import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  TRUST_FIELD_HINTS,
  SALES_FIELD_HINTS,
} from "@/lib/email-prompts";
import { getAnthropicApiKey } from "@/lib/api-key";
import { errorResponse, classifyAnthropicError } from "@/lib/error-codes";

export async function POST(req: NextRequest) {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return errorResponse("API_KEY_MISSING", { logContext: "auto-fill" });
  }
  const anthropic = new Anthropic({ apiKey, authToken: null });

  let parsed: { fieldName: string; sequenceType: "trust" | "sales"; currentData: Record<string, unknown> };
  try {
    parsed = await req.json();
  } catch (err) {
    return errorResponse("INVALID_REQUEST", { logContext: "auto-fill: bad json", cause: err });
  }
  const { fieldName, sequenceType, currentData } = parsed;

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
    // For autofill, prefer the autofill-specific code over MODEL_FAILED to give
    // the user the gentler "you can type it manually" guidance.
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
