import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import {
  SYSTEM_PROMPT,
  buildArticleEmailPrompt,
  TRUST_SEQUENCE,
  SALES_SEQUENCE,
} from "@/lib/email-prompts";
import type { ArticleFormData } from "@/lib/email-prompts";
import { getAnthropicApiKey } from "@/lib/api-key";
import {
  checkBatchAndIncrement,
  checkSingleAndIncrement,
  getClientIp,
} from "@/lib/rate-limit";
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
    return errorResponse("API_KEY_MISSING", { logContext: "article-generate" });
  }

  let body: {
    articleTexts: string[];
    emailType: "trust" | "sales";
    dayIndex: number;
    additionalInstructions?: string;
    batchId?: string;
    optionalFields?: Partial<ArticleFormData>;
  };
  try {
    body = await req.json();
  } catch (err) {
    return errorResponse("INVALID_REQUEST", { logContext: "article-generate: bad json", cause: err });
  }

  const { articleTexts, emailType, dayIndex, additionalInstructions, batchId, optionalFields } = body;

  const ip = getClientIp(req);
  const rl = batchId
    ? await checkBatchAndIncrement(ip, batchId)
    : await checkSingleAndIncrement(ip);

  if (!rl.allowed) {
    return errorResponse(
      rl.blockedBy === "batch" ? "RATE_LIMIT_BATCH" : "RATE_LIMIT_SINGLE",
      {
        logContext: `rate-limit blocked ip=${ip} blockedBy=${rl.blockedBy}`,
        extra: {
          rateLimit: {
            batch: rl.batch,
            single: rl.single,
            resetsAt: rl.resetsAt,
            blockedBy: rl.blockedBy,
          },
        },
      },
    );
  }

  const anthropic = new Anthropic({ apiKey, authToken: null });
  const sequence = emailType === "trust" ? TRUST_SEQUENCE : SALES_SEQUENCE;
  const day = sequence[dayIndex];

  if (!day) {
    return errorResponse("INVALID_DAY", {
      logContext: `dayIndex=${dayIndex} emailType=${emailType}`,
    });
  }

  let message;
  try {
    const userPrompt = buildArticleEmailPrompt(
      articleTexts,
      emailType,
      day,
      optionalFields,
      additionalInstructions,
    );

    message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });
  } catch (err) {
    const code = classifyAnthropicError(err);
    return errorResponse(code, {
      logContext: `anthropic call failed day=${day.day} emailType=${emailType}`,
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
      logContext: `parse failed day=${day.day} text-preview=${textBlock.text.slice(0, 200)}`,
      cause: err,
    });
  }

  return NextResponse.json({
    day: day.day,
    theme: day.theme,
    sendTiming: day.sendTiming,
    ...emailData,
    rateLimit: {
      batch: rl.batch,
      single: rl.single,
      resetsAt: rl.resetsAt,
    },
  });
}
