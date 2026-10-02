import DruClearAssessment from './DruClearAssessment/index'
import PreSessionQuestionnaire from './PreSessionQuestionnaire/index'

// ── DRU CLEAR™ AI Readiness Assessment ───────────────────────
// This repo serves two things now:
//   1. The DRU CLEAR™ assessment PWA (default).
//   2. The Strategic/Executive Diagnostic pre-session questionnaire —
//      shown instead, when the web address carries a person's private
//      pre-session code, e.g. ?sd-pre-session=THEIRCODE or
//      ?ed-pre-session=THEIRCODE. Added Sep 28, 2026.
// Drop your DruClearAssessment/ folder from the app repo into src/
// and verify the supabase import path points to ./lib/supabaseClient
// ─────────────────────────────────────────────────────────────

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const hasPreSessionCode = params.has('sd-pre-session') || params.has('ed-pre-session')
  if (hasPreSessionCode) return <PreSessionQuestionnaire />
  return <DruClearAssessment />
}

