"use client";

import { useState, useEffect, useCallback } from "react";
import type { EmailObject } from "@/lib/email-prompts";
import { textToEditableHtml } from "@/lib/kit-api";

interface KitBroadcastProps {
  email: EmailObject;
  onClose: () => void;
}

type Step = "api-key" | "verifying" | "confirm" | "creating" | "success" | "error";

interface AccountInfo {
  user: { email: string };
  account: { name: string; plan_type: string };
}

const KIT_BROADCASTS_URL = "https://app.kit.com/broadcasts";

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

export default function KitBroadcast({ email, onClose }: KitBroadcastProps) {
  const [step, setStep] = useState<Step>("api-key");
  const [apiKey, setApiKey] = useState("");
  const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("kit-api-key");
    if (saved) setApiKey(saved);
  }, []);

  const verify = useCallback(async () => {
    if (!apiKey.trim()) return;
    setStep("verifying");
    setError("");
    try {
      const accData = await kitAction({ action: "verify", apiKey });
      setAccountInfo(accData);
      localStorage.setItem("kit-api-key", apiKey);
      setStep("confirm");
    } catch (err) {
      setError(err instanceof Error ? err.message : "驗證失敗");
      setStep("error");
    }
  }, [apiKey]);

  const create = useCallback(async () => {
    setStep("creating");
    try {
      await kitAction({
        action: "create-broadcast",
        apiKey,
        params: {
          subject: email.subject,
          preview_text: email.previewText,
          content: textToEditableHtml(email.body),
          description: email.subject,
        },
      });
      // Best-effort: jump straight to the Broadcasts dashboard so the user can verify.
      // (May be blocked by popup blockers — the success screen has a reliable button too.)
      try {
        window.open(KIT_BROADCASTS_URL, "_blank", "noopener,noreferrer");
      } catch {
        /* ignore */
      }
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "建立失敗");
      setStep("error");
    }
  }, [apiKey, email]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1a2e1a]">發布到 Kit（Broadcast）</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* ── Step: API Key ── */}
        {step === "api-key" && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">請輸入你的 Kit API Key 來連接帳號。單篇週報會以 <strong>Broadcast 草稿</strong>建立，免費帳號也可使用。</p>
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

            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-sm text-gray-700">
                即將建立 Broadcast 草稿：<br />
                <strong className="text-[#1a2e1a]">{email.subject}</strong>
              </p>
              <p className="mt-2 text-xs text-gray-500">
                以<strong>草稿</strong>狀態建立，不會自動發送。建立後可直接跳到 Kit 後台確認與寄送。
              </p>
            </div>

            <button onClick={create} className="w-full rounded-lg bg-[#1a2e1a] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#2a4a2a]">
              確認建立草稿
            </button>
          </div>
        )}

        {/* ── Step: Creating ── */}
        {step === "creating" && (
          <div className="flex flex-col items-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#1a2e1a] border-t-[#c9a84c]" />
            <p className="mt-3 text-sm text-gray-600">正在建立 Broadcast 草稿...</p>
          </div>
        )}

        {/* ── Step: Success ── */}
        {step === "success" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-center">
              <p className="text-lg font-bold text-green-800">Broadcast 草稿建立成功！</p>
              <p className="mt-1 text-sm text-green-600">已自動為你開啟 Kit Broadcasts 頁面，可立即確認。</p>
            </div>

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-3 text-sm font-bold text-[#1a2e1a]">接下來怎麼做？</h3>
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-bold text-white">1</span>
                  <span>在 <strong>Broadcasts</strong> 列表最上方找到剛建立的草稿</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-bold text-white">2</span>
                  <span>點進去檢查主旨與內容排版，確認無誤</span>
                </li>
                <li className="flex gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-bold text-white">3</span>
                  <span>選擇收件對象，按 <strong>Send / Schedule</strong> 寄出或排程</span>
                </li>
              </ol>
            </div>

            <a
              href={KIT_BROADCASTS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full rounded-lg bg-[#1a2e1a] py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#2a4a2a]"
            >
              前往 Kit Broadcasts 確認
            </a>

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

            <div className="rounded-lg border border-gray-200 p-4">
              <h3 className="mb-2 text-sm font-bold text-[#1a2e1a]">替代方案</h3>
              <p className="text-xs text-gray-700">
                先關閉此視窗，用「匯出 DOCX / TXT」下載內容，再到 <a href={KIT_BROADCASTS_URL} target="_blank" rel="noopener noreferrer" className="text-[#c9a84c] underline">Kit Broadcasts</a> 手動新增 Broadcast 並貼上。
              </p>
            </div>

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
