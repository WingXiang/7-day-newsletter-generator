// ── Shared types ──

export type ToneStyle = "friendly" | "professional" | "humorous" | "inspirational" | "custom";

export interface SequenceDay {
  day: number;
  theme: string;
  strategyGoal: string;
  sendTiming: string;
}

export interface EmailObject {
  day: number;
  theme: string;
  sendTiming: string;
  subject: string;
  subjectAlt: string;
  previewText: string;
  body: string;
  cta: string;
}

// ── Trust form ──

export interface TrustFormData {
  brandName: string;
  brandStory: string;
  freeResource: string;
  coreTopics: [string, string, string];
  targetAudience: string;
  goals: string;
  coreMessage: string;
  subscriberFAQ: string;
  toneStyle: ToneStyle;
  customTone: string;
  pastContentUrls: string;
  styleAnalysis: string;
  uniqueValueProp: string;
  socialLinks: string;
  customPrompt?: string;
}

// ── Sales form ──

export interface SalesFormData {
  brandName: string;
  productName: string;
  brandStory: string;
  targetPainPoints: string;
  sellingPoints: string[];
  productPrice: string;
  objections: string;
  toneStyle: ToneStyle;
  customTone: string;
  discountCode: string;
  discountDeadline: string;
  testimonials: string;
  guarantee: string;
  bonuses: string;
  customPrompt?: string;
}

// ── Sequence structures ──

export const TRUST_SEQUENCE: SequenceDay[] = [
  { day: 0, theme: "歡迎信 + 你的故事", strategyGoal: "讓訂閱者認識你是誰", sendTiming: "訂閱後立即" },
  { day: 1, theme: "品牌核心主題一", strategyGoal: "提供即時價值，証明你懂他們", sendTiming: "訂閱後第 1 天" },
  { day: 2, theme: "品牌核心主題二", strategyGoal: "深化關係，分享觀點", sendTiming: "訂閱後第 2 天" },
  { day: 3, theme: "讀者痛點共鳴信", strategyGoal: "展示理解，引發認同", sendTiming: "訂閱後第 3 天" },
  { day: 4, theme: "品牌核心主題三", strategyGoal: "建立專業形象", sendTiming: "訂閱後第 4 天" },
  { day: 5, theme: "社會認同 + 轉變故事", strategyGoal: "展示成果或讀者見証", sendTiming: "訂閱後第 5 天" },
  { day: 6, theme: "輕量產品介紹", strategyGoal: "自然過渡到銷售，不強銷", sendTiming: "訂閱後第 6 天" },
];

export const SALES_SEQUENCE: SequenceDay[] = [
  { day: 1, theme: "痛點放大信", strategyGoal: "激活問題意識", sendTiming: "序列第 1 天" },
  { day: 2, theme: "理想未來描繪", strategyGoal: "描繪擁有產品後的生活", sendTiming: "序列第 2 天" },
  { day: 3, theme: "產品介紹 + 賣點拆解", strategyGoal: "清楚說明解決方案", sendTiming: "序列第 3 天" },
  { day: 4, theme: "常見疑慮破解 FAQ", strategyGoal: "消除購買障礙", sendTiming: "序列第 4 天" },
  { day: 5, theme: "社會認同 + 案例", strategyGoal: "強化信心", sendTiming: "序列第 5 天" },
  { day: 6, theme: "稀缺性 / 緊迫感", strategyGoal: "優惠即將截止提醒", sendTiming: "序列第 6 天" },
  { day: 7, theme: "最後機會信", strategyGoal: "最強 CTA，製造行動動力", sendTiming: "序列第 7 天（最後一天）" },
];

// ── Prompt constants ──

