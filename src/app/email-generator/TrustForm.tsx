"use client";

import { useState, useCallback } from "react";
import type { TrustFormData, ToneStyle } from "@/lib/email-prompts";
import { TRUST_FIELD_HINTS, TONE_LABELS, buildTrustBasePrompt, TRUST_EXAMPLE_DATA } from "@/lib/email-prompts";

const TONE_OPTIONS: { value: ToneStyle; label: string; desc: string }[] = [
  { value: "friendly", label: "親切友善", desc: "像朋友聊天一樣" },
  { value: "professional", label: "專業權威", desc: "展現專業知識" },
  { value: "humorous", label: "幽默活潑", desc: "輕鬆有趣的風格" },
  { value: "inspirational", label: "激勵人心", desc: "鼓舞讀者行動" },
  { value: "custom", label: "自訂", desc: "輸入你想要的語氣" },
];

const STEPS = [
  { title: "基本資訊", desc: "填寫品牌基本資料" },
  { title: "內容方向", desc: "定義主題與受眾" },
  { title: "風格設定", desc: "語氣與寫作風格" },
  { title: "確認提示詞", desc: "預覽並編輯提示詞" },
];

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20 transition-colors";
const labelCls = "mb-1 block text-sm font-medium text-[#1a2e1a]";
const whyCls = "mb-2 block text-xs text-gray-400";

const DEFAULT_DATA: TrustFormData = {
  brandName: "", brandStory: "", freeResource: "",
  coreTopics: ["", "", ""], targetAudience: "", goals: "",
  coreMessage: "", subscriberFAQ: "", toneStyle: "friendly",
  customTone: "", pastContentUrls: "", styleAnalysis: "",
  uniqueValueProp: "", socialLinks: "",
};

function AutoFillBtn({ fieldName, currentData, onResult }: {
  fieldName: string; currentData: Record<string, unknown>; onResult: (v: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [errorTip, setErrorTip] = useState<string | null>(null);
  const handleClick = async () => {
    setLoading(true);
    setErrorTip(null);
    try {
      const res = await fetch("/api/auto-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fieldName, sequenceType: "trust", currentData }),
      });
      if (res.ok) {
        const { value } = await res.json();
        onResult(value);
      } else {
        const body = await res.json().catch(() => ({}));
        // Use server-provided friendly title if available
        const tip = body.title ?? "AI 填寫失敗，可手動輸入";
        setErrorTip(tip);
        // Auto-clear after 4s
        setTimeout(() => setErrorTip(null), 4000);
      }
    } catch {
      setErrorTip("網路異常，請手動輸入");
      setTimeout(() => setErrorTip(null), 4000);
    } finally { setLoading(false); }
  };
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {errorTip && <span className="text-[11px] text-red-600">{errorTip}</span>}
      <button type="button" onClick={handleClick} disabled={loading}
        className="rounded-md bg-[#f5f0e8] px-2.5 py-1 text-xs font-medium text-[#1a2e1a] hover:bg-[#ebe5d8] disabled:opacity-50 transition-colors">
        {loading ? "生成中..." : "AI 自動填寫"}
      </button>
    </div>
  );
}

