import { readFileSync } from "fs";
import { join } from "path";

let cachedKey: string | null | undefined = undefined;

/**
 * Resolve ANTHROPIC_API_KEY by reading .env.local directly.
 * This avoids conflicts where parent shells may set empty ANTHROPIC_* env vars
 * that override Next.js's dotenv loader.
 */
export function getAnthropicApiKey(): string | null {
  if (cachedKey !== undefined) return cachedKey;

  // Try process.env first (works when env vars are set cleanly)
  const fromEnv = process.env.ANTHROPIC_API_KEY;
  if (fromEnv && fromEnv.trim().length > 0) {
    cachedKey = fromEnv.trim();
    return cachedKey;
  }

  // Fallback: read .env.local directly
  try {
    const envPath = join(process.cwd(), ".env.local");
    const content = readFileSync(envPath, "utf-8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key === "ANTHROPIC_API_KEY") {
        const value = trimmed.slice(eq + 1).trim()
          // Strip surrounding quotes if present
          .replace(/^["']|["']$/g, "");
        if (value.length > 0) {
          cachedKey = value;
          return cachedKey;
        }
      }
    }
  } catch {
    // ignore - .env.local not found or unreadable
  }

  cachedKey = null;
  return null;
}
