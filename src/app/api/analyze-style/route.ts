import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getAnthropicApiKey } from "@/lib/api-key";
import { errorResponse, classifyAnthropicError } from "@/lib/error-codes";


async function fetchPageText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsletterBot/1.0)" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);

  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  return text.slice(0, 5000);
}

export async function POST(req: NextRequest) {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return errorResponse("API_KEY_MISSING", { logContext: "analyze-style" });
  }
  const anthropic = new Anthropic({ apiKey, authToken: null });

  let parsed: { urls: string[] };
  try {
    parsed = await req.json();
  } catch (err) {
    return errorResponse("INVALID_REQUEST", { logContext: "analyze-style: bad json", cause: err });
  }
  const { urls } = parsed;

  if (!urls || urls.length === 0) {
    return errorResponse("NO_URLS", { logContext: "no urls provided" });
  }

  const validUrls = urls
    .map((u: string) => u.trim())
    .filter((u: string) => u && (u.startsWith("http://") || u.startsWith("https://")));

  if (validUrls.length === 0) {
    return errorResponse("NO_URLS", { logContext: "no valid urls after filter" });
  }

  // Fetch URLs first — track failures so we can decide if ALL failed
  const texts: string[] = [];
  let fetchedAny = false;
  for (const url of validUrls.slice(0, 3)) {
    try {
      const text = await fetchPageText(url);
      texts.push(`--- 來源：${url} ---\n${text}`);
      fetchedAny = true;
    } catch (err) {
      console.warn(`[analyze-style] fetch fail url=${url}: ${err}`);
      texts.push(`--- 來源：${url} ---\n（擷取失敗）`);
    }
  }

  if (!fetchedAny) {
    return errorResponse("URL_FETCH_FAIL", {
      logContext: `all ${validUrls.length} urls failed to fetch`,
    });
  }

  const prompt = `以下是使用者提供的文章內容，請分析這些文章的寫作風格：

${texts.join("\n\n")}

請用繁體中文，以 2-4 句話摘要這位作者的寫作風格特色，包括：
- 語氣和說話方式（正式/口語/幽默等）
- 常用的修辭手法或表達方式
- 文章結構特點
- 其他明顯的風格特徵

直接回覆風格摘要，不要加標題或額外說明。`;

  let message;
  try {
    message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
  } catch (err) {
    const code = classifyAnthropicError(err);
    return errorResponse(code, { logContext: "analyze-style anthropic call", cause: err });
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    return errorResponse("EMPTY_RESPONSE", {
      logContext: `analyze-style empty stop=${message.stop_reason}`,
    });
  }

  return NextResponse.json({ styleAnalysis: textBlock.text.trim() });
}
