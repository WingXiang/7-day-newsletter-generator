"use client";

import { useState, useEffect, useCallback } from "react";
import type { EmailObject } from "@/lib/email-prompts";
import { markdownToHtml, isPaidPlan } from "@/lib/kit-api";

interface KitIntegrationProps {
  emails: EmailObject[];
  sequenceName: string;
  onClose: () => void;
}

type Step = "api-key" | "verifying" | "confirm" | "creating" | "success" | "error";

interface AccountInfo {
  user: { email: string };
  account: { name: string; plan_type: string };
}

async function kitAction(body: Record<string, unknown>) {
  const res = await fetch("/api/kit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Error ${res.status}`);
  }
  return res.json();
}

export default function KitIntegration({ emails, sequenceName, onClose }: KitIntegrationProps) {
  const [step, setStep] = useState<Step>("api-key");
  const [apiKey, setApiKey] = useState("");
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [existingSeqCount, setExistingSeqCount] = useState(0);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [createdSeqId, setCreatedSeqId] = useState<number | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("kit-api-key");
    if (saved) setApiKey(saved);
  }, []);

  const verify = useCallback(async () => {
    if (!apiKey.trim()) return;
    setStep("verifying");
    setError("");
    try {
      // Verify account first
      const accData = await kitAction({ action: "verify", apiKey });
      setAccountInfo(accData);
      localStorage.setItem("kit-api-key", apiKey);

      // List sequences (non-blocking — free plans may not have access)
      try {
        const seqData = await kitAction({ action: "list-sequences", apiKey });
        setExistingSeqCount(seqData.sequences?.length ?? 0);
      } catch {
        // If listing fails (e.g. 403 on free plan), just default to unknown
        setExistingSeqCount(-1);
      }

      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "驗證失敗");
      setStep("error");
    }
  }, [apiKey]);

  const createInKit = useCallback(async () => {
    setStep("creating");
    setProgress({ current: 0, total: emails.length + 1 });

    try {
      // 1. Create sequence
      const { sequence } = await kitAction({
        action: "create-sequence",
        apiKey,
        name: sequenceName,
      });
      setCreatedSeqId(sequence.id);
      setProgress({ current: 1, total: emails.length + 1 });

      // 2. Create emails
      for (let i = 0; i < emails.length; i++) {
        const email = emails[i];
        await kitAction({
          action: "create-email",
          apiKey,
          sequenceId: sequence.id,
          params: {
            subject: email.subject,
            preview_text: email.previewText,
            content: markdownToHtml(email.body),
            delay_value: i === 0 ? 0 : 1,
            delay_unit: "days",
            position: i + 1,
            published: true,
          },
        });
        setProgress({ current: i + 2, total: emails.length + 1 });
      }

      setStep("success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "建立失敗";
      if (msg.includes("403")) {
        setError(`${msg}\n\n這通常表示你的 Kit 帳號方案不支援透過 API 建立序列。請確認：\n1. 你的方案是否為 Creator 以上\n2. API Key 是否為 V4 版本且有寫入權限`);
      } else {
        setError(msg);
      }
      setStep("error");
    }
  }, [apiKey, emails, sequenceName]);

  const isFree = accountInfo && !isPaidPlan(accountInfo.account.plan_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1a2e1a]">發布到 Kit</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ── Step: API Key ── */}
        {step === "api-key" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">請輸入你的 Kit API Key 來連接帳號。</p>
            <div className="rounded-lg bg-[#faf8f3] p-3 text-xs text-gray-600">
              <strong>如何取得 API Key：</strong><br />
              登入 Kit → Settings → Developer → API Keys → 複製 Key
            </div>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="貼上你的 Kit API Key"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20"
            />
            <button onClick={verify} disabled={!apiKey.trim()} className="w-full rounded-lg bg-[#1a2e1a] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2a4a2a] disabled:opacity-50">
              驗證並連接
            </button>
          </div>
        )}

        {/* ── Step: Verifying ── */}
        {step === "verifying" && (
          <div className="flex flex-col items-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#1a2e1a] border-t-[#c9a84c]" />
            <p className="mt-3 text-sm text-gray-600">正在驗證 API Key...</p>
          </div>
        )}

        {/* ── Step: Confirm ── */}
        {step === "confirm" && accountInfo && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-3">
              <p className="text-sm font-medium text-green-800">已連接成功</p>
              <p className="mt-1 text-xs text-green-600">
                帳號：{accountInfo.account.name}（{accountInfo.user.email}）<br />
                方案：{accountInfo.account.plan_type}
              </p>
            </div>

            {isFree && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <p className="text-sm font-medium text-amber-800">免費版提醒</p>
                <p className="mt-1 text-xs text-amber-700">
                  免費版帳號可建立 <strong>1 個 Sequence</strong>。
                  {existingSeqCount >= 0
                    ? <>你目前已有 {existingSeqCount} 個 Sequence。{existingSeqCount > 0 && " 建立新的可能會受到限制。"}</>
                    : ""
                  }
                  若建立失敗，可能需要升級到 <a href="https://app.kit.com/account/billing" target="_blank" rel="noopener noreferrer" className="underline font-medium">Creator 方案</a>，或改用匯出方式手動建立。
                </p>
              </div>
            )}

            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm text-gray-700">
                即將建立：<strong>{sequenceName}</strong>（{emails.length} 封信）
              </p>
              <p className="mt-1 text-xs text-gray-500">
                每封信間隔 1 天，以草稿狀態建立，不會自動發送。
              </p>
            </div>

            <button onClick={createInKit} className="w-full rounded-lg bg-[#1a2e1a] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2a4a2a]">
              確認建立序列
            </button>
          </div>
        )}

        {/* ── Step: Creating ── */}
        {step === "creating" && (
          <div className="flex flex-col items-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#1a2e1a] border-t-[#c9a84c]" />
            <p className="mt-3 text-sm text-gray-600">正在建立序列...</p>
            <div className="mt-3 h-2 w-48 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-[#c9a84c] transition-all duration-500" style={{ width: `${progress.total ? (progress.current / progress.total) * 100 : 0}%` }} />
            </div>
            <p className="mt-2 text-xs text-gray-400">{progress.current} / {progress.total}</p>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === "success" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-lg font-bold text-green-800">序列建立成功！</p>
              <p className="mt-1 text-sm text-green-600">{emails.length} 封信已填入 Kit，目前為草稿狀態。</p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-bold text-[#1a2e1a]">接下來怎麼做？</h3>
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-bold text-white">1</span>
                  <span>登入 <a href="https://app.kit.com" target="_blank" rel="noopener noreferrer" className="text-[#c9a84c] underline">Kit 後台</a>，點選左側選單的 <strong>Send → Sequences</strong></span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-bold text-white">2</span>
                  <span>找到剛建立的「<strong>{sequenceName}</strong>」序列</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-bold text-white">3</span>
                  <span>點進去檢查每封信的內容，確認排版和文字無誤</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-bold text-white">4</span>
                  <span>確認無誤後，回到序列頁面點擊 <strong>Activate</strong> 啟用序列</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-bold text-white">5</span>
                  <span>建立一個 <strong>Form</strong>（表單）或 <strong>Landing Page</strong>（著陸頁），在設定中選擇「加入此序列」</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-bold text-white">6</span>
                  <span>將表單嵌入你的網站，或分享著陸頁連結，新訂閱者就會自動收到序列信件</span>
                </li>
              </ol>
            </div>

            {createdSeqId && (
              <a
                href={`https://app.kit.com/sequences/${createdSeqId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-lg bg-[#1a2e1a] py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#2a4a2a]"
              >
                前往 Kit 查看序列
              </a>
            )}

            <button onClick={onClose} className="w-full rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
              關閉
            </button>
          </div>
        )}

        {/* ── Step: Error ── */}
        {step === "error" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-sm font-medium text-red-800">發生錯誤</p>
              <p className="mt-1 whitespace-pre-line text-xs text-red-600">{error}</p>
            </div>

            {error.includes("403") && (
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-2 text-sm font-bold text-[#1a2e1a]">替代方案：手動建立序列</h3>
                <ol className="space-y-2 text-xs text-gray-700">
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-[10px] font-bold text-white">1</span>
                    <span>先關閉此視窗，用「匯出 DOCX」或「匯出 TXT」下載文案</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-[10px] font-bold text-white">2</span>
                    <span>登入 <a href="https://app.kit.com" target="_blank" rel="noopener noreferrer" className="text-[#c9a84c] underline">Kit 後台</a> → Send → Sequences → New Sequence</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-[10px] font-bold text-white">3</span>
                    <span>逐封新增 Email，從下載的檔案複製主旨和正文貼入</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-[10px] font-bold text-white">4</span>
                    <span>設定每封信間隔 1 天，確認後啟用序列</span>
                  </li>
                </ol>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => setStep("api-key")} className="flex-1 rounded-lg bg-[#1a2e1a] py-2.5 text-sm font-medium text-white hover:bg-[#2a4a2a]">
                重試
              </button>
              <button onClick={onClose} className="flex-1 rounded-lg border border-gray-200 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                關閉
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
