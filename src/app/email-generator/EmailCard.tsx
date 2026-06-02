"use client";

import { useState } from "react";
import type { EmailObject, SequenceDay } from "@/lib/email-prompts";

interface EmailCardProps {
  email: EmailObject | null;
  index: number;
  dayInfo: SequenceDay;
  isRegenerating: boolean;
  onRegenerate: (instructions?: string) => void;
  onCopy?: () => void;
  onUpdate?: (updated: EmailObject) => void;
}

export default function EmailCard({
  email, index, dayInfo, isRegenerating, onRegenerate, onCopy, onUpdate,
}: EmailCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCta, setEditCta] = useState("");
  const [showRegenInput, setShowRegenInput] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState("");
  const [copied, setCopied] = useState(false);

  const startEditing = () => {
    if (!email) return;
    setEditSubject(email.subject);
    setEditBody(email.body);
    setEditCta(email.cta);
    setIsEditing(true);
  };

  const saveEditing = () => {
    if (!email || !onUpdate) return;
    onUpdate({ ...email, subject: editSubject, body: editBody, cta: editCta });
    setIsEditing(false);
  };

  const handleCopy = () => {
    if (onCopy) { onCopy(); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  const handleRegenerate = () => {
    onRegenerate(regenInstructions || undefined);
    setShowRegenInput(false);
    setRegenInstructions("");
  };

  // Empty / failed state
  if (!email) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white/50 p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-500">{index + 1}</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-500">Day {dayInfo.day} — {dayInfo.theme}</p>
            <p className="text-xs text-gray-400">尚未產生</p>
          </div>
          <button onClick={() => onRegenerate()} disabled={isRegenerating} className="rounded-lg bg-[#1a2e1a] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2a4a2a] disabled:opacity-50">
            {isRegenerating ? "生成中..." : "產生此封"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-semibold text-white">{index + 1}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-[#f5f0e8] px-2 py-0.5 text-xs font-medium text-[#1a2e1a]">Day {dayInfo.day}</span>
            <span className="text-xs text-gray-400">{dayInfo.theme}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-medium text-gray-900">{email.subject}</p>
        </div>
        <svg className={`mt-0.5 h-4 w-4 shrink-0 text-gray-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded */}
      {expanded && (
        <div className="flex-1 border-t border-gray-100 px-4 pb-4">
          {isEditing ? (
            /* ── Edit mode ── */
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#c9a84c]">主旨行</label>
                <input type="text" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#c9a84c]">正文</label>
                <textarea rows={12} value={editBody} onChange={(e) => setEditBody(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#c9a84c]">CTA 按鈕文字</label>
                <input type="text" value={editCta} onChange={(e) => setEditCta(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20" />
              </div>
              <div className="flex gap-2">
                <button onClick={saveEditing} className="rounded-lg bg-[#1a2e1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4a2a]">儲存</button>
                <button onClick={() => setIsEditing(false)} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">取消</button>
              </div>
            </div>
          ) : (
            /* ── View mode ── */
            <>
              <div className="mt-4 rounded-lg bg-[#faf8f3] p-4">
                <div className="mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#c9a84c]">主旨行</span>
                  <p className="mt-1 text-sm font-medium text-gray-900">{email.subject}</p>
                </div>
                <div className="mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#c9a84c]">備用主旨（A/B）</span>
                  <p className="mt-1 text-sm text-gray-700">{email.subjectAlt}</p>
                </div>
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#c9a84c]">預覽文字</span>
                  <p className="mt-1 text-sm text-gray-600">{email.previewText}</p>
                </div>
              </div>

              <div className="mt-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">正文</span>
                <div className="mt-2 rounded-lg border border-gray-200 bg-white p-5">
                  <div className="max-w-none whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{email.body}</div>
                </div>
              </div>

              <div className="mt-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">CTA 按鈕</span>
                <div className="mt-2">
                  <span className="inline-block rounded-lg bg-[#c9a84c] px-6 py-2.5 text-sm font-semibold text-white shadow-sm">{email.cta}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                <button onClick={startEditing} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">編輯</button>
                <button onClick={handleCopy} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">{copied ? "已複製！" : "複製"}</button>
                <button onClick={() => setShowRegenInput(!showRegenInput)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-50">重新生成</button>
              </div>

              {showRegenInput && (
                <div className="mt-3 rounded-lg border border-[#c9a84c]/30 bg-[#faf8f3] p-4">
                  <label className="mb-1.5 block text-xs font-medium text-[#1a2e1a]">額外指示（選填）</label>
                  <textarea rows={2} value={regenInstructions} onChange={(e) => setRegenInstructions(e.target.value)} placeholder="例：語氣更幽默、強調這個痛點..." className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20" />
                  <div className="mt-2 flex gap-2">
                    <button onClick={handleRegenerate} disabled={isRegenerating} className="rounded-lg bg-[#1a2e1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4a2a] disabled:opacity-50">{isRegenerating ? "生成中..." : "確認"}</button>
                    <button onClick={() => { setShowRegenInput(false); setRegenInstructions(""); }} className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100">取消</button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {isRegenerating && (
        <div className="border-t border-gray-100 bg-[#faf8f3] px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#c9a84c] border-t-transparent" />
            <span className="text-sm text-[#1a2e1a]">正在重新生成...</span>
          </div>
        </div>
      )}
    </div>
  );
}
