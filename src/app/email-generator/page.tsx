"use client";

import { useState, useCallback, useEffect, Fragment } from "react";
import TrustForm from "./TrustForm";
import SalesForm from "./SalesForm";
import EmailCard from "./EmailCard";
import KitIntegration from "./KitIntegration";
import ErrorBanner, { parseErrorResponse, networkError } from "./ErrorBanner";
import type { ParsedError } from "./ErrorBanner";
import type {
  TrustFormData,
  SalesFormData,
  EmailObject,
} from "@/lib/email-prompts";
import { TRUST_SEQUENCE, SALES_SEQUENCE } from "@/lib/email-prompts";

// Strip markdown-style bold markers and common icons from body text
function sanitizeBody(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/#{1,6}\s/g, "")
    .replace(/^[-*+]\s/gm, "")
    .replace(/^\d+\.\s/gm, "");
}

// Pill displaying one quota counter in the header
function QuotaPill({
  label,
  used,
  limit,
  remaining,
}: {
  label: string;
  used: number;
  limit: number;
  remaining: number;
}) {
  const color =
    remaining === 0
      ? "border-red-200 bg-red-50 text-red-700"
      : remaining === 1
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-gray-200 bg-white text-gray-600";
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${color}`}>
      <span className="text-gray-500">{label}</span>
      <span>
        <strong className="font-semibold">{used}</strong>
        <span className="text-gray-400"> / {limit}</span>
      </span>
    </div>
  );
}

type Tab = "trust" | "sales";
type Step = "form" | "generating" | "results";
type ViewMode = "block" | "list";

interface SeqState {
  step: Step;
  formData: TrustFormData | SalesFormData | null;
  emails: (EmailObject | null)[];
  progress: { current: number; total: number };
}

const INIT_SEQ: SeqState = {
  step: "form",
  formData: null,
  emails: Array(7).fill(null),
  progress: { current: 0, total: 7 },
};

export default function EmailGeneratorPage() {
  const [activeTab, setActiveTab] = useState<Tab>("trust");
  const [trustState, setTrustState] = useState<SeqState>({ ...INIT_SEQ });
  const [salesState, setSalesState] = useState<SeqState>({ ...INIT_SEQ });
  const [regeneratingKey, setRegeneratingKey] = useState<string | null>(null);
  const [kitOpen, setKitOpen] = useState(false);
  const [error, setError] = useState<ParsedError | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("block");
  const [listExpandedIndex, setListExpandedIndex] = useState<number | null>(null);
  const [rateLimit, setRateLimit] = useState<{
    batch: { used: number; limit: number; remaining: number };
    single: { used: number; limit: number; remaining: number };
    resetsAt: string;
    enabled: boolean;
  } | null>(null);

  // Fetch rate limit status on mount
  useEffect(() => {
    fetch("/api/rate-limit-status")
      .then((r) => r.json())
      .then((data) => setRateLimit(data))
      .catch(() => {});
  }, []);

  const current = activeTab === "trust" ? trustState : salesState;
  const setCurrent = activeTab === "trust" ? setTrustState : setSalesState;
  const seqInfo = activeTab === "trust" ? TRUST_SEQUENCE : SALES_SEQUENCE;

  // ── Generate a single email ──
  // `batchId` present → counts as part of a full-batch produce (5/day shared by all 7 calls)
  // `batchId` absent  → counts as a single regen (5/day)
  const generateEmail = useCallback(
    async (
      seqType: Tab,
      formData: TrustFormData | SalesFormData,
      dayIndex: number,
      additionalInstructions?: string,
      batchId?: string,
    ): Promise<EmailObject> => {
      let res: Response;
      try {
        res = await fetch("/api/email-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sequenceType: seqType,
            formData,
            dayIndex,
            additionalInstructions,
            batchId,
          }),
        });
      } catch {
        // Network failure — server unreachable
        const ne = networkError();
        const err = new Error(ne.title) as Error & { parsed: ParsedError };
        err.parsed = ne;
        throw err;
      }

      if (!res.ok) {
        const parsed = await parseErrorResponse(res);
        // For rate limit errors the server includes current quota info in `extra`
        const body = await res.clone().json().catch(() => ({} as Record<string, unknown>));
        const extra = body.extra as { rateLimit?: { batch: { used: number; limit: number; remaining: number }; single: { used: number; limit: number; remaining: number }; resetsAt: string } } | undefined;
        if (extra?.rateLimit) {
          setRateLimit({ ...extra.rateLimit, enabled: true });
        }
        const err = new Error(parsed.title) as Error & { parsed: ParsedError };
        err.parsed = parsed;
        throw err;
      }

      const data = await res.json();
      if (data.rateLimit) {
        setRateLimit({ ...data.rateLimit, enabled: true });
      }
      return { ...data, body: sanitizeBody(data.body) } as EmailObject;
    },
    [],
  );

  // ── Submit handler (produce 7-email batch) ──
  const handleSubmit = useCallback(
    async (formData: TrustFormData | SalesFormData) => {
      const setter = activeTab === "trust" ? setTrustState : setSalesState;
      setter({
        step: "generating",
        formData,
        emails: Array(7).fill(null),
        progress: { current: 0, total: 7 },
      });
      setError(null);

      // One batchId shared by all 7 calls so the server counts them as ONE batch
      const batchId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      let current = 0;
      const results: (EmailObject | null)[] = Array(7).fill(null);

      for (let i = 0; i < 7; i++) {
        try {
          const email = await generateEmail(activeTab, formData, i, undefined, batchId);
          results[i] = email;
          setter((prev) => ({
            ...prev,
            emails: [...results],
          }));
        } catch (err) {
          console.error(`Failed ${activeTab} email ${i}:`, err);
          const parsed = (err as Error & { parsed?: ParsedError }).parsed;
          // For rate-limit / config errors, stop the whole batch early — same problem will hit every email
          if (parsed && (parsed.code === "RATE_LIMIT_BATCH" || parsed.code === "API_KEY_MISSING" || parsed.code === "MODEL_AUTH_FAIL")) {
            setError(parsed);
            break;
          }
          // Other errors (timeout, parse fail) — keep going, individual emails can be regenerated
          if (parsed) setError(parsed);
        }
        current++;
        setter((prev) => ({ ...prev, progress: { current, total: 7 } }));
      }

      setter((prev) => ({ ...prev, step: "results" }));
    },
    [activeTab, generateEmail],
  );

  // ── Regenerate single email ──
  const handleRegenerate = useCallback(
    async (dayIndex: number, additionalInstructions?: string) => {
      const st = activeTab === "trust" ? trustState : salesState;
      if (!st.formData) return;
      const key = `${activeTab}-${dayIndex}`;
      setRegeneratingKey(key);
      setError(null);
      try {
        const email = await generateEmail(activeTab, st.formData, dayIndex, additionalInstructions);
        const setter = activeTab === "trust" ? setTrustState : setSalesState;
        setter((prev) => {
          const next = [...prev.emails];
          next[dayIndex] = email;
          return { ...prev, emails: next };
        });
      } catch (err) {
        const parsed = (err as Error & { parsed?: ParsedError }).parsed;
        setError(
          parsed ?? {
            code: "UNKNOWN",
            title: "重新生成失敗",
            action: "請重新整理頁面後再試。如果重複發生，請告知管理員。",
          },
        );
      }
      setRegeneratingKey(null);
    },
    [activeTab, trustState, salesState, generateEmail],
  );

  // ── Update email (from inline editing) ──
  const handleUpdateEmail = useCallback(
    (dayIndex: number, updated: EmailObject) => {
      const setter = activeTab === "trust" ? setTrustState : setSalesState;
      setter((prev) => {
        const next = [...prev.emails];
        next[dayIndex] = updated;
        return { ...prev, emails: next };
      });
    },
    [activeTab],
  );

  // ── Copy ──
  const handleCopy = useCallback(async (email: EmailObject) => {
    const text = `主旨：${email.subject}\n預覽文字：${email.previewText}\n\n${email.body}\n\nCTA：${email.cta}`;
    await navigator.clipboard.writeText(text);
  }, []);

  // ── Export DOCX ──
  const handleExportDocx = useCallback(async () => {
    const st = activeTab === "trust" ? trustState : salesState;
    const emails = st.emails.filter((e): e is EmailObject => e !== null);
    if (emails.length === 0) return;

    const { generateDocx } = await import("@/lib/export-docx");
    const name = activeTab === "trust" ? "信任信" : "銷售信";
    const brand =
      st.formData && "brandName" in st.formData ? st.formData.brandName : "";
    const blob = await generateDocx(name, brand, emails);

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brand}-${name}.docx`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeTab, trustState, salesState]);

  // ── Export TXT ──
  const handleExportTxt = useCallback(() => {
    const st = activeTab === "trust" ? trustState : salesState;
    const emails = st.emails.filter((e): e is EmailObject => e !== null);
    if (emails.length === 0) return;

    const name = activeTab === "trust" ? "信任信" : "銷售信";
    const brand =
      st.formData && "brandName" in st.formData ? st.formData.brandName : "";

    const content = [
      `${name} — ${brand}`,
      "=".repeat(40),
      "",
      ...emails.map(
        (e, i) =>
          `=== Email ${i + 1} ===\n發送時機：${e.sendTiming}\n主旨：${e.subject}\n備用主旨（A/B test）：${e.subjectAlt}\n預覽文字：${e.previewText}\n正文：\n${e.body}\nCTA：${e.cta}`,
      ),
    ].join("\n\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${brand}-${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeTab, trustState, salesState]);

  // ── Tab labels (requirement #4: remove 序列 text) ──
  const TABS: { key: Tab; label: string }[] = [
    { key: "trust", label: "信任信" },
    { key: "sales", label: "銷售信" },
  ];

  // ── Kit data ──
  const kitEmails = current.emails.filter((e): e is EmailObject => e !== null);
  const kitSeqName =
    activeTab === "trust"
      ? `${(current.formData as TrustFormData)?.brandName ?? ""} - 信任信`
      : `${(current.formData as SalesFormData)?.brandName ?? ""} - 銷售信`;

  return (
    <>
      {/* Header */}
      <div className="mb-6 text-center">
        <h1
          className="text-3xl font-bold text-[#1a2e1a] sm:text-4xl"
          style={{ fontFamily: "var(--font-playfair), serif" }}
        >
          電子報 7 天文案產生器
        </h1>
        {rateLimit?.enabled && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <QuotaPill label="產生一整套" used={rateLimit.batch.used} limit={rateLimit.batch.limit} remaining={rateLimit.batch.remaining} />
            <QuotaPill label="單封重新生成" used={rateLimit.single.used} limit={rateLimit.single.limit} remaining={rateLimit.single.remaining} />
            <span className="text-xs text-gray-400">台北時間 00:00 重置</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex justify-center border-b border-gray-300/50">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-[#c9a84c] text-[#1a2e1a]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error banner */}
      <div className="mx-auto max-w-3xl">
        <ErrorBanner error={error} onDismiss={() => setError(null)} />
      </div>

      {/* ── Form step ── */}
      {current.step === "form" && (
        <div className="mx-auto max-w-3xl">
          {activeTab === "trust" ? (
            <TrustForm onSubmit={handleSubmit} />
          ) : (
            <SalesForm onSubmit={handleSubmit} />
          )}
        </div>
      )}

      {/* ── Generating step ── */}
      {current.step === "generating" && (
        <div className="flex min-h-[50vh] flex-col items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-[#1a2e1a] border-t-[#c9a84c]" />
            <h2 className="text-2xl font-bold text-[#1a2e1a]" style={{ fontFamily: "var(--font-playfair), serif" }}>
              正在撰寫{activeTab === "trust" ? "信任信" : "銷售信"}...
            </h2>
            <p className="mt-2 text-gray-600">第 {current.progress.current} / 7 封</p>
            <div className="mx-auto mt-6 h-2.5 w-72 overflow-hidden rounded-full bg-white/80">
              <div className="h-full rounded-full bg-gradient-to-r from-[#1a2e1a] to-[#c9a84c] transition-all duration-700" style={{ width: `${(current.progress.current / 7) * 100}%` }} />
            </div>
            <p className="mt-3 text-sm text-gray-500">每封約 10~20 秒</p>
          </div>
        </div>
      )}

      {/* ── Results step ── */}
      {current.step === "results" && (
        <div className="mx-auto max-w-4xl">
          {/* Actions bar */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <button
              onClick={() => { if (kitEmails.length === 0) { setError({ code: "UNKNOWN", title: "尚無已產生的文案可匯出", action: "請先點「產生 7 封信」按鈕產生內容後再匯出。" }); return; } handleExportDocx(); }}
              className="rounded-lg border border-[#1a2e1a] px-4 py-2 text-sm font-medium text-[#1a2e1a] transition-colors hover:bg-[#1a2e1a] hover:text-white"
            >
              匯出 DOCX
            </button>
            <button
              onClick={() => { if (kitEmails.length === 0) { setError({ code: "UNKNOWN", title: "尚無已產生的文案可匯出", action: "請先點「產生 7 封信」按鈕產生內容後再匯出。" }); return; } handleExportTxt(); }}
              className="rounded-lg border border-[#1a2e1a] px-4 py-2 text-sm font-medium text-[#1a2e1a] transition-colors hover:bg-[#1a2e1a] hover:text-white"
            >
              匯出 TXT
            </button>
            <button
              onClick={() => { if (kitEmails.length === 0) { setError({ code: "UNKNOWN", title: "請先產生至少一封文案，才能發布到 Kit", action: "回到表單填寫資料後，點「產生 7 封信」按鈕。" }); return; } setKitOpen(true); }}
              className="rounded-lg bg-[#c9a84c] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#b89740]"
            >
              發布到 Kit
            </button>

            {/* View mode toggle */}
            <div className="ml-auto flex items-center rounded-lg border border-gray-200 bg-white p-0.5">
              <button onClick={() => setViewMode("block")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "block" ? "bg-[#1a2e1a] text-white" : "text-gray-500 hover:text-gray-700"}`}>
                區塊
              </button>
              <button onClick={() => setViewMode("list")}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === "list" ? "bg-[#1a2e1a] text-white" : "text-gray-500 hover:text-gray-700"}`}>
                列表
              </button>
            </div>

            <button onClick={() => setCurrent({ ...INIT_SEQ })} className="rounded-lg px-4 py-2 text-sm text-gray-500 transition-colors hover:bg-white">
              重新填寫
            </button>
          </div>

          {/* List view */}
          {viewMode === "list" && (
            <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-[#faf8f3]">
                    <th className="px-4 py-3 text-left font-medium text-[#1a2e1a]">Day</th>
                    <th className="px-4 py-3 text-left font-medium text-[#1a2e1a]">主旨</th>
                    <th className="px-4 py-3 text-left font-medium text-[#1a2e1a]">CTA</th>
                    <th className="px-4 py-3 text-right font-medium text-[#1a2e1a]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {current.emails.map((email, index) => {
                    const day = seqInfo[index];
                    const isExpanded = listExpandedIndex === index;
                    return (
                      <Fragment key={`list-frag-${activeTab}-${index}`}>
                        <tr className={`border-b border-gray-100 transition-colors ${isExpanded ? "bg-[#faf8f3]" : "hover:bg-gray-50"}`}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-semibold text-white">{index + 1}</span>
                              <span className="text-xs text-gray-500">{day.theme}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {email ? (
                              <span className="text-gray-900">{email.subject}</span>
                            ) : (
                              <span className="text-gray-400">尚未產生</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {email ? (
                              <span className="inline-block rounded bg-[#f5f0e8] px-2 py-0.5 text-xs font-medium text-[#1a2e1a]">{email.cta}</span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {email ? (
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => handleCopy(email)}
                                  className="flex flex-col items-center rounded px-2 py-1 text-[10px] leading-tight text-gray-500 hover:bg-gray-100"
                                >
                                  <span>複</span><span>製</span>
                                </button>
                                <button
                                  onClick={() => setListExpandedIndex(isExpanded ? null : index)}
                                  className={`flex flex-col items-center rounded px-2 py-1 text-[10px] leading-tight transition-colors ${isExpanded ? "bg-[#1a2e1a] text-white" : "text-gray-500 hover:bg-gray-100"}`}
                                >
                                  <span>展</span><span>開</span>
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => handleRegenerate(index)} disabled={regeneratingKey === `${activeTab}-${index}`}
                                className="rounded bg-[#1a2e1a] px-3 py-1 text-xs font-medium text-white hover:bg-[#2a4a2a] disabled:opacity-50">
                                {regeneratingKey === `${activeTab}-${index}` ? "生成中..." : "產生"}
                              </button>
                            )}
                          </td>
                        </tr>
                        {/* Inline expanded detail */}
                        {isExpanded && email && (
                          <tr>
                            <td colSpan={4} className="border-b border-[#c9a84c]/20 bg-[#faf8f3] px-6 py-5">
                              <div className="space-y-4">
                                <div className="grid gap-3 sm:grid-cols-3">
                                  <div className="rounded-lg bg-white p-3 shadow-sm">
                                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#c9a84c]">主旨行</div>
                                    <p className="text-sm font-medium text-gray-900">{email.subject}</p>
                                  </div>
                                  <div className="rounded-lg bg-white p-3 shadow-sm">
                                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#c9a84c]">備用主旨</div>
                                    <p className="text-sm text-gray-700">{email.subjectAlt}</p>
                                  </div>
                                  <div className="rounded-lg bg-white p-3 shadow-sm">
                                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#c9a84c]">預覽文字</div>
                                    <p className="text-sm text-gray-600">{email.previewText}</p>
                                  </div>
                                </div>
                                <div className="rounded-lg bg-white p-4 shadow-sm">
                                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">正文</div>
                                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{email.body}</p>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="inline-block rounded-lg bg-[#c9a84c] px-5 py-2 text-sm font-semibold text-white">{email.cta}</span>
                                  <button onClick={() => setListExpandedIndex(null)} className="text-xs text-gray-400 hover:text-gray-600">收起</button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Block view (2-column grid) */}
          {viewMode === "block" && (
            <div className="grid grid-cols-1 gap-4 pb-8 md:grid-cols-2">
              {current.emails.map((email, index) => (
                <EmailCard
                  key={`${activeTab}-${index}`}
                  email={email}
                  index={index}
                  dayInfo={seqInfo[index]}
                  isRegenerating={regeneratingKey === `${activeTab}-${index}`}
                  onRegenerate={(instr) => handleRegenerate(index, instr)}
                  onCopy={email ? () => handleCopy(email) : undefined}
                  onUpdate={(updated) => handleUpdateEmail(index, updated)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Kit integration modal */}
      {kitOpen && kitEmails.length > 0 && (
        <KitIntegration
          emails={kitEmails}
          sequenceName={kitSeqName}
          onClose={() => setKitOpen(false)}
        />
      )}
    </>
  );
}
