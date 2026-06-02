import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  SYSTEM_PROMPT,
  buildTrustPrompt,
  buildSalesPrompt,
  TRUST_SEQUENCE,
  SALES_SEQUENCE,
} from "@/lib/email-prompts";
import type { TrustFormData, SalesFormData } from "@/lib/email-prompts";
import { getAnthropicApiKey } from "@/lib/api-key";

/**
 * Replace literal control characters (newlines, tabs, CR) with their escape
 * sequences ONLY inside JSON string literals. This allows JSON.parse to handle
 * model responses where body text contains raw newlines.
 */
function escapeControlCharsInJsonStrings(s: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      result += ch;
      escaped = true;
      continue;
    }
    if (ch === '"') {
      result += ch;
      inString = !inString;
      continue;
    }
    if (inString) {
      if (ch === "\n") { result += "\\n"; continue; }
      if (ch === "\r") { result += "\\r"; continue; }
      if (ch === "\t") { result += "\\t"; continue; }
    }
    result += ch;
  }
  return result;
}

export async function POST(req: NextRequest) {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 500 },
    );
  }
  // Pass authToken: null to prevent SDK from picking up empty ANTHROPIC_AUTH_TOKEN env var
  const anthropic = new Anthropic({ apiKey, authToken: null });

  const body = await req.json();
  const { sequenceType, formData, dayIndex, additionalInstructions } = body as {
    sequenceType: "trust" | "sales";
    formData: TrustFormData | SalesFormData;
    dayIndex: number;
    additionalInstructions?: string;
  };

  const sequence = sequenceType === "trust" ? TRUST_SEQUENCE : SALES_SEQUENCE;
  const day = sequence[dayIndex];

  if (!day) {
    return NextResponse.json({ error: "Invalid day index" }, { status: 400 });
  }

  try {
    const userPrompt =
      sequenceType === "trust"
        ? buildTrustPrompt(formData as TrustFormData, day, additionalInstructions)
        : buildSalesPrompt(formData as SalesFormData, day, additionalInstructions);

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text in response" }, { status: 500 });
    }

    const jsonStr = textBlock.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const emailData = JSON.parse(escapeControlCharsInJsonStrings(jsonStr));

    return NextResponse.json({
      day: day.day,
      theme: day.theme,
      sendTiming: day.sendTiming,
      ...emailData,
    });
  } catch (err) {
    console.error("Email generation failed:", err);
    // Never expose internal error details (API key, model name, stack traces) to client
    return NextResponse.json(
      { error: "Email generation failed. Please try again." },
      { status: 500 },
    );
  }
}
