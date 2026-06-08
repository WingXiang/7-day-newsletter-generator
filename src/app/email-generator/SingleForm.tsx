"use client";

import { useState } from "react";
import type { SingleFormData, ArticleEntry, ToneStyle } from "@/lib/email-prompts";
import { SINGLE_LAYOUTS, SINGLE_EXAMPLE_DATA, TONE_LABELS } from "@/lib/email-prompts";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20 transition-colors";
const labelCls = "mb-1 block text-sm font-medium text-[#1a2e1a]";
const textareaCls =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20 transition-colors resize-none";

const MAX_ARTICLES = 5;
const DEFAULT_ARTICLE: ArticleEntry = { type: "text", value: "" };

const TONE_OPTIONS: ToneStyle[] = ["friendly", "professional", "humorous", "inspirational", "custom"];

/** AI 自動填寫按鈕（根據品牌主題 / 本期主題 / 已貼入文章推斷欄位內容） */
function AutoFillBtn({
  fieldName,
  brandTheme,
  issueTopic,
  articleTexts,
  onResult,
}: {
  fieldName: string;
  brandTheme: string;
  issueTopic: string;
  articleTexts: string[];
  onResult: (v: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [errorTip, setErrorTip] = useState<string | null>(null);
  const disabled = !brandTheme.trim() && !issueTopic.trim() && articleTexts.length === 0;

  const handleClick = async () => {
    setLoading(true);
    setErrorTip(null);
    try {
      const res = await fetch("/api/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldName, sequenceType: "single", brandTheme, issueTopic, articleTexts }),
      });
      if (res.ok) {
        const { value } = (await res.json()) as { value: string };
        onResult(value);
      } else {
        const body = (await res.json().catch(() => ({}))) as { title?: string };
        setErrorTip(body.title ?? "AI 填寫失敗，可手動輸入");
        setTimeout(() => setErrorTip(null), 4000);
      }
    } catch {
      setErrorTip("網路異常，請手動輸入");
      setTimeout(() => setErrorTip(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {errorTip && <span className="text-[11px] text-red-600">{errorTip}</span>}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || disabled}
        title={disabled ? "請先填寫品牌主題或本期主題" : ""}
        className="rounded-md bg-[#f5f0e8] px-2.5 py-1 text-xs font-medium text-[#1a2e1a] hover:bg-[#ebe5d8] disabled:opacity-50 transition-colors"
      >
        {loading ? "生成中..." : "AI 自動填寫"}
      </button>
    </div>
  );
}

function makeDefault(): SingleFormData {
  return {
    layout: "viewpoint",
    inputMode: "topic",
    brandTheme: "",
    issueTopic: "",
    articles: [
      { type: "text", value: "" },
      { type: "text", value: "" },
    ],
    toneStyle: "friendly",
    customTone: "",
  };
}

export default function SingleForm({ onSubmit }: { onSubmit: (d: SingleFormData) => void }) {
  const [fd, setFd] = useState<SingleFormData>(makeDefault());
  // article entry type (url vs text) — shared across all entries in article mode
  const [articleType, setArticleType] = useState<"text" | "url">("text");
  const articles = fd.articles ?? [];

  const setArticle = (index: number, patch: Partial<ArticleEntry>) => {
    setFd((prev) => {
      const next = [...(prev.articles ?? [])];
      next[index] = { ...next[index], ...patch };
      return { ...prev, articles: next };
    });
  };

  const addArticle = () => {
    if (articles.length >= MAX_ARTICLES) return;
    setFd((prev) => ({
      ...prev,
      articles: [...(prev.articles ?? []), { ...DEFAULT_ARTICLE, type: articleType }],
    }));
  };

  const removeArticle = (index: number) => {
    setFd((prev) => {
      const list = prev.articles ?? [];
      if (list.length <= 1) return prev;
      return { ...prev, articles: list.filter((_, i) => i !== index) };
    });
  };

  const switchArticleType = (t: "text" | "url") => {
    setArticleType(t);
    setFd((prev) => ({
      ...prev,
      articles: (prev.articles ?? []).map(() => ({ type: t, value: "" })),
    }));
  };

  const loadExample = () => {
    setFd({ ...makeDefault(), ...SINGLE_EXAMPLE_DATA });
    setArticleType("text");
  };

  // Article texts available for AI auto-fill (text-mode only)
  const articleTextsForAI =
    fd.inputMode === "article" && articleType === "text"
      ? articles.map((a) => a.value.trim()).filter(Boolean)
      : [];

  const validArticleCount = articles.filter((a) => a.value.trim().length > 0).length;
  const canSubmit =
    fd.issueTopic.trim().length > 0 &&
    (fd.inputMode === "topic" ? fd.brandTheme.trim().length > 0 : validArticleCount >= 1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const payload: SingleFormData =
      fd.inputMode === "article"
        ? { ...fd, articles: articles.filter((a) => a.value.trim().length > 0) }
        : { ...fd, articles: undefined };
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">針對品牌主題與本期主題，產生單篇週電子報</p>
        <button
          type="button"
          onClick={loadExample}
          className="rounded-md bg-[#f5f0e8] px-3 py-1.5 text-xs font-medium text-[#1a2e1a] hover:bg-[#ebe5d8] transition-colors"
        >
          填入範例
        </button>
      </div>

      {/* Section 1: Layout */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-[#1a2e1a]">週報版型</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SINGLE_LAYOUTS.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => setFd((prev) => ({ ...prev, layout: l.key }))}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                fd.layout === l.key
                  ? "border-[#c9a84c] bg-[#faf8f3]"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="mb-1 font-semibold text-[#1a2e1a]">{l.label}</div>
              <div className="text-xs text-gray-500">{l.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Section 2: Input mode + core topic */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-[#1a2e1a]">內容來源</h2>

        {/* Mode toggle */}
        <div className="mb-5 flex w-fit items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            onClick={() => setFd((prev) => ({ ...prev, inputMode: "topic" }))}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              fd.inputMode === "topic" ? "bg-white text-[#1a2e1a] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            直接填主題
          </button>
          <button
            type="button"
            onClick={() => setFd((prev) => ({ ...prev, inputMode: "article" }))}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              fd.inputMode === "article" ? "bg-white text-[#1a2e1a] shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            沿用舊文風格
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>
              品牌主題 / 定位
              {fd.inputMode === "topic" ? (
                <span className="ml-1 text-red-500">*</span>
              ) : (
                <span className="ml-1 text-xs font-normal text-gray-400">（選填，AI 會從文章推斷）</span>
              )}
            </label>
            <input
              type="text"
              value={fd.brandTheme}
              onChange={(e) => setFd((prev) => ({ ...prev, brandTheme: e.target.value }))}
              placeholder="例：學習羅盤｜陪上班族用對方法持續學習"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              本期主題<span className="ml-1 text-red-500">*</span>
            </label>
            <input
              type="text"
              value={fd.issueTopic}
              onChange={(e) => setFd((prev) => ({ ...prev, issueTopic: e.target.value }))}
              placeholder="這一期週報想談的具體主題"
              className={inputCls}
            />
          </div>

          {/* Article inputs (article mode only) */}
          {fd.inputMode === "article" && (
            <div className="rounded-lg border border-dashed border-gray-300 bg-[#faf8f3]/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[#1a2e1a]">過往文章（供 AI 模仿風格）</span>
                <span className={`text-xs font-medium ${validArticleCount >= 1 ? "text-green-600" : "text-amber-600"}`}>
                  已新增 {validArticleCount} / {MAX_ARTICLES} 篇
                </span>
              </div>

              {/* Article type toggle */}
              <div className="mb-4 flex w-fit items-center gap-1 rounded-lg border border-gray-200 bg-white p-1">
                <button
                  type="button"
                  onClick={() => switchArticleType("text")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    articleType === "text" ? "bg-[#1a2e1a] text-white" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  貼上全文
                </button>
                <button
                  type="button"
                  onClick={() => switchArticleType("url")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    articleType === "url" ? "bg-[#1a2e1a] text-white" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  提供網址
                </button>
              </div>

              {articleType === "url" && (
                <p className="mb-3 text-xs text-gray-400">
                  請確認網址為公開頁面（不需登入）。如抓取失敗可改用「貼上全文」。
                </p>
              )}

              <div className="space-y-3">
                {articles.map((article, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <div className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-semibold text-white">
                      {index + 1}
                    </div>
                    {articleType === "text" ? (
                      <textarea
                        rows={5}
                        value={article.value}
                        onChange={(e) => setArticle(index, { value: e.target.value })}
                        placeholder={`貼入第 ${index + 1} 篇文章的完整內容…`}
                        className={`${textareaCls} flex-1`}
                      />
                    ) : (
                      <input
                        type="url"
                        value={article.value}
                        onChange={(e) => setArticle(index, { value: e.target.value })}
                        placeholder={`https://example.com/article-${index + 1}`}
                        className={`${inputCls} flex-1`}
                      />
                    )}
                    {articles.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeArticle(index)}
                        className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        title="移除此篇"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {articles.length < MAX_ARTICLES && (
                <button
                  type="button"
                  onClick={addArticle}
                  className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-[#c9a84c] hover:text-[#1a2e1a] transition-colors"
                >
                  <span className="text-base leading-none">+</span>
                  新增文章
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Optional supplement */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-base font-semibold text-[#1a2e1a]">補充資訊</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">選填</span>
        </div>
        <p className="mb-5 text-xs text-gray-400">填得越具體，AI 產出越精準。也可以用「AI 自動填寫」由 AI 推斷。</p>

        <div className="space-y-4">
          <div>
            <div className="flex items-center">
              <label className={labelCls}>目標受眾</label>
              <AutoFillBtn
                fieldName="targetAudience"
                brandTheme={fd.brandTheme}
                issueTopic={fd.issueTopic}
                articleTexts={articleTextsForAI}
                onResult={(v) => setFd((prev) => ({ ...prev, targetAudience: v }))}
              />
            </div>
            <input
              type="text"
              value={fd.targetAudience || ""}
              onChange={(e) => setFd((prev) => ({ ...prev, targetAudience: e.target.value }))}
              placeholder="你的讀者是誰？他們關心什麼？"
              className={inputCls}
            />
          </div>

          <div>
            <div className="flex items-center">
              <label className={labelCls}>想帶到的重點</label>
              <AutoFillBtn
                fieldName="keyPoints"
                brandTheme={fd.brandTheme}
                issueTopic={fd.issueTopic}
                articleTexts={articleTextsForAI}
                onResult={(v) => setFd((prev) => ({ ...prev, keyPoints: v }))}
              />
            </div>
            <textarea
              rows={2}
              value={fd.keyPoints || ""}
              onChange={(e) => setFd((prev) => ({ ...prev, keyPoints: e.target.value }))}
              placeholder="這期一定要讓讀者記住的 1-2 個重點"
              className={textareaCls}
            />
          </div>

          <div>
            <div className="flex items-center">
              <label className={labelCls}>CTA 目標</label>
              <AutoFillBtn
                fieldName="ctaGoal"
                brandTheme={fd.brandTheme}
                issueTopic={fd.issueTopic}
                articleTexts={articleTextsForAI}
                onResult={(v) => setFd((prev) => ({ ...prev, ctaGoal: v }))}
              />
            </div>
            <input
              type="text"
              value={fd.ctaGoal || ""}
              onChange={(e) => setFd((prev) => ({ ...prev, ctaGoal: e.target.value }))}
              placeholder="例：引導報名課程、追蹤社群、回信分享"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>語氣風格</label>
            <select
              value={fd.toneStyle}
              onChange={(e) => setFd((prev) => ({ ...prev, toneStyle: e.target.value as ToneStyle }))}
              className={inputCls}
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TONE_LABELS[t]}
                </option>
              ))}
            </select>
            {fd.toneStyle === "custom" && (
              <input
                type="text"
                value={fd.customTone || ""}
                onChange={(e) => setFd((prev) => ({ ...prev, customTone: e.target.value }))}
                placeholder="描述你想要的語氣，例：理性冷靜、像跟好友聊天"
                className={`${inputCls} mt-2`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-col items-center gap-2 pb-8">
        {!canSubmit && (
          <p className="text-sm text-amber-600">
            {fd.issueTopic.trim().length === 0
              ? "請先填寫「本期主題」"
              : fd.inputMode === "topic"
              ? "請填寫「品牌主題 / 定位」"
              : "請至少填入 1 篇過往文章"}
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-[#1a2e1a] px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2a4a2a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          產生單篇週報
        </button>
      </div>
    </form>
  );
}
