"use client";

import { useState } from "react";
import type { ArticleFormData, ArticleEntry } from "@/lib/email-prompts";
import { ARTICLE_EXAMPLE_DATA } from "@/lib/email-prompts";

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20 transition-colors";
const labelCls = "mb-1 block text-sm font-medium text-[#1a2e1a]";
const textareaCls =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20 transition-colors resize-none";

const MIN_ARTICLES = 3;
const MAX_ARTICLES = 7;

const DEFAULT_ARTICLE: ArticleEntry = { type: "text", value: "" };

function makeDefault(): ArticleFormData {
  return {
    emailType: "trust",
    articles: [
      { type: "text", value: "" },
      { type: "text", value: "" },
      { type: "text", value: "" },
    ],
  };
}

export default function ArticleForm({ onSubmit }: { onSubmit: (d: ArticleFormData) => void }) {
  const [fd, setFd] = useState<ArticleFormData>(makeDefault());
  const [inputMode, setInputMode] = useState<"text" | "url">("text");

  const setArticle = (index: number, patch: Partial<ArticleEntry>) => {
    setFd((prev) => {
      const next = [...prev.articles];
      next[index] = { ...next[index], ...patch };
      return { ...prev, articles: next };
    });
  };

  const addArticle = () => {
    if (fd.articles.length >= MAX_ARTICLES) return;
    setFd((prev) => ({
      ...prev,
      articles: [...prev.articles, { ...DEFAULT_ARTICLE, type: inputMode }],
    }));
  };

  const removeArticle = (index: number) => {
    if (fd.articles.length <= 1) return;
    setFd((prev) => ({
      ...prev,
      articles: prev.articles.filter((_, i) => i !== index),
    }));
  };

  const switchInputMode = (mode: "text" | "url") => {
    setInputMode(mode);
    setFd((prev) => ({
      ...prev,
      articles: prev.articles.map((a) => ({ type: mode, value: "" })),
    }));
  };

  const loadExample = () => {
    setInputMode("text");
    setFd({ ...ARTICLE_EXAMPLE_DATA });
  };

  const validArticleCount = fd.articles.filter((a) => a.value.trim().length > 0).length;
  const canSubmit = validArticleCount >= MIN_ARTICLES;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const filtered = { ...fd, articles: fd.articles.filter((a) => a.value.trim().length > 0) };
    onSubmit(filtered);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          上傳過往文章，AI 會分析你的品牌風格並自動產生 7 封信
        </p>
        <button
          type="button"
          onClick={loadExample}
          className="rounded-md bg-[#f5f0e8] px-3 py-1.5 text-xs font-medium text-[#1a2e1a] hover:bg-[#ebe5d8] transition-colors"
        >
          填入範例
        </button>
      </div>

      {/* Section 1: Article Sources */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#1a2e1a]">文章來源</h2>
          <span className={`text-xs font-medium ${validArticleCount >= MIN_ARTICLES ? "text-green-600" : "text-amber-600"}`}>
            已新增 {validArticleCount} / {MAX_ARTICLES} 篇（最少 {MIN_ARTICLES} 篇）
          </span>
        </div>

        {/* Mode toggle */}
        <div className="mb-5 flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 w-fit">
          <button
            type="button"
            onClick={() => switchInputMode("text")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              inputMode === "text"
                ? "bg-white text-[#1a2e1a] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            貼上全文
          </button>
          <button
            type="button"
            onClick={() => switchInputMode("url")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              inputMode === "url"
                ? "bg-white text-[#1a2e1a] shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            提供網址
          </button>
        </div>

        {inputMode === "url" && (
          <p className="mb-4 text-xs text-gray-400">
            請確認網址為公開頁面（不需登入）。伺服器會自動抓取內容，如抓取失敗可改用「貼上全文」。
          </p>
        )}

        {/* Article inputs */}
        <div className="space-y-3">
          {fd.articles.map((article, index) => (
            <div key={index} className="flex items-start gap-2">
              <div className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a2e1a] text-xs font-semibold text-white">
                {index + 1}
              </div>
              {inputMode === "text" ? (
                <textarea
                  rows={6}
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
              {fd.articles.length > 1 && (
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

        {fd.articles.length < MAX_ARTICLES && (
          <button
            type="button"
            onClick={addArticle}
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-[#c9a84c] hover:text-[#1a2e1a] transition-colors"
          >
            <span className="text-base leading-none">+</span>
            新增文章
          </button>
        )}
      </div>

      {/* Section 2: Email Type */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-[#1a2e1a]">信件類型</h2>
        <div className="grid grid-cols-2 gap-3">
          {(["trust", "sales"] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setFd((prev) => ({ ...prev, emailType: type }))}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                fd.emailType === type
                  ? "border-[#c9a84c] bg-[#faf8f3]"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <div className="mb-1 font-semibold text-[#1a2e1a]">
                {type === "trust" ? "信任信" : "銷售信"}
              </div>
              <div className="text-xs text-gray-500">
                {type === "trust"
                  ? "7 天建立品牌信任，培養讀者關係"
                  : "7 天引導讀者認識並購買產品"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Section 3: Optional Supplement */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <h2 className="text-base font-semibold text-[#1a2e1a]">補充資訊</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">選填</span>
        </div>
        <p className="mb-5 text-xs text-gray-400">
          AI 會從文章中自動推斷品牌資訊，這裡的補充內容會優先採用。
        </p>

        <div className="space-y-4">
          <div>
            <label className={labelCls}>品牌名稱</label>
            <input
              type="text"
              value={fd.brandName || ""}
              onChange={(e) => setFd((prev) => ({ ...prev, brandName: e.target.value }))}
              placeholder="若留空，AI 會從文章中自行推斷"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>目標受眾</label>
            <input
              type="text"
              value={fd.targetAudience || ""}
              onChange={(e) => setFd((prev) => ({ ...prev, targetAudience: e.target.value }))}
              placeholder="你的讀者是誰？他們有什麼特徵？"
              className={inputCls}
            />
          </div>

          {fd.emailType === "trust" && (
            <>
              <div>
                <label className={labelCls}>免費資源 / 鉛磁鐵</label>
                <input
                  type="text"
                  value={fd.freeResource || ""}
                  onChange={(e) => setFd((prev) => ({ ...prev, freeResource: e.target.value }))}
                  placeholder="例：免費 PDF 指南、迷你課程"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>社群平台連結</label>
                <input
                  type="text"
                  value={fd.socialLinks || ""}
                  onChange={(e) => setFd((prev) => ({ ...prev, socialLinks: e.target.value }))}
                  placeholder="例：IG @brand、Facebook 粉專連結"
                  className={inputCls}
                />
              </div>
            </>
          )}

          {fd.emailType === "sales" && (
            <>
              <div>
                <label className={labelCls}>產品名稱</label>
                <input
                  type="text"
                  value={fd.productName || ""}
                  onChange={(e) => setFd((prev) => ({ ...prev, productName: e.target.value }))}
                  placeholder="你要銷售的產品或課程名稱"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>產品價格</label>
                <input
                  type="text"
                  value={fd.price || ""}
                  onChange={(e) => setFd((prev) => ({ ...prev, price: e.target.value }))}
                  placeholder="例：NT$2,980"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>優惠折扣碼</label>
                  <input
                    type="text"
                    value={fd.discountCode || ""}
                    onChange={(e) => setFd((prev) => ({ ...prev, discountCode: e.target.value }))}
                    placeholder="例：EARLYBIRD"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>截止日期</label>
                  <input
                    type="text"
                    value={fd.discountDeadline || ""}
                    onChange={(e) => setFd((prev) => ({ ...prev, discountDeadline: e.target.value }))}
                    placeholder="例：2026-07-31"
                    className={inputCls}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Submit */}
      <div className="flex flex-col items-center gap-2 pb-8">
        {!canSubmit && (
          <p className="text-sm text-amber-600">
            請至少填入 {MIN_ARTICLES} 篇文章後才能繼續
          </p>
        )}
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-xl bg-[#1a2e1a] px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#2a4a2a] disabled:cursor-not-allowed disabled:opacity-40"
        >
          讀取文章並產生 7 封{fd.emailType === "trust" ? "信任信" : "銷售信"}
        </button>
      </div>
    </form>
  );
}
