import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/error-codes";

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

  return text.slice(0, 3000);
}

export async function POST(req: NextRequest) {
  let parsed: { articles: Array<{ type: "url" | "text"; value: string }> };
  try {
    parsed = await req.json();
  } catch (err) {
    return errorResponse("INVALID_REQUEST", { logContext: "article-fetch: bad json", cause: err });
  }

  const { articles } = parsed;
  if (!articles || articles.length === 0) {
    return errorResponse("INVALID_REQUEST", { logContext: "article-fetch: no articles" });
  }

  const texts: string[] = [];
  let fetchedAny = false;

  for (const article of articles) {
    if (article.type === "text") {
      const trimmed = (article.value || "").trim().slice(0, 3000);
      if (trimmed) {
        texts.push(trimmed);
        fetchedAny = true;
      }
    } else if (article.type === "url") {
      const url = (article.value || "").trim();
      if (!url.startsWith("http://") && !url.startsWith("https://")) continue;
      try {
        const text = await fetchPageText(url);
        texts.push(text);
        fetchedAny = true;
      } catch (err) {
        console.warn(`[article-fetch] fetch fail url=${url}: ${err}`);
        // Skip failed URLs — partial failure is tolerated
      }
    }
  }

  if (!fetchedAny) {
    return errorResponse("ARTICLE_FETCH_FAIL", {
      logContext: `all ${articles.length} articles failed`,
    });
  }

  return NextResponse.json({ texts });
}
