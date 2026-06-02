import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { getAnthropicApiKey } from "@/lib/api-key";


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
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured" }, { status: 500 });
  }
  const anthropic = new Anthropic({ apiKey, authToken: null });

  const { urls } = await req.json() as { urls: string[] };

  if (!urls || urls.length === 0) {
    return NextResponse.json({ error: "No URLs provided" }, { status: 400 });
  }

  const validUrls = urls
    .map((u: string) => u.trim())
    .filter((u: string) => u && (u.startsWith("http://") || u.startsWith("https://")));

  if (validUrls.length === 0) {
    return NextResponse.json({ error: "No valid URLs provided" }, { status: 400 });
  }

  try {
    const texts: string[] = [];
    for (const url of validUrls.slice(0, 3)) {
      try {
        const text = await fetchPageText(url);
        texts.push(`--- 來源：${url} ---\n${text}`);
      } catch (err) {
        texts.push(`--- 來源：${url} ---\n（擷取失敗：${err instanceof Error ? err.message : "unknown"}）`);
      }
    }

    const prompt = `以下是使用者提供的文章內容，請分析這些文章的寫作風格：

${texts.join("\n\n")}

請用繁體中文，以 2-4 句話摘要這位作者的寫作風格特色，包括：
- 語氣和說話方式（正式/口語/幽默等）
- 常用的修辭手法或表達方式
- 文章結構特點
- 其他明顯的風格特徵

直接回覆風格摘要，不要加標題或額外說明。`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text in response" }, { status: 500 });
    }

    return NextResponse.json({ styleAnalysis: textBlock.text.trim() });
  } catch (err) {
    console.error("Style analysis failed:", err);
    return NextResponse.json(
      { error: "Style analysis failed. Please try again." },
      { status: 500 },
    );
  }
}