export const SYSTEM_PROMPT = `你是一位專業的文案專家，擅長寫出高轉換、高信任的標題和文案，促使讀者不斷讀下去。你專門協助個人創作者和部落客撰寫高轉換率的電子報序列。

你的文案原則：
1. 語氣要像朋友寫信，不是廣告文案
2. 每封信只做一件事、傳遞一個核心訊息
3. 主旨行要讓人忍不住點開（好奇、利益、情緒）
4. 結尾 CTA 清晰明確，只有一個行動
5. 使用繁體中文撰寫
6. 正文不要使用任何 emoji、圖示符號、icon
7. 不要使用 **粗體** 標記或任何 markdown 格式符號（如 #、*、- 等），用自然的語句來表達重點

回覆格式：請以 JSON 格式回覆，包含以下欄位：
{
  "subject": "主要主旨行",
  "subjectAlt": "備用主旨行（A/B test 用）",
  "previewText": "預覽文字（出現在主旨行旁邊的文字片段）",
  "body": "完整 Email 正文（純文字格式，使用段落換行來組織內容，不要使用任何 markdown 符號或 emoji）",
  "cta": "CTA 按鈕文字"
}

只回覆 JSON，不要加任何額外說明。`;

export const TONE_LABELS: Record<ToneStyle, string> = {
  friendly: "親切友善",
  professional: "專業權威",
  humorous: "幽默活潑",
  inspirational: "激勵人心",
  custom: "自訂",
};

// ── Base prompt builders (for prompt preview in step 4) ──

export function buildTrustBasePrompt(formData: TrustFormData): string {
  const toneText = formData.toneStyle === "custom"
    ? formData.customTone
    : TONE_LABELS[formData.toneStyle];

  const parts: string[] = [
    `## 品牌資料（信任信）`,
    ``,
    `- 品牌名稱：${formData.brandName}`,
  ];

  if (formData.brandStory) parts.push(`- 品牌故事 / 背景：${formData.brandStory}`);
  if (formData.freeResource) parts.push(`- 免費資源 / 鉛磁鐵：${formData.freeResource}`);

  const topics = formData.coreTopics.filter(t => t.trim());
  if (topics.length > 0) parts.push(`- 品牌核心主題：${topics.join("、")}`);

  parts.push(`- 目標受眾：${formData.targetAudience}`);

  if (formData.goals) parts.push(`- 想達到的目的：${formData.goals}`);
  if (formData.coreMessage) parts.push(`- 想傳遞的核心訊息：${formData.coreMessage}`);
  if (formData.subscriberFAQ) parts.push(`- 訂閱者常見問題：${formData.subscriberFAQ}`);

  parts.push(`- 語氣風格：${toneText}`);

  if (formData.uniqueValueProp) parts.push(`- 品牌獨特價值主張：${formData.uniqueValueProp}`);
  if (formData.socialLinks) parts.push(`- 社群平台連結：${formData.socialLinks}`);

  if (formData.styleAnalysis) {
    parts.push(``, `### 寫作風格分析`, formData.styleAnalysis);
  }

  return parts.join("\n");
}

export function buildSalesBasePrompt(formData: SalesFormData): string {
  const toneText = formData.toneStyle === "custom"
    ? formData.customTone
    : TONE_LABELS[formData.toneStyle];

  const sellingPointsText = formData.sellingPoints
    .filter(s => s.trim())
    .map((p, i) => `${i + 1}. ${p}`)
    .join("\n");

  const parts: string[] = [
    `## 品牌資料（銷售信）`,
    ``,
    `- 品牌名稱：${formData.brandName}`,
    `- 產品/課程名稱：${formData.productName}`,
  ];

  if (formData.brandStory) parts.push(`- 品牌故事 / 背景：${formData.brandStory}`);

  parts.push(`- 受眾痛點：${formData.targetPainPoints}`);
  parts.push(`- 產品價格：${formData.productPrice || "未提供"}`);

  if (formData.discountCode) {
    let disc = `- 優惠折扣碼：${formData.discountCode}`;
    if (formData.discountDeadline) disc += `（截止日期：${formData.discountDeadline}）`;
    parts.push(disc);
  }

  parts.push(`- 語氣風格：${toneText}`);

  if (sellingPointsText) {
    parts.push(``, `### 產品核心賣點`, sellingPointsText);
  }

  if (formData.objections) parts.push(``, `### 常見購買反對理由`, formData.objections);
  if (formData.testimonials) parts.push(``, `### 成功案例 / 見證`, formData.testimonials);
  if (formData.guarantee) parts.push(``, `### 購買保證 / 退款政策`, formData.guarantee);
  if (formData.bonuses) parts.push(``, `### 加值贈品`, formData.bonuses);

  return parts.join("\n");
}

