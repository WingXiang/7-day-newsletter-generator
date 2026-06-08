const KIT_BASE = "https://api.kit.com/v4";

function kitHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "X-Kit-Api-Key": apiKey,
  };
}

// ── Account ──

export interface KitAccount {
  id: number;
  name: string;
  plan_type: string;
  primary_email_address: string;
}

export interface KitUser {
  email: string;
  id: number;
}

export async function getAccount(apiKey: string): Promise<{ user: KitUser; account: KitAccount }> {
  const res = await fetch(`${KIT_BASE}/account`, {
    headers: kitHeaders(apiKey),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kit API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ── Sequences ──

export interface KitSequence {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
}

export async function listSequences(apiKey: string): Promise<KitSequence[]> {
  const res = await fetch(`${KIT_BASE}/sequences`, {
    headers: kitHeaders(apiKey),
  });
  if (!res.ok) throw new Error(`Kit API error ${res.status}`);
  const data = await res.json();
  return data.sequences ?? [];
}

export async function createSequence(
  apiKey: string,
  name: string,
): Promise<KitSequence> {
  const res = await fetch(`${KIT_BASE}/sequences`, {
    method: "POST",
    headers: kitHeaders(apiKey),
    body: JSON.stringify({ name, active: false }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kit API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.sequence;
}

// ── Sequence Emails ──

export interface CreateEmailParams {
  subject: string;
  preview_text: string;
  content: string;
  delay_value: number;
  delay_unit: "days" | "hours";
  position: number;
  published: boolean;
}

export async function createSequenceEmail(
  apiKey: string,
  sequenceId: number,
  params: CreateEmailParams,
): Promise<{ id: number }> {
  const res = await fetch(`${KIT_BASE}/sequences/${sequenceId}/emails`, {
    method: "POST",
    headers: kitHeaders(apiKey),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kit API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.email;
}

// ── Broadcasts (one-off newsletters) ──

export interface CreateBroadcastParams {
  subject: string;
  preview_text: string;
  content: string;
  description?: string;
}

export interface KitBroadcast {
  id: number;
  subject: string;
}

/**
 * Create a broadcast as a DRAFT (send_at: null, public: false).
 * Works on the free Newsletter plan — broadcasts are not gated like sequences.
 */
export async function createBroadcast(
  apiKey: string,
  params: CreateBroadcastParams,
): Promise<KitBroadcast> {
  const res = await fetch(`${KIT_BASE}/broadcasts`, {
    method: "POST",
    headers: kitHeaders(apiKey),
    body: JSON.stringify({
      subject: params.subject,
      preview_text: params.preview_text,
      content: params.content,
      description: params.description ?? params.subject,
      public: false,
      send_at: null,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kit API error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.broadcast;
}

// ── Helpers ──

/**
 * Convert plain newsletter body text into clean, editor-friendly HTML for Kit
 * broadcasts: one <p> per non-empty line, special chars escaped, no <br>/<ul>.
 *
 * Kit's broadcast editor imports clean semantic <p> paragraphs as native,
 * directly-editable text blocks. Mixed markup (<br>, <ul>) instead lands as a
 * single raw-HTML block that the user can't edit inline — which is why the
 * broadcast path uses this rather than markdownToHtml().
 */
export function textToEditableHtml(text: string): string {
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

export function markdownToHtml(md: string): string {
  return md
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
    .split("\n\n")
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      // detect list items
      if (/^[-*]\s/.test(trimmed)) {
        const items = trimmed
          .split("\n")
          .filter((l) => l.trim())
          .map((l) => `<li>${l.replace(/^[-*]\s+/, "")}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }
      return `<p>${trimmed.replace(/\n/g, "<br>")}</p>`;
    })
    .filter(Boolean)
    .join("\n");
}

export function isPaidPlan(planType: string): boolean {
  const lower = planType.toLowerCase();
  return lower.includes("creator") || lower.includes("pro") || lower.includes("premium");
}
