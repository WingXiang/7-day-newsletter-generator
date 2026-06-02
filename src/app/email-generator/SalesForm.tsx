"use client";

import { useState, useCallback } from "react";
import type { SalesFormData, ToneStyle } from "@/lib/email-prompts";
import { SALES_FIELD_HINTS, buildSalesBasePrompt, SALES_EXAMPLE_DATA } from "@/lib/email-prompts";

const TONE_OPTIONS: { value: ToneStyle; label: string; desc: string }[] = [
  { value: "friendly", label: "親切友善", desc: "像朋友聊天一樣" },
  { value: "professional", label: "專業權威", desc: "展現專業知識" },
  { value: "humorous", label: "幽默活潑", desc: "輕鬆有趣的風格" },
  { value: "inspirational", label: "激勵人心", desc: "鼓舞讀者行動" },
  { value: "custom", label: "自訂", desc: "輸入你想要的語氣" },
];

const STEPS = [
  { title: "基本資訊", desc: "產品與品牌資料" },
  { title: "痛點與賣點", desc: "受眾問題與解方" },
  { title: "行銷與風格", desc: "優惠、見證、語氣" },
  { title: "確認提示詞", desc: "預覽並編輯提示詞" },
];

const inputCls =
  "w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-[#c9a84c] focus:outline-none focus:ring-2 focus:ring-[#c9a84c]/20 transition-colors";
const labelCls = "mb-1 block text-sm font-medium text-[#1a2e1a]";
const whyCls = "mb-2 block text-xs text-gray-400";

