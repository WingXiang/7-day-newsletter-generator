import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SYSTEM_PROMPT, buildSinglePrompt } from "@/lib/email-prompts";
import type { SingleLayout, ToneStyle } from "@/lib/email-prompts";
import { getAnthropicApiKey } from "@/lib/api-key";
import { checkSingleAndIncrement, getClientIp } from "@/lib/rate-limit";
import { errorResponse, classifyAnthropicError } from "@/lib/error-codes";

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
    return errorResponse("API_KEY_MISSING", { logContext: "single-generate" });
  }

  let body: {
    layout: SingleLayout;
    brandTheme?: string;
    issueTopic: string;
    articleTexts?: string[];
    targetAudience?: string;
    keyPoints?: string;
    ctaGoal?: string;
    toneStyle?: ToneStyle;
    customTone?: string;
    additionalInstructions?: string;
  };
  try {
    body = await req.json();
  } catch (err) {
    return errorResponse("INVALID_REQUEST", { logContext: "single-generate: bad json", cause: err });
  }

  if (!body.issueTopic || !body.issueTopic.trim()) {
    return errorResponse("INVALID_REQUEST", { logContext: "single-generate: missing issueTopic" });
  }

  const ip = getClientIp(req);
  const rl = await checkSingleAndIncrement(ip);

  if (!rl.allowed) {
    return errorResponse("RATE_LIMIT_SINGLE", {
      logContext: `rate-limit blocked ip=${ip} blockedBy=${rl.blockedBy}`,
      extra: {
        rateLimit: {
          batch: rl.batch,
          single: rl.single,
          resetsAt: rl.resetsAt,
          blockedBy: rl.blockedBy,
        },
      },
    });
  }

  const anthropic = new Anthropic({ apiKey, authToken: null });

  let message;
  try {
    const userPrompt = buildSinglePrompt({
      layout: body.layout,
      brandTheme: body.brandTheme,
      issueTopic: body.issueTopic,
      articleTexts: body.articleTexts,
      targetAudience: body.targetAudience,
      keyPoints: body.keyPoints,
      ctaGoal: body.ctaGoal,
      toneStyle: body.toneStyle,
      customTone: body.customTone,
      additionalInstructions: body.additionalInstructions,
    });

    message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    const code = classifyAnthropicError(err);
    return errorResponse(code, {
      logContext: `anthropic call failed single layout=${body.layout}`,
      cause: err,
    });
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return errorResponse("EMPTY_RESPONSE", {
      logContext: `no text block, stop_reason=${message.stop_reason}`,
    });
  }

  let emailData;
  try {
    const jsonStr = textBlock.text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    emailData = JSON.parse(escapeControlCharsInJsonStrings(jsonStr));
  } catch (err) {
    return errorResponse("JSON_PARSE_FAIL", {
      logContext: `parse failed single text-preview=${textBlock.text.slice(0, 200)}`,
      cause: err,
    });
  }

  return NextResponse.json({
    day: 0,
    theme: body.issueTopic,
    sendTiming: "單篇發送",
    ...emailData,
    rateLimit: {
      batch: rl.batch,
      single: rl.single,
      resetsAt: rl.resetsAt,
    },
  });
}
