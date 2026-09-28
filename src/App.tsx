import DruClearAssessment from './DruClearAssessment/index'
import PreSessionQuestionnaire from './PreSessionQuestionnaire/index'

// ── DRU CLEAR™ AI Readiness Assessment ───────────────────────
// This repo serves two things now:
//   1. The DRU CLEAR™ assessment PWA (default).
//   2. The Strategic/Executive Diagnostic pre-session questionnaire —
//      shown instead, when the web address carries a person's private
//      prep code, e.g. ?prep=THEIRCODE. Added Sep 28, 2026.
// Drop your DruClearAssessment/ folder from the app repo into src/
// and verify the supabase import path points to ./lib/supabaseClient
// ─────────────────────────────────────────────────────────────

export default function App() {
  const hasPrepCode = new URLSearchParams(window.location.search).has('prep')
  if (hasPrepCode) return <PreSessionQuestionnaire />
  return <DruClearAssessment />
}

