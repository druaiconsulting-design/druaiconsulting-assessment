# DRU CLEAR™ AI Readiness Assessment

**assessment.druaiconsulting.com**

Standalone PWA for the DRU CLEAR™ AI Readiness Assessment — the sole entry point to the DRU AI Leadership Ecosystem™. Every agent CTA across the ecosystem points here.

---

## Stack

- React 18 + TypeScript + Vite
- Supabase (implicit flow) — same project as all ecosystem repos
- vite-plugin-pwa — installable on mobile + desktop
- pnpm

---

## Setup

```bash
pnpm install
cp .env.example .env.local
# Add your VITE_SUPABASE_ANON_KEY to .env.local
pnpm dev
```

---

## Deployment (Vercel Pro)

1. Connect this repo to a new Vercel project
2. Add env vars in Vercel project settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Deploy — verify on Vercel preview URL
4. Re-point `assessment.druaiconsulting.com` from app project to this project

---

## Adding the Assessment Code

1. Copy `DruClearAssessment/` from `dru-clear-app/src/` into `src/` here
2. Check import paths inside `DruClearAssessment/` — update any Supabase imports to point to `../lib/supabaseClient`
3. `pnpm dev` to confirm it runs locally

---

## Backup Plan

The original `DruClearAssessment/` folder stays in `dru-clear-app` for 60-90 days after this repo goes live. Do not delete from the app repo until fully confirmed stable.

---

## Data Flow

Assessment completion → `submissions` table (Supabase) + GHL webhook → Assessment results page → CTA to join ecosystem

---

*DRU AI Consulting · DRU AI Leadership Ecosystem™ · © 2026 Dimensional Solns, LLC*
