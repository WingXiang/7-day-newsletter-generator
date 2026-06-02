import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  TRUST_FIELD_HINTS,
  SALES_FIELD_HINTS,
} from "@/lib/email-prompts";
import { getAnthropicApiKey } from "@/lib/api-key";

export async function POST(req: NextRequest) {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey, authToken: null });

  const { fieldName, sequenceType, currentData } = await req.json() as {
    fieldName: string;
    sequenceType: "trust" | "sales";
    currentData: Record<string, unknown>;
  };

  const hints = sequenceType === "trust" ? TRUST_FIELD_HINTS : SALES_FIELD_HINTS;
  const fieldHint = hints[fieldName];
  if (!fieldHint) {
    return NextResponse.json({ error: "Unknown field" }, { status: 400 });
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

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text in response" }, { status: 500 });
    }

    return NextResponse.json({ value: textBlock.text.trim() });
  } catch (err) {
    console.error("Auto-fill failed:", err);
    return NextResponse.json(
      { error: "Auto-fill failed. Please try again." },
      { status: 500 },
    );
  }
}