export default function TrustForm({ onSubmit }: { onSubmit: (d: TrustFormData) => void }) {
  const [step, setStep] = useState(0);
  const [fd, setFd] = useState<TrustFormData>({ ...DEFAULT_DATA });
  const [promptText, setPromptText] = useState("");
  const [analyzingStyle, setAnalyzingStyle] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<{ title: string; action: string; code?: string } | null>(null);

  const set = useCallback(<K extends keyof TrustFormData>(key: K, val: TrustFormData[K]) => {
    setFd(prev => ({ ...prev, [key]: val }));
  }, []);

  const setTopic = (i: number, v: string) => {
    const t: [string, string, string] = [...fd.coreTopics];
    t[i] = v;
    set("coreTopics", t);
  };

  const canNext = () => {
    if (step === 0) return fd.brandName.trim() !== "";
    if (step === 1) return fd.targetAudience.trim() !== "";
    return true;
  };

  const goToPromptStep = () => {
    setPromptText(buildTrustBasePrompt(fd));
    setStep(3);
  };

  const regeneratePrompt = () => {
    setPromptText(buildTrustBasePrompt(fd));
  };

  const handleSubmit = () => {
    onSubmit({ ...fd, customPrompt: promptText || undefined });
  };

  const analyzeStyle = async () => {
    const urls = fd.pastContentUrls.split("\n").map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) return;
    setAnalyzingStyle(true);
    setAnalyzeError(null);
    try {
      const res = await fetch("/api/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      if (res.ok) {
        const { styleAnalysis } = await res.json();
        set("styleAnalysis", styleAnalysis);
      } else {
        const body = await res.json().catch(() => ({}));
        setAnalyzeError({
          title: body.title ?? "風格分析失敗",
          action: body.action ?? "請檢查網址是否正確後再試。",
          code: body.code,
        });
      }
    } catch {
      setAnalyzeError({
        title: "無法連線到伺服器",
        action: "檢查網路連線後重試。",
      });
    } finally { setAnalyzingStyle(false); }
  };

  const dataForAutoFill = fd as unknown as Record<string, unknown>;

  const h = TRUST_FIELD_HINTS;

  return (
    <div className="space-y-6">
      {/* Beginner tip banner */}
      <div className="flex items-center justify-between rounded-xl border border-[#c9a84c]/30 bg-[#faf8f3] px-4 py-3">
        <div>
          <p className="text-sm font-medium text-[#1a2e1a]">第一次使用？</p>
          <p className="text-xs text-gray-500">先填入範例資料，了解每個欄位的用途，再改成自己的內容</p>
        </div>
        <button
          type="button"
          onClick={() => setFd({ ...TRUST_EXAMPLE_DATA })}
          className="shrink-0 rounded-lg border border-[#c9a84c] bg-white px-4 py-2 text-xs font-semibold text-[#c9a84c] hover:bg-[#c9a84c] hover:text-white transition-colors"
        >
          填入範例
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm border border-gray-200">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <button type="button" onClick={() => { if (i < step) setStep(i); if (i === 3 && step === 2) goToPromptStep(); }}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                i === step ? "bg-[#1a2e1a] text-white" : i < step ? "bg-[#c9a84c] text-white cursor-pointer" : "bg-gray-200 text-gray-500"
              }`}>
              {i < step ? "✓" : i + 1}
            </button>
            <div className="hidden sm:block">
              <div className={`text-xs font-medium ${i === step ? "text-[#1a2e1a]" : "text-gray-400"}`}>{s.title}</div>
            </div>
            {i < STEPS.length - 1 && <div className={`mx-2 h-px w-6 sm:w-10 ${i < step ? "bg-[#c9a84c]" : "bg-gray-200"}`} />}
          </div>
        ))}
      </div>

      {/* Step 0: 基本資訊 */}
      {step === 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#1a2e1a] mb-1">基本資訊</h2>
            <p className="text-sm text-gray-500">先告訴我們你是誰，讓 AI 更了解你的品牌</p>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.brandName.label} <span className="text-red-400">*</span></label>
              <AutoFillBtn fieldName="brandName" currentData={dataForAutoFill} onResult={v => set("brandName", v)} />
            </div>
            <span className={whyCls}>{h.brandName.why}</span>
            <input type="text" value={fd.brandName} onChange={e => set("brandName", e.target.value)} placeholder={h.brandName.placeholder} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.brandStory.label}</label>
              <AutoFillBtn fieldName="brandStory" currentData={dataForAutoFill} onResult={v => set("brandStory", v)} />
            </div>
            <span className={whyCls}>{h.brandStory.why}</span>
            <textarea rows={4} value={fd.brandStory} onChange={e => set("brandStory", e.target.value)} placeholder={h.brandStory.placeholder} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.freeResource.label}</label>
              <AutoFillBtn fieldName="freeResource" currentData={dataForAutoFill} onResult={v => set("freeResource", v)} />
            </div>
            <span className={whyCls}>{h.freeResource.why}</span>
            <textarea rows={2} value={fd.freeResource} onChange={e => set("freeResource", e.target.value)} placeholder={h.freeResource.placeholder} className={inputCls} />
          </div>
        </section>
      )}

      {/* Step 1: 內容方向 */}
      {step === 1 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#1a2e1a] mb-1">內容方向</h2>
            <p className="text-sm text-gray-500">定義你的電子報要聊什麼、寫給誰看</p>
          </div>

          <div>
            <label className={labelCls}>品牌核心三大主題</label>
            <span className={whyCls}>幫助 AI 圍繞你的核心領域撰寫內容</span>
            <div className="grid gap-3 md:grid-cols-3">
              {(["主題一", "主題二", "主題三"] as const).map((l, i) => (
                <div key={l}>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs text-gray-500">{l}</span>
                    <AutoFillBtn fieldName={`topic${i+1}`} currentData={dataForAutoFill} onResult={v => setTopic(i, v)} />
                  </div>
                  <input type="text" value={fd.coreTopics[i]} onChange={e => setTopic(i, e.target.value)} placeholder="例：理財" className={inputCls} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.targetAudience.label} <span className="text-red-400">*</span></label>
              <AutoFillBtn fieldName="targetAudience" currentData={dataForAutoFill} onResult={v => set("targetAudience", v)} />
            </div>
            <span className={whyCls}>{h.targetAudience.why}</span>
            <textarea rows={3} value={fd.targetAudience} onChange={e => set("targetAudience", e.target.value)} placeholder={h.targetAudience.placeholder} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.goals.label}</label>
              <AutoFillBtn fieldName="goals" currentData={dataForAutoFill} onResult={v => set("goals", v)} />
            </div>
            <span className={whyCls}>{h.goals.why}</span>
            <textarea rows={2} value={fd.goals} onChange={e => set("goals", e.target.value)} placeholder={h.goals.placeholder} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.coreMessage.label}</label>
              <AutoFillBtn fieldName="coreMessage" currentData={dataForAutoFill} onResult={v => set("coreMessage", v)} />
            </div>
            <span className={whyCls}>{h.coreMessage.why}</span>
            <textarea rows={2} value={fd.coreMessage} onChange={e => set("coreMessage", e.target.value)} placeholder={h.coreMessage.placeholder} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.subscriberFAQ.label}</label>
              <AutoFillBtn fieldName="subscriberFAQ" currentData={dataForAutoFill} onResult={v => set("subscriberFAQ", v)} />
            </div>
            <span className={whyCls}>{h.subscriberFAQ.why}</span>
            <textarea rows={2} value={fd.subscriberFAQ} onChange={e => set("subscriberFAQ", e.target.value)} placeholder={h.subscriberFAQ.placeholder} className={inputCls} />
          </div>
        </section>
      )}

      {/* Step 2: 風格設定 */}
      {step === 2 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#1a2e1a] mb-1">風格設定</h2>
            <p className="text-sm text-gray-500">決定信件的語氣和風格</p>
          </div>

          <div>
            <label className={labelCls}>語氣風格</label>
            <span className={whyCls}>決定整系列信件的說話方式</span>
            <div className="grid gap-3 md:grid-cols-2">
              {TONE_OPTIONS.map(opt => (
                <label key={opt.value} className={`flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-colors ${
                  fd.toneStyle === opt.value ? "border-[#c9a84c] bg-[#faf8f3]" : "border-gray-200 hover:border-gray-300"
                }`}>
                  <input type="radio" name="tone" value={opt.value} checked={fd.toneStyle === opt.value}
                    onChange={e => set("toneStyle", e.target.value as ToneStyle)} className="sr-only" />
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    fd.toneStyle === opt.value ? "border-[#c9a84c] bg-[#c9a84c]" : "border-gray-300"
                  }`}>
                    {fd.toneStyle === opt.value && <div className="h-2 w-2 rounded-full bg-white" />}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-[#1a2e1a]">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            {fd.toneStyle === "custom" && (
              <textarea rows={2} value={fd.customTone} onChange={e => set("customTone", e.target.value)}
                placeholder="描述你想要的語氣，例：溫暖但不失專業，偶爾用輕鬆的比喻"
                className={`mt-3 ${inputCls}`} />
            )}
          </div>

          <div>
            <label className={labelCls}>過往代表性文章 URL</label>
            <span className={whyCls}>AI 會擷取文章內容並分析你的寫作風格，讓生成的文案更像你</span>
            <textarea rows={3} value={fd.pastContentUrls} onChange={e => set("pastContentUrls", e.target.value)}
              placeholder={"貼上 1~3 篇文章網址，每行一個\nhttps://example.com/article-1\nhttps://example.com/article-2"}
              className={inputCls} />
            <button type="button" onClick={analyzeStyle} disabled={analyzingStyle || !fd.pastContentUrls.trim()}
              className="mt-2 rounded-lg bg-[#1a2e1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4a2a] disabled:opacity-50 transition-colors">
              {analyzingStyle ? "分析中..." : "分析寫作風格"}
            </button>
            {analyzeError && (
              <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
                <p className="font-medium text-red-900">{analyzeError.title}</p>
                <p className="mt-1 text-red-800">{analyzeError.action}</p>
                {analyzeError.code && (
                  <p className="mt-2 font-mono text-[11px] text-red-600">錯誤代碼：{analyzeError.code}</p>
                )}
              </div>
            )}
            {fd.styleAnalysis && (
              <div className="mt-3 rounded-lg bg-[#faf8f3] border border-[#c9a84c]/30 p-4">
                <span className="text-xs font-semibold text-[#c9a84c]">風格分析結果</span>
                <p className="mt-1 text-sm text-gray-700">{fd.styleAnalysis}</p>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.uniqueValueProp.label}</label>
              <AutoFillBtn fieldName="uniqueValueProp" currentData={dataForAutoFill} onResult={v => set("uniqueValueProp", v)} />
            </div>
            <span className={whyCls}>{h.uniqueValueProp.why}</span>
            <textarea rows={2} value={fd.uniqueValueProp} onChange={e => set("uniqueValueProp", e.target.value)} placeholder={h.uniqueValueProp.placeholder} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.socialLinks.label}</label>
              <AutoFillBtn fieldName="socialLinks" currentData={dataForAutoFill} onResult={v => set("socialLinks", v)} />
            </div>
            <span className={whyCls}>{h.socialLinks.why}</span>
            <input type="text" value={fd.socialLinks} onChange={e => set("socialLinks", e.target.value)} placeholder={h.socialLinks.placeholder} className={inputCls} />
          </div>
        </section>
      )}

      {/* Step 3: 確認提示詞 */}
      {step === 3 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#1a2e1a] mb-1">確認提示詞</h2>
            <p className="text-sm text-gray-500">預覽 AI 將使用的提示詞，你可以直接修改內容來微調產出方向</p>
          </div>

          <div className="rounded-lg bg-[#faf8f3] border border-[#c9a84c]/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <svg className="h-4 w-4 text-[#c9a84c]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs font-medium text-[#1a2e1a]">AI 角色</span>
            </div>
            <p className="text-xs text-gray-600">一位專業的文案專家，擅長寫出高轉換、高信任的標題和文案，促使讀者不斷讀下去</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-[#1a2e1a]">品牌資料提示詞</label>
              <button type="button" onClick={regeneratePrompt}
                className="rounded-md bg-[#f5f0e8] px-3 py-1.5 text-xs font-medium text-[#1a2e1a] hover:bg-[#ebe5d8] transition-colors">
                根據填寫內容重新生成
              </button>
            </div>
            <textarea rows={16} value={promptText} onChange={e => setPromptText(e.target.value)}
              className={`${inputCls} font-mono text-xs leading-relaxed`} />
          </div>

          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
            <p className="text-xs text-blue-700">每封信會自動加上當天的主題和策略目標，你不需要在這裡指定。</p>
          </div>
        </section>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        {step > 0 ? (
          <button type="button" onClick={() => setStep(s => s - 1)}
            className="rounded-xl border border-gray-300 px-6 py-3 text-sm font-medium text-gray-600 hover:bg-white transition-colors">
            上一步
          </button>
        ) : <div />}

        {step < 3 ? (
          <button type="button" onClick={() => step === 2 ? goToPromptStep() : setStep(s => s + 1)} disabled={!canNext()}
            className="rounded-xl bg-[#1a2e1a] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#1a2e1a]/20 hover:bg-[#2a4a2a] disabled:opacity-50 transition-colors">
            下一步
          </button>
        ) : (
          <button type="button" onClick={handleSubmit}
            className="rounded-xl bg-[#1a2e1a] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#1a2e1a]/20 hover:bg-[#2a4a2a] transition-colors">
            產生 7 封信任信
          </button>
        )}
      </div>
    </div>
  );
}
