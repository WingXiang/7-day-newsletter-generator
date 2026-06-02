# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

# Project: 電子報 7 天文案產生器

A standalone Next.js app that generates two 7-email sequences (Welcome + Sales) using Claude AI, based on user-provided brand information.

## Stack
- Next.js 16 (App Router)
- React 19
- Tailwind CSS v4
- Anthropic Claude API (`claude-sonnet-4-20250514`)

## Running locally
```
npm install
# Add your ANTHROPIC_API_KEY to .env.local
npm run dev
```

## Architecture
- `src/lib/email-prompts.ts` — Prompt templates, sequence definitions, shared types
- `src/app/api/email-generate/route.ts` — API route proxying Claude calls (one email per request)
- `src/app/email-generator/page.tsx` — Main page with 3-step flow: form → generating → results
- `src/app/email-generator/BrandForm.tsx` — Brand data input form
- `src/app/email-generator/EmailCard.tsx` — Expandable email preview card