const DEFAULT_DATA: SalesFormData = {
  brandName: "", productName: "", brandStory: "",
  targetPainPoints: "", sellingPoints: [""], productPrice: "",
  objections: "", toneStyle: "friendly", customTone: "",
  discountCode: "", discountDeadline: "", testimonials: "",
  guarantee: "", bonuses: "",
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
        body: JSON.stringify({ fieldName, sequenceType: "sales", currentData }),
      });
      if (res.ok) {
        const { value } = await res.json();
        onResult(value);
      } else {
        const body = await res.json().catch(() => ({}));
        const tip = body.title ?? "AI 填寫失敗，可手動輸入";
        setErrorTip(tip);
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

export default function SalesForm({ onSubmit }: { onSubmit: (d: SalesFormData) => void }) {
  const [step, setStep] = useState(0);
  const [fd, setFd] = useState<SalesFormData>({ ...DEFAULT_DATA });
  const [promptText, setPromptText] = useState("");

  const set = useCallback(<K extends keyof SalesFormData>(key: K, val: SalesFormData[K]) => {
    setFd(prev => ({ ...prev, [key]: val }));
  }, []);

  const addSP = () => set("sellingPoints", [...fd.sellingPoints, ""]);
  const removeSP = (i: number) => set("sellingPoints", fd.sellingPoints.filter((_, idx) => idx !== i));
  const updateSP = (i: number, v: string) => {
    const n = [...fd.sellingPoints]; n[i] = v; set("sellingPoints", n);
  };

  const canNext = () => {
    if (step === 0) return fd.brandName.trim() !== "" && fd.productName.trim() !== "";
    if (step === 1) return fd.targetPainPoints.trim() !== "";
    return true;
  };

  const goToPromptStep = () => {
    setPromptText(buildSalesBasePrompt(fd));
    setStep(3);
  };

  const regeneratePrompt = () => {
    setPromptText(buildSalesBasePrompt(fd));
  };

  const handleSubmit = () => {
    onSubmit({ ...fd, customPrompt: promptText || undefined });
  };

  const dataForAutoFill = fd as unknown as Record<string, unknown>;
  const h = SALES_FIELD_HINTS;

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
          onClick={() => setFd({ ...SALES_EXAMPLE_DATA })}
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
            <p className="text-sm text-gray-500">填寫你的品牌與產品基本資料</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
                <label className={labelCls}>{h.productName.label} <span className="text-red-400">*</span></label>
                <AutoFillBtn fieldName="productName" currentData={dataForAutoFill} onResult={v => set("productName", v)} />
              </div>
              <span className={whyCls}>{h.productName.why}</span>
              <input type="text" value={fd.productName} onChange={e => set("productName", e.target.value)} placeholder={h.productName.placeholder} className={inputCls} />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.brandStory.label}</label>
              <AutoFillBtn fieldName="brandStory" currentData={dataForAutoFill} onResult={v => set("brandStory", v)} />
            </div>
            <span className={whyCls}>{h.brandStory.why}</span>
            <textarea rows={3} value={fd.brandStory} onChange={e => set("brandStory", e.target.value)} placeholder={h.brandStory.placeholder} className={inputCls} />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.productPrice.label}</label>
              <AutoFillBtn fieldName="productPrice" currentData={dataForAutoFill} onResult={v => set("productPrice", v)} />
            </div>
            <span className={whyCls}>{h.productPrice.why}</span>
            <input type="text" value={fd.productPrice} onChange={e => set("productPrice", e.target.value)} placeholder={h.productPrice.placeholder} className={inputCls} />
          </div>
        </section>
      )}

      {/* Step 1: 痛點與賣點 */}
      {step === 1 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#1a2e1a] mb-1">痛點與賣點</h2>
            <p className="text-sm text-gray-500">描述受眾的問題和你的產品如何解決</p>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.targetPainPoints.label} <span className="text-red-400">*</span></label>
              <AutoFillBtn fieldName="targetPainPoints" currentData={dataForAutoFill} onResult={v => set("targetPainPoints", v)} />
            </div>
            <span className={whyCls}>{h.targetPainPoints.why}</span>
            <textarea rows={4} value={fd.targetPainPoints} onChange={e => set("targetPainPoints", e.target.value)} placeholder={h.targetPainPoints.placeholder} className={inputCls} />
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <label className={labelCls}>產品核心賣點</label>
                <span className="text-xs text-gray-400">AI 會將賣點拆解成每封信的內容素材</span>
              </div>
              <button type="button" onClick={addSP} className="rounded-lg bg-[#f5f0e8] px-3 py-1.5 text-sm font-medium text-[#1a2e1a] hover:bg-[#ebe5d8] transition-colors">+ 新增</button>
            </div>
            <div className="space-y-3">
              {fd.sellingPoints.map((sp, i) => (
                <div key={i} className="flex gap-2">
                  <input type="text" value={sp} onChange={e => updateSP(i, e.target.value)} placeholder={`賣點 ${i + 1}`} className={inputCls} />
                  {fd.sellingPoints.length > 1 && (
                    <button type="button" onClick={() => removeSP(i)} className="shrink-0 rounded-lg px-3 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.objections.label}</label>
              <AutoFillBtn fieldName="objections" currentData={dataForAutoFill} onResult={v => set("objections", v)} />
            </div>
            <span className={whyCls}>{h.objections.why}</span>
            <textarea rows={3} value={fd.objections} onChange={e => set("objections", e.target.value)} placeholder={h.objections.placeholder} className={inputCls} />
          </div>
        </section>
      )}

      {/* Step 2: 行銷與風格 */}
      {step === 2 && (
        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-[#1a2e1a] mb-1">行銷與風格</h2>
            <p className="text-sm text-gray-500">設定語氣、優惠和社會證明</p>
          </div>

          {/* Tone */}
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

          {/* Discount */}
          <div>
            <label className={labelCls}>優惠方案</label>
            <span className={whyCls}>讓 AI 在最後幾封信創造緊迫感</span>
            <div className="grid gap-4 md:grid-cols-2">
              <input type="text" value={fd.discountCode} onChange={e => set("discountCode", e.target.value)} placeholder="折扣碼，例：LAUNCH20" className={inputCls} />
              <input type="date" value={fd.discountDeadline} onChange={e => set("discountDeadline", e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Testimonials */}
          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.testimonials.label}</label>
              <AutoFillBtn fieldName="testimonials" currentData={dataForAutoFill} onResult={v => set("testimonials", v)} />
            </div>
            <span className={whyCls}>{h.testimonials.why}</span>
            <textarea rows={3} value={fd.testimonials} onChange={e => set("testimonials", e.target.value)} placeholder={h.testimonials.placeholder} className={inputCls} />
          </div>

          {/* Guarantee */}
          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.guarantee.label}</label>
              <AutoFillBtn fieldName="guarantee" currentData={dataForAutoFill} onResult={v => set("guarantee", v)} />
            </div>
            <span className={whyCls}>{h.guarantee.why}</span>
            <textarea rows={2} value={fd.guarantee} onChange={e => set("guarantee", e.target.value)} placeholder={h.guarantee.placeholder} className={inputCls} />
          </div>

          {/* Bonuses */}
          <div>
            <div className="flex items-center gap-2">
              <label className={labelCls}>{h.bonuses.label}</label>
              <AutoFillBtn fieldName="bonuses" currentData={dataForAutoFill} onResult={v => set("bonuses", v)} />
            </div>
            <span className={whyCls}>{h.bonuses.why}</span>
            <textarea rows={2} value={fd.bonuses} onChange={e => set("bonuses", e.target.value)} placeholder={h.bonuses.placeholder} className={inputCls} />
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
            產生 7 封銷售信
          </button>
        )}
      </div>
    </div>
  );
}