// ── Full prompt builders (base + day task) ──

export function buildTrustPrompt(
  formData: TrustFormData,
  day: SequenceDay,
  additionalInstructions?: string,
): string {
  const basePrompt = formData.customPrompt || buildTrustBasePrompt(formData);

  return `${basePrompt}

---

## 任務

請為「信任信」撰寫第 ${day.day} 封 Email。

- **本封主題**：${day.theme}
- **策略目標**：${day.strategyGoal}
- **發送時機**：${day.sendTiming}

${additionalInstructions ? `### 額外指示\n${additionalInstructions}\n` : ""}
請以 JSON 格式回覆。正文請用純文字格式撰寫，使用段落換行來組織內容，不要使用任何 emoji、圖示符號、** 粗體標記或其他 markdown 格式符號。正文長度建議在 300-500 字之間。`;
}

export function buildSalesPrompt(
  formData: SalesFormData,
  day: SequenceDay,
  additionalInstructions?: string,
): string {
  const basePrompt = formData.customPrompt || buildSalesBasePrompt(formData);

  return `${basePrompt}

---

## 任務

請為「銷售信」撰寫第 ${day.day} 封 Email。

- **本封主題**：${day.theme}
- **策略目標**：${day.strategyGoal}
- **發送時機**：${day.sendTiming}

${additionalInstructions ? `### 額外指示\n${additionalInstructions}\n` : ""}
請以 JSON 格式回覆。正文請用純文字格式撰寫，使用段落換行來組織內容，不要使用任何 emoji、圖示符號、** 粗體標記或其他 markdown 格式符號。正文長度建議在 300-500 字之間。`;
}

// ── Field metadata for auto-fill and UX hints ──

export const TRUST_FIELD_HINTS: Record<string, { label: string; why: string; placeholder: string }> = {
  brandName: { label: "品牌 / 個人名稱", why: "讓 AI 在信件中正確稱呼你的品牌", placeholder: "你的品牌或個人名稱" },
  brandStory: { label: "品牌故事 / 背景介紹", why: "好的故事能讓讀者快速認識你，建立情感連結", placeholder: "簡述你的經歷、為什麼開始做這件事、你的理念是什麼" },
  freeResource: { label: "免費資源 / 鉛磁鐵", why: "如果你有提供免費下載、課程或工具，AI 可以在歡迎信中提及", placeholder: "例：免費 PDF 指南、迷你課程、模板工具" },
  topic1: { label: "品牌核心主題一", why: "幫助 AI 圍繞你的核心領域撰寫第一個主題的信件", placeholder: "例：時間管理" },
  topic2: { label: "品牌核心主題二", why: "幫助 AI 圍繞你的核心領域撰寫第二個主題的信件", placeholder: "例：閱讀方法" },
  topic3: { label: "品牌核心主題三", why: "幫助 AI 圍繞你的核心領域撰寫第三個主題的信件", placeholder: "例：自我成長" },
  targetAudience: { label: "目標受眾描述", why: "越具體描述讀者，AI 產出的文案越精準", placeholder: "你的讀者是誰？他們關心什麼？面臨什麼挑戰？" },
  goals: { label: "想達到的目的", why: "讓 AI 知道這系列信件的最終目標", placeholder: "例：建立信任、培養閱讀習慣、讓訂閱者認識我的專業" },
  coreMessage: { label: "想傳遞的核心訊息", why: "讀者看完 7 封信後，你希望他們記住什麼？", placeholder: "你希望讀完這 7 封信後，訂閱者對你的最深印象" },
  subscriberFAQ: { label: "訂閱者常見問題", why: "AI 可以在信件中自然回答這些問題，增加信任感", placeholder: "你的訂閱者最常問的問題是什麼？" },
  uniqueValueProp: { label: "品牌獨特價值主張", why: "讓 AI 在信件中強調你與別人的不同之處", placeholder: "你跟同領域的其他人有什麼不同？你的獨特優勢是什麼？" },
  socialLinks: { label: "社群平台連結", why: "AI 可以在信件中引導讀者追蹤你的社群", placeholder: "例：IG @brand、Facebook 粉專連結" },
};

// ── Example data for beginners ──

export const TRUST_EXAMPLE_DATA: TrustFormData = {
  brandName: "小光的自我成長筆記",
  brandStory: "我是小光，一位熱愛閱讀的上班族。2022 年我開始每天花 30 分鐘閱讀，一年後讀了 50 本書，生活和工作都有了明顯改變。我想把這套方法分享給也想成長卻不知從何開始的人。",
  freeResource: "免費 PDF：「7 天讀書計畫表」讓你養成閱讀習慣",
  coreTopics: ["高效閱讀技巧", "時間管理方法", "個人成長心得"],
  targetAudience: "25-40 歲、工作繁忙的上班族，想持續學習卻覺得沒時間，或者看了很多書卻記不住、用不上",
  goals: "幫助訂閱者建立閱讀習慣，信任我的方法，並對我即將推出的線上課程產生興趣",
  coreMessage: "只要找對方法，每個忙碌的人都能持續學習、持續進步",
  subscriberFAQ: "沒時間讀書怎麼辦？要怎麼選書？讀完之後記不住怎麼辦？",
  toneStyle: "friendly",
  customTone: "",
  pastContentUrls: "",
  styleAnalysis: "",
  uniqueValueProp: "我分享的都是自己親身實踐過的方法，不講理論，只講能馬上用的技巧",
  socialLinks: "IG @xiaoguang.reads",
};

export const SALES_EXAMPLE_DATA: SalesFormData = {
  brandName: "小光學院",
  productName: "30 天高效閱讀挑戰課程",
  brandStory: "從每年讀不完 3 本書，到一年讀 50 本，我把這套親身實踐的方法整理成 30 天課程",
  targetPainPoints: "想學習卻總是半途而廢、看了很多書卻記不住、不知道怎麼把知識用在工作和生活中",
  sellingPoints: ["30 天循序漸進，每天只需 30 分鐘", "科學記憶法，讀完真的記得住", "學員專屬社群，每週讀書會"],
  productPrice: "NT$2,980（限時早鳥價 NT$1,980）",
  objections: "太貴了、沒時間、不確定適不適合我",
  toneStyle: "friendly",
  customTone: "",
  discountCode: "EARLYBIRD",
  discountDeadline: "2026-07-15",
  testimonials: "學員陳小姐：「上完課後我從每月讀 1 本變成每月讀 4 本，而且真的記得住內容，工作效率也提升了！」",
  guarantee: "14 天無條件退款保證，不滿意全額退費，零風險嘗試",
  bonuses: "購買加贈：一對一閱讀策略諮詢 30 分鐘 + 2026 年度最強書單 PDF",
};

export const SALES_FIELD_HINTS: Record<string, { label: string; why: string; placeholder: string }> = {
  brandName: { label: "品牌名稱", why: "讓 AI 在信件中正確稱呼你的品牌", placeholder: "你的品牌名稱" },
  productName: { label: "產品 / 課程名稱", why: "讓 AI 知道要銷售的是什麼", placeholder: "你的主打產品名稱" },
  brandStory: { label: "品牌故事 / 背景", why: "好的品牌故事能增加產品的信任度和說服力", placeholder: "簡述品牌的創立背景、理念" },
  productPrice: { label: "產品價格", why: "有了價格，AI 可以在適當時機揭露並處理價格異議", placeholder: "例：NT$2,990" },
  targetPainPoints: { label: "受眾痛點", why: "這是銷售信的核心，痛點越具體，文案越有力", placeholder: "目標客戶遇到什麼問題？他們的困擾是什麼？" },
  objections: { label: "常見購買反對理由", why: "AI 會在信件中提前處理這些疑慮，降低購買阻力", placeholder: "例：太貴了、不確定有沒有效、沒有時間" },
  guarantee: { label: "購買保證 / 退款政策", why: "降低購買風險感，AI 會在適當時機提及讓讀者安心", placeholder: "例：30 天無條件退款保證" },
  bonuses: { label: "加值贈品", why: "額外贈品能增加產品感知價值，提高轉換率", placeholder: "例：購買即贈一對一諮詢 30 分鐘" },
  testimonials: { label: "成功案例 / 見證", why: "真實的成功案例能大幅提升轉換率", placeholder: "貼上學員見證、使用者回饋" },
};
