import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { GAP_MESSAGES, STRENGTH_MESSAGES, TIER_MESSAGES, BADGE_URLS } from '../DruClearAssessment/constants';

// ── Brand colors — same palette used everywhere else ──────────────────────────
const NAVY = '#0A2342';
const GOLD = '#D4AF37';
const MAGENTA = '#C2185B';
const WARM_WHITE = '#FAFAF8';
const BODY_TEXT_ON_NAVY = '#E8E8E8';

// ── The original 15 free-assessment questions, grouped by pillar ──────────────
// This is reminder content only — their real answers get pulled from `submissions`
// (q1..q15) and displayed next to the matching statement below.
const CLEAR_PILLARS: Array<{
  key: string;
  questions: string[];
  scoreField: 'clarity_score' | 'leadership_score' | 'execution_score' | 'alignment_score' | 'results_score';
  qFields: [string, string, string];
}> = [
  {
    key: 'Clarity',
    questions: [
      'Our organization has a clearly defined AI vision that connects to our overall business strategy.',
      'Leaders and teams across the organization understand why we are pursuing AI and what success looks like.',
      'We have identified specific strategic priorities where AI will have the greatest business impact.',
    ],
    scoreField: 'clarity_score',
    qFields: ['q1', 'q2', 'q3'],
  },
  {
    key: 'Leadership',
    questions: [
      'Our organizational leaders can clearly articulate how AI connects to our business strategy and competitive position.',
      'There is a designated executive sponsor who is accountable for driving AI transformation.',
      'Our leadership team actively participates in AI learning, development, and decision-making.',
    ],
    scoreField: 'leadership_score',
    qFields: ['q4', 'q5', 'q6'],
  },
  {
    key: 'Execution',
    questions: [
      'We have identified specific business processes where AI can deliver measurable impact.',
      'Our teams have the skills, tools, and resources needed to implement AI solutions today.',
      'We have completed at least one AI pilot or proof of concept in the past 12 months.',
    ],
    scoreField: 'execution_score',
    qFields: ['q7', 'q8', 'q9'],
  },
  {
    key: 'Alignment',
    questions: [
      'Our AI initiatives are aligned with our overall business goals and strategic plan.',
      'There is clear and consistent communication between departments about AI priorities and progress.',
      'Our AI efforts are coordinated across teams and business units rather than operating in silos.',
    ],
    scoreField: 'alignment_score',
    qFields: ['q10', 'q11', 'q12'],
  },
  {
    key: 'Results',
    questions: [
      'We have defined clear Key Performance Indicators to measure the success of our AI initiatives.',
      'We can demonstrate measurable return on investment from at least one AI-related initiative.',
      'We have a system in place to regularly track and report AI progress to leadership.',
    ],
    scoreField: 'results_score',
    qFields: ['q13', 'q14', 'q15'],
  },
];

const FRAMEWORK_LABELS: Record<string, string> = {
  CLEAR: 'DRU CLEAR™',
  '5D_LEADERSHIP': '5D Leadership™ Reflection',
  '5C_CULTURAL_DNA': '5C Cultural DNA™ Reflection',
  AI_SALES_MASTERY: 'AI Sales Mastery™ Reflection',
};

// Fixed display order, both for frameworks and for pillars within each one.
const FRAMEWORK_ORDER = ['CLEAR', '5D_LEADERSHIP', '5C_CULTURAL_DNA', 'AI_SALES_MASTERY'];
const PILLAR_ORDER: Record<string, string[]> = {
  CLEAR: ['Clarity', 'Leadership', 'Execution', 'Alignment', 'Results'],
  '5D_LEADERSHIP': ['Self', 'People', 'Teams', 'Organizations', 'Visionary'],
  '5C_CULTURAL_DNA': ['Communication', 'Connection', 'Collaboration', 'Coaching', 'Culture Transformation'],
  AI_SALES_MASTERY: [
    'Hyper-Personalized Outreach at Scale',
    "Speak Your Client's Decision Language",
    'Predict Objections Before They Happen',
    'Close with Confidence, Not Pressure',
    'Build Long-Term Client Relationships',
  ],
};

const CLOSING_TEXT: Record<string, string> = {
  strategic:
    'Insight identifies five gaps individually. The DRU AI Transformation Pathway™ moves them together, one sequence across ninety days: Discover, Diagnose, Design, Deploy, Dominate, each stage built on the one before it. Please specify the gap positioned to move first.',
  executive:
    'Insight delineates four distinct frameworks: DRU CLEAR™, 5D Leadership™, 5C Cultural DNA™, and AI Sales Mastery™. The DRU AI Transformation Pathway™ integrally advances all four frameworks through a comprehensive Full Ecosystem sequence spanning ninety days: Discover, Diagnose, Design, Deploy, and Dominate. This process includes twelve sessions, with each stage systematically building on the previous one. Kindly specify the framework designated to commence the sequence.',
};

// ── Number boxes: one set under each CLEAR question that asks for figures ─────
// Each box saves under its field key. The Results question asks for the value of
// each initiative, so its boxes are added one at a time (results_value, index 1+).
// size: 'count' for small whole numbers (leaders, weeks, hours, decisions), 'money' for dollar amounts.
interface NumberField {
  key: string;
  label: string;
  size: 'count' | 'money' | 'wide';
  ariaLabel?: string; // used when the box has no visible label
}

const NUMBER_FIELDS: Record<string, NumberField[]> = {
  'Clarity:2': [
    { key: 'clarity_dollars', label: 'Dollars ($)', size: 'money' },
    { key: 'clarity_weeks', label: 'Weeks', size: 'count' },
  ],
  // An empty label leaves the box unlabeled on screen; the question above it is the label.
  'Leadership:1': [
    { key: 'leadership_leaders_succeeded', label: '', size: 'count', ariaLabel: 'Number of leaders who can do this' },
    { key: 'leadership_leaders_total', label: 'Total leaders on the team', size: 'wide' },
  ],
  'Leadership:2': [
    { key: 'leadership_stalled_decisions', label: 'Postponed decisions', size: 'count' },
    { key: 'leadership_delayed_initiatives', label: 'Delayed initiatives', size: 'count' },
    { key: 'leadership_missed_cycles', label: 'Missed cycles', size: 'count' },
  ],
  'Execution:1': [
    { key: 'execution_regions_reached', label: 'Teams the pilot serves today', size: 'wide' },
  ],
  'Execution:2': [{ key: 'execution_dollars', label: '', size: 'money', ariaLabel: 'Dollars this quarter' }],
};

// Questions where the number box comes first and the written box second, with the label shown above the written box.
const NUMBERS_FIRST: Record<string, string> = {
  'Leadership:1': 'Please identify them.',
};

// Small written boxes (a name, not a figure). Saved separately from the number boxes.
const TEXT_FIELDS: Record<string, Array<{ key: string; label: string }>> = {
  'Execution:1': [{ key: 'execution_pilot_name', label: 'Pilot name' }],
};
const FIXED_TEXT_KEYS: string[] = Object.values(TEXT_FIELDS).flatMap((fields) => fields.map((f) => f.key));

const FIXED_NUMBER_KEYS: string[] = Object.values(NUMBER_FIELDS).flatMap((fields) => fields.map((f) => f.key));
const RESULTS_KEY = 'results_value';
const MAX_INITIATIVES = 100;

// Alignment Q2: one row per department (a name and its hours), added one at a time.
// The first two rows are required; hours save as alignment_hours and names as alignment_department, both by row number.
const DEPT_NAME_KEY = 'alignment_department';
const DEPT_HOURS_KEY = 'alignment_hours';
const MAX_DEPARTMENTS = 100;

interface DeptRow {
  idx: number;
  name: string;
  hours: string;
}

const emptyDeptRows = (): DeptRow[] => [
  { idx: 1, name: '', hours: '' },
  { idx: 2, name: '', hours: '' },
];

interface ResultBox {
  idx: number;
  value: string;
}

// Digits, commas and one decimal point; 0 counts as a figure.
function parseNumber(text: string): number | null {
  const t = (text ?? '').replace(/,/g, '').trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

// Clarity Q2 (Dollars, Weeks), Leadership Q2 (three counts), Execution Q2 (Dollars), Alignment Q2 (department rows)
// and Results Q2 (initiative rows) are answered by their boxes alone, so they have no written-answer box.
function isNumbersOnlyQuestion(framework: string, pillar: string, questionOrder: number): boolean {
  return (
    framework === 'CLEAR' &&
    questionOrder === 2 &&
    (pillar === 'Clarity' || pillar === 'Leadership' || pillar === 'Execution' || pillar === 'Alignment' || pillar === 'Results')
  );
}

interface QuestionRow {
  id: string;
  question_id: string;
  answer_text: string | null;
  diagnostic_questions: {
    framework: string;
    pillar: string;
    question_order: number;
    question_text: string;
  };
}

interface SubmissionRow {
  first_name: string | null;
  tier: string;
  clarity_score: number;
  leadership_score: number;
  execution_score: number;
  alignment_score: number;
  results_score: number;
  q1: string; q2: string; q3: string; q4: string; q5: string; q6: string;
  q7: string; q8: string; q9: string; q10: string; q11: string; q12: string;
  q13: string; q14: string; q15: string;
}

export default function PreSessionQuestionnaire() {
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [diagnosticTier, setDiagnosticTier] = useState<'strategic' | 'executive' | ''>('');
  const [rows, setRows] = useState<QuestionRow[]>([]);
  const [submission, setSubmission] = useState<SubmissionRow | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [numbers, setNumbers] = useState<Record<string, string>>({});
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [resultBoxes, setResultBoxes] = useState<ResultBox[]>([{ idx: 1, value: '' }]);
  const [deptRows, setDeptRows] = useState<DeptRow[]>(emptyDeptRows());
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitNote, setSubmitNote] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('sd-pre-session') || params.get('ed-pre-session');
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setToken(token);
    load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(token: string) {
    const { data, error } = await supabase.rpc('get_presession', { p_token: token });

    const result = data as {
      email: string;
      diagnostic_tier: 'strategic' | 'executive';
      rows: QuestionRow[];
      submission: SubmissionRow | null;
    } | null;

    if (error || !result || !result.rows || result.rows.length === 0) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setEmail(result.email);
    setDiagnosticTier(result.diagnostic_tier);
    setRows(result.rows);
    setSubmission(result.submission ?? null);

    // Saved number boxes and the submission time (a failure here leaves the boxes empty).
    const numRes = await supabase.rpc('get_presession_numbers', { p_token: token });
    const numData = numRes.data as {
      numbers: Array<{ field_key: string; item_index: number; value: number }>;
      texts?: Array<{ field_key: string; item_index?: number; value: string }>;
      submitted_at: string | null;
    } | null;
    if (!numRes.error && numData) {
      const loadedTexts: Record<string, string> = {};
      const deptMap = new Map<number, DeptRow>();
      const deptAt = (idx: number): DeptRow => {
        let d = deptMap.get(idx);
        if (!d) {
          d = { idx, name: '', hours: '' };
          deptMap.set(idx, d);
        }
        return d;
      };
      const resultMap = new Map<number, ResultBox>();
      const resultAt = (idx: number): ResultBox => {
        let r = resultMap.get(idx);
        if (!r) {
          r = { idx, value: '' };
          resultMap.set(idx, r);
        }
        return r;
      };
      for (const t of numData.texts ?? []) {
        if (t.field_key === DEPT_NAME_KEY) deptAt(t.item_index ?? 1).name = t.value;
        else loadedTexts[t.field_key] = t.value;
      }
      setTexts(loadedTexts);
      const fixed: Record<string, string> = {};
      for (const n of numData.numbers ?? []) {
        if (n.field_key === RESULTS_KEY) resultAt(n.item_index).value = String(n.value);
        else if (n.field_key === DEPT_HOURS_KEY) deptAt(n.item_index).hours = String(n.value);
        else fixed[n.field_key] = String(n.value);
      }
      setNumbers(fixed);
      // The first initiative row always shows, even before anything is saved.
      resultAt(1);
      setResultBoxes(Array.from(resultMap.values()).sort((a, b) => a.idx - b.idx));
      // The first two department rows always show, even before anything is saved.
      deptAt(1);
      deptAt(2);
      setDeptRows(Array.from(deptMap.values()).sort((a, b) => a.idx - b.idx));
      setSubmittedAt(numData.submitted_at ?? null);
    }
    setLoading(false);
  }

  const saveAnswer = useCallback(async (rowId: string, value: string) => {
    const { data, error } = await supabase.rpc('save_presession_answer', {
      p_token: token,
      p_row_id: rowId,
      p_answer: value,
    });
    if (error || data !== true) return;
    setSavedId(rowId);
    setTimeout(() => setSavedId((cur) => (cur === rowId ? null : cur)), 1800);
  }, [token]);

  function updateLocalAnswer(rowId: string, value: string) {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, answer_text: value } : r)));
  }

  // A figure saves when the client leaves its box, and only when it is a valid number.
  const saveNumber = useCallback(async (fieldKey: string, itemIndex: number, text: string) => {
    const n = parseNumber(text);
    if (n === null) return;
    const { data, error } = await supabase.rpc('save_presession_number', {
      p_token: token,
      p_field_key: fieldKey,
      p_item_index: itemIndex,
      p_value: n,
    });
    if (error || data !== true) return;
    const savedKey = `${fieldKey}:${itemIndex}`;
    setSavedId(savedKey);
    setTimeout(() => setSavedId((cur) => (cur === savedKey ? null : cur)), 1800);
  }, [token]);

  function changeNumber(fieldKey: string, text: string) {
    if (!/^[0-9.,]*$/.test(text)) return;
    setNumbers((prev) => ({ ...prev, [fieldKey]: text }));
  }

  const saveText = useCallback(async (fieldKey: string, text: string) => {
    const { data, error } = await supabase.rpc('save_presession_text', {
      p_token: token,
      p_field_key: fieldKey,
      p_value: text,
    });
    if (error || data !== true) return;
    const savedKey = `text:${fieldKey}`;
    setSavedId(savedKey);
    setTimeout(() => setSavedId((cur) => (cur === savedKey ? null : cur)), 1800);
  }, [token]);

  const saveDeptName = useCallback(async (idx: number, text: string) => {
    const { data, error } = await supabase.rpc('save_presession_text', {
      p_token: token,
      p_field_key: DEPT_NAME_KEY,
      p_value: text,
      p_item_index: idx,
    });
    if (error || data !== true) return;
    const savedKey = `${DEPT_NAME_KEY}:${idx}`;
    setSavedId(savedKey);
    setTimeout(() => setSavedId((cur) => (cur === savedKey ? null : cur)), 1800);
  }, [token]);

  function changeDeptName(idx: number, text: string) {
    setDeptRows((prev) => prev.map((d) => (d.idx === idx ? { ...d, name: text } : d)));
  }

  function changeDeptHours(idx: number, text: string) {
    if (!/^[0-9.,]*$/.test(text)) return;
    setDeptRows((prev) => prev.map((d) => (d.idx === idx ? { ...d, hours: text } : d)));
  }

  function addDepartment() {
    setDeptRows((prev) => {
      if (prev.length >= MAX_DEPARTMENTS) return prev;
      const next = Math.max(...prev.map((d) => d.idx)) + 1;
      return [...prev, { idx: next, name: '', hours: '' }];
    });
  }

  // Removing a row also clears that row's saved name (the database does both together).
  async function removeDepartment(idx: number) {
    setDeptRows((prev) => prev.filter((d) => d.idx !== idx));
    await supabase.rpc('delete_presession_number', {
      p_token: token,
      p_field_key: DEPT_HOURS_KEY,
      p_item_index: idx,
    });
  }

  function changeResult(idx: number, text: string) {
    if (!/^[0-9.,]*$/.test(text)) return;
    setResultBoxes((prev) => prev.map((b) => (b.idx === idx ? { ...b, value: text } : b)));
  }

  function addInitiative() {
    setResultBoxes((prev) => {
      if (prev.length >= MAX_INITIATIVES) return prev;
      const next = Math.max(...prev.map((b) => b.idx)) + 1;
      return [...prev, { idx: next, value: '' }];
    });
  }

  async function removeInitiative(idx: number) {
    setResultBoxes((prev) => prev.filter((b) => b.idx !== idx));
    await supabase.rpc('delete_presession_number', {
      p_token: token,
      p_field_key: RESULTS_KEY,
      p_item_index: idx,
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitNote('');
    // Save everything currently on the screen first, so a box the client just typed in
    // (and has not clicked out of yet) is on file before the check runs.
    const pending: Array<PromiseLike<unknown>> = [];
    for (const r of rows) {
      const dq = r.diagnostic_questions;
      if (isNumbersOnlyQuestion(dq.framework, dq.pillar, dq.question_order)) continue;
      pending.push(
        supabase.rpc('save_presession_answer', { p_token: token, p_row_id: r.id, p_answer: r.answer_text ?? '' })
      );
    }
    for (const k of FIXED_NUMBER_KEYS) {
      const n = parseNumber(numbers[k] ?? '');
      if (n !== null) {
        pending.push(supabase.rpc('save_presession_number', { p_token: token, p_field_key: k, p_item_index: 1, p_value: n }));
      }
    }
    for (const k of FIXED_TEXT_KEYS) {
      if ((texts[k] ?? '').trim() !== '') {
        pending.push(supabase.rpc('save_presession_text', { p_token: token, p_field_key: k, p_value: texts[k] }));
      }
    }
    for (const b of resultBoxes) {
      const n = parseNumber(b.value);
      if (n !== null) {
        pending.push(supabase.rpc('save_presession_number', { p_token: token, p_field_key: RESULTS_KEY, p_item_index: b.idx, p_value: n }));
      }
    }
    for (const d of deptRows) {
      if (d.name.trim() !== '') {
        pending.push(supabase.rpc('save_presession_text', { p_token: token, p_field_key: DEPT_NAME_KEY, p_value: d.name, p_item_index: d.idx }));
      }
      const n = parseNumber(d.hours);
      if (n !== null) {
        pending.push(supabase.rpc('save_presession_number', { p_token: token, p_field_key: DEPT_HOURS_KEY, p_item_index: d.idx, p_value: n }));
      }
    }
    await Promise.all(pending);
    const { data, error } = await supabase.rpc('submit_presession', { p_token: token });
    const result = data as { ok: boolean; submitted_at?: string } | null;
    if (!error && result?.ok) {
      setSubmittedAt(result.submitted_at ?? new Date().toISOString());
    } else {
      setSubmitNote('Some answers or numbers are not saved yet. Click out of each box once, then submit again.');
    }
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div style={pageStyle}>
        <p style={{ color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif' }}>Loading your questionnaire…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div style={pageStyle}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <h1 style={{ ...headingStyle, fontSize: 24 }}>Link not recognized</h1>
          <p style={{ color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif' }}>
            This link did not match a pre-session questionnaire on file. Reach out to your DRU AI Consulting contact for a new link.
          </p>
        </div>
      </div>
    );
  }

  const writtenRows = rows.filter(
    (r) => !isNumbersOnlyQuestion(r.diagnostic_questions.framework, r.diagnostic_questions.pillar, r.diagnostic_questions.question_order)
  );
  const totalCount = writtenRows.length;
  const answeredCount = writtenRows.filter((r) => (r.answer_text ?? '').trim().length > 0).length;
  const isComplete = totalCount > 0 && answeredCount === totalCount;

  const hasClear = rows.some((r) => r.diagnostic_questions.framework === 'CLEAR');
  const fixedFilled = FIXED_NUMBER_KEYS.filter((k) => parseNumber(numbers[k] ?? '') !== null).length;
  const resultsFilled = resultBoxes.filter((b) => parseNumber(b.value) !== null).length;
  const textsFilled = FIXED_TEXT_KEYS.filter((k) => (texts[k] ?? '').trim() !== '').length;
  // Each department row counts twice: its name and its hours.
  const deptFilled = deptRows.reduce(
    (sum, d) => sum + (d.name.trim() !== '' ? 1 : 0) + (parseNumber(d.hours) !== null ? 1 : 0),
    0
  );
  const numbersTotal = hasClear ? FIXED_NUMBER_KEYS.length + FIXED_TEXT_KEYS.length + resultBoxes.length + deptRows.length * 2 : 0;
  const numbersFilled = hasClear ? fixedFilled + textsFilled + resultsFilled + deptFilled : 0;
  const numbersComplete = !hasClear || numbersFilled === numbersTotal;
  const canSubmit = isComplete && numbersComplete && !submitting;

  const frameworksPresent = FRAMEWORK_ORDER.filter((fw) => rows.some((r) => r.diagnostic_questions.framework === fw));

  return (
    <div style={{ ...pageStyle, alignItems: 'stretch', padding: '48px 24px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
        {/* Header */}
        <div style={{ marginBottom: 8, color: GOLD, fontFamily: 'Inter, sans-serif', fontSize: 13, letterSpacing: 1 }}>
          {answeredCount} of {totalCount} answered
        </div>
        <h1 style={{ ...headingStyle, fontSize: 32, marginBottom: 4 }}>
          {diagnosticTier === 'executive' ? 'Executive Diagnostic' : 'Strategic Diagnostic'} Pre-Session Questionnaire
        </h1>
        {submission?.tier && (
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
            {BADGE_URLS[submission.tier] && (
              <img src={BADGE_URLS[submission.tier]} alt={submission.tier} style={{ height: 220 }} />
            )}
          </div>
        )}

        {frameworksPresent.map((framework) => {
          const pillars = PILLAR_ORDER[framework].filter((p) =>
            rows.some((r) => r.diagnostic_questions.framework === framework && r.diagnostic_questions.pillar === p)
          );

          return (
            <div key={framework} style={{ marginBottom: 48 }}>
              <h2 style={{ ...headingStyle, fontSize: 22, color: GOLD, borderBottom: `1px solid ${GOLD}`, paddingBottom: 10, marginBottom: 24 }}>
                {FRAMEWORK_LABELS[framework]}
              </h2>

              {pillars.map((pillar) => {
                const pillarRows = rows
                  .filter((r) => r.diagnostic_questions.framework === framework && r.diagnostic_questions.pillar === pillar)
                  .sort((a, b) => a.diagnostic_questions.question_order - b.diagnostic_questions.question_order);

                const clearMeta = framework === 'CLEAR' ? CLEAR_PILLARS.find((c) => c.key === pillar) : null;

                return (
                  <div key={pillar} style={{ marginBottom: 36 }}>
                    <h3 style={{ ...headingStyle, fontSize: 18, marginBottom: 12 }}>{pillar}</h3>

                    {clearMeta && submission && (
                      <div style={reminderBoxStyle}>
                        <div style={{ fontSize: 12, letterSpacing: 1, color: GOLD, marginBottom: 8, fontFamily: 'Inter, sans-serif' }}>
                          The assessment questions and answers on record, solely as a reminder
                        </div>
                        {clearMeta.questions.map((qText, i) => (
                          <p key={i} style={{ margin: '0 0 8px 0', color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                            &ldquo;{qText}&rdquo; &rarr; Your answer:{' '}
                            <strong style={{ color: '#fff' }}>{(submission as any)[clearMeta.qFields[i]] ?? '—'}</strong>
                          </p>
                        ))}
                        <p style={{ margin: '8px 0 0 0', color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                          Your badge: <strong style={{ color: '#fff' }}>{submission.tier}</strong>
                        </p>
                        <p style={{ margin: '8px 0 0 0', color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 14 }}>
                          What this means:{' '}
                          <em>
                            {(submission[clearMeta.scoreField] as number) < 12
                              ? GAP_MESSAGES[pillar]
                              : STRENGTH_MESSAGES[pillar]}
                          </em>
                        </p>
                      </div>
                    )}

                    <div style={{ marginTop: clearMeta ? 16 : 0 }}>
                      <div style={{ fontSize: 12, letterSpacing: 1, color: GOLD, marginBottom: 10, fontFamily: 'Inter, sans-serif' }}>
                        {framework === 'CLEAR' ? 'Deeper Dive: Complete these tasks before your session:' : ''}
                      </div>
                      {pillarRows.map((row, idx) => {
                        const numberFields =
                          framework === 'CLEAR'
                            ? NUMBER_FIELDS[`${pillar}:${row.diagnostic_questions.question_order}`] ?? []
                            : [];
                        const isResultsValueQuestion =
                          framework === 'CLEAR' && pillar === 'Results' && row.diagnostic_questions.question_order === 2;
                        const isAlignmentDeptQuestion =
                          framework === 'CLEAR' && pillar === 'Alignment' && row.diagnostic_questions.question_order === 2;
                        const numbersFirstLabel =
                          framework === 'CLEAR' ? NUMBERS_FIRST[`${pillar}:${row.diagnostic_questions.question_order}`] : undefined;
                        const textFields =
                          framework === 'CLEAR' ? TEXT_FIELDS[`${pillar}:${row.diagnostic_questions.question_order}`] ?? [] : [];
                        const numberBlock =
                          numberFields.length > 0 || textFields.length > 0 ? (
                            <div style={numberRowStyle}>
                              {textFields.map((f) => (
                                <div key={f.key} style={{ flex: '0 0 auto', width: 280, maxWidth: '100%' }}>
                                  <label htmlFor={`txt-${f.key}`} style={numberLabelStyle}>{f.label}</label>
                                  <input
                                    id={`txt-${f.key}`}
                                    type="text"
                                    autoComplete="off"
                                    maxLength={200}
                                    value={texts[f.key] ?? ''}
                                    onChange={(e) => setTexts((prev) => ({ ...prev, [f.key]: e.target.value }))}
                                    onBlur={(e) => saveText(f.key, e.target.value)}
                                    style={numberInputStyle}
                                  />
                                  {savedId === `text:${f.key}` && (
                                    <div style={{ color: GOLD, fontSize: 12, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>Saved</div>
                                  )}
                                </div>
                              ))}
                              {numberFields.map((f) => (
                                <div key={f.key} style={numberCellStyle(f.size)}>
                                  {f.label && <label htmlFor={`num-${f.key}`} style={numberLabelStyle}>{f.label}</label>}
                                  {/* An unlabeled box beside a labeled one gets an invisible label so the boxes sit level. */}
                                  {!f.label && numberFields.some((x) => x.label) && (
                                    <div aria-hidden="true" style={{ ...numberLabelStyle, visibility: 'hidden' }}>&nbsp;</div>
                                  )}
                                  <input
                                    id={`num-${f.key}`}
                                    aria-label={f.label ? undefined : f.ariaLabel}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={numbers[f.key] ?? ''}
                                    onChange={(e) => changeNumber(f.key, e.target.value)}
                                    onBlur={(e) => saveNumber(f.key, 1, e.target.value)}
                                    style={numberInputStyle}
                                  />
                                  {savedId === `${f.key}:1` && (
                                    <div style={{ color: GOLD, fontSize: 12, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>Saved</div>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : null;

                        return (
                          <div key={row.id} style={{ marginBottom: 16 }}>
                            <label style={{ display: 'block', color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 15, marginBottom: 6 }}>
                              {framework === 'CLEAR' ? `${idx + 1}. ` : ''}
                              {row.diagnostic_questions.question_text}
                            </label>
                            {numbersFirstLabel && numberBlock}
                            {!isNumbersOnlyQuestion(framework, pillar, row.diagnostic_questions.question_order) && (
                              <>
                                {numbersFirstLabel && (
                                  <label
                                    htmlFor={`text-${row.id}`}
                                    style={{ display: 'block', color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 13, margin: '14px 0 4px 0' }}
                                  >
                                    {numbersFirstLabel}
                                  </label>
                                )}
                                <textarea
                                  id={`text-${row.id}`}
                                  defaultValue={row.answer_text ?? ''}
                                  onChange={(e) => updateLocalAnswer(row.id, e.target.value)}
                                  onBlur={(e) => saveAnswer(row.id, e.target.value)}
                                  rows={numbersFirstLabel ? 2 : 3}
                                  style={textareaStyle}
                                />
                                {savedId === row.id && (
                                  <div style={{ color: GOLD, fontSize: 12, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>Saved</div>
                                )}
                              </>
                            )}

                            {!numbersFirstLabel && numberBlock}

                            {isAlignmentDeptQuestion && (
                              <div style={{ marginTop: 10 }}>
                                {deptRows.map((d, pos) => (
                                  <div key={d.idx} style={{ ...numberRowStyle, marginTop: pos === 0 ? 0 : 12 }}>
                                    <div style={{ flex: '0 0 auto', width: 280, maxWidth: '100%' }}>
                                      <label htmlFor={`dept-name-${d.idx}`} style={numberLabelStyle}>
                                        Department {pos + 1}
                                      </label>
                                      <input
                                        id={`dept-name-${d.idx}`}
                                        type="text"
                                        autoComplete="off"
                                        maxLength={200}
                                        value={d.name}
                                        onChange={(e) => changeDeptName(d.idx, e.target.value)}
                                        onBlur={(e) => saveDeptName(d.idx, e.target.value)}
                                        style={numberInputStyle}
                                      />
                                      {savedId === `${DEPT_NAME_KEY}:${d.idx}` && (
                                        <div style={{ color: GOLD, fontSize: 12, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>Saved</div>
                                      )}
                                    </div>
                                    <div style={numberCellStyle('count')}>
                                      <label htmlFor={`dept-hours-${d.idx}`} style={numberLabelStyle}>
                                        Hours this quarter
                                      </label>
                                      <input
                                        id={`dept-hours-${d.idx}`}
                                        type="text"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        value={d.hours}
                                        onChange={(e) => changeDeptHours(d.idx, e.target.value)}
                                        onBlur={(e) => saveNumber(DEPT_HOURS_KEY, d.idx, e.target.value)}
                                        style={numberInputStyle}
                                      />
                                      {savedId === `${DEPT_HOURS_KEY}:${d.idx}` && (
                                        <div style={{ color: GOLD, fontSize: 12, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>Saved</div>
                                      )}
                                    </div>
                                    {pos > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => removeDepartment(d.idx)}
                                        aria-label={`Remove department ${pos + 1}`}
                                        style={{ ...removeButtonStyle, alignSelf: 'flex-start', marginTop: 20, height: 42 }}
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={addDepartment}
                                  disabled={deptRows.length >= MAX_DEPARTMENTS}
                                  style={addButtonStyle}
                                >
                                  Add another department
                                </button>
                              </div>
                            )}

                            {isResultsValueQuestion && (
                              <div style={{ marginTop: 10 }}>
                                {resultBoxes.map((b, pos) => (
                                  <div key={b.idx} style={{ ...numberRowStyle, marginTop: pos === 0 ? 0 : 12 }}>
                                    <div style={numberCellStyle('money')}>
                                      <label htmlFor={`num-results-${b.idx}`} style={numberLabelStyle}>
                                        Initiative {pos + 1} value ($)
                                      </label>
                                      <input
                                        id={`num-results-${b.idx}`}
                                        type="text"
                                        inputMode="decimal"
                                        autoComplete="off"
                                        value={b.value}
                                        onChange={(e) => changeResult(b.idx, e.target.value)}
                                        onBlur={(e) => saveNumber(RESULTS_KEY, b.idx, e.target.value)}
                                        style={numberInputStyle}
                                      />
                                      {savedId === `${RESULTS_KEY}:${b.idx}` && (
                                        <div style={{ color: GOLD, fontSize: 12, marginTop: 4, fontFamily: 'Inter, sans-serif' }}>Saved</div>
                                      )}
                                    </div>
                                    {pos > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => removeInitiative(b.idx)}
                                        aria-label={`Remove initiative ${pos + 1}`}
                                        style={{ ...removeButtonStyle, alignSelf: 'flex-start', marginTop: 20, height: 42 }}
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={addInitiative}
                                  disabled={resultBoxes.length >= MAX_INITIATIVES}
                                  style={addButtonStyle}
                                >
                                  Add another initiative
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* Closing */}
        {diagnosticTier && (
          <div
            style={{
              backgroundColor: MAGENTA,
              padding: 24,
              borderRadius: 4,
              marginBottom: 32,
            }}
          >
            <p style={{ margin: 0, color: WARM_WHITE, fontFamily: 'Playfair Display, serif', fontSize: 16, lineHeight: 1.6 }}>
              {CLOSING_TEXT[diagnosticTier]}
            </p>
          </div>
        )}

        {isComplete && numbersComplete && (
          <div style={{ textAlign: 'center', padding: 24, border: `1px solid ${GOLD}`, borderRadius: 4, marginBottom: 24 }}>
            <p style={{ margin: 0, color: GOLD, fontFamily: 'Inter, sans-serif', fontSize: 15 }}>
              Complete — every question has an answer on file. See you on the call.
            </p>
          </div>
        )}

        {/* Submit */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{ ...submitButtonStyle, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
          >
            Submit
          </button>
          {!canSubmit && (
            <div style={{ color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 13, marginTop: 10 }}>
              {answeredCount} of {totalCount} answers and {numbersFilled} of {numbersTotal} number boxes filled.
            </div>
          )}
          {submittedAt && (
            <div style={{ color: GOLD, fontFamily: 'Inter, sans-serif', fontSize: 13, marginTop: 10 }}>
              Submitted {new Date(submittedAt).toLocaleString()}
            </div>
          )}
          {submitNote && (
            <div style={{ color: BODY_TEXT_ON_NAVY, fontFamily: 'Inter, sans-serif', fontSize: 13, marginTop: 10 }}>{submitNote}</div>
          )}
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  backgroundColor: NAVY,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
};

const headingStyle: React.CSSProperties = {
  color: GOLD,
  fontFamily: 'Playfair Display, serif',
  fontWeight: 700,
  margin: 0,
};

const reminderBoxStyle: React.CSSProperties = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(212,175,55,0.3)',
  borderRadius: 4,
  padding: 16,
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: WARM_WHITE,
  color: '#2C2C2C',
  border: '1px solid rgba(212,175,55,0.5)',
  borderRadius: 4,
  padding: 10,
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  resize: 'vertical',
};

const numberRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 14,
  marginTop: 10,
};

// Boxes are sized to the answer they hold: short for counts, wider for dollar amounts.
const numberCellStyle = (size: 'count' | 'money' | 'wide'): React.CSSProperties => ({
  flex: '0 0 auto',
  width: size === 'wide' ? 220 : size === 'money' ? 190 : 130,
  maxWidth: '100%',
});

const numberLabelStyle: React.CSSProperties = {
  display: 'block',
  color: BODY_TEXT_ON_NAVY,
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  marginBottom: 4,
};

const numberInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  backgroundColor: WARM_WHITE,
  color: '#2C2C2C',
  border: '1px solid rgba(212,175,55,0.5)',
  borderRadius: 4,
  padding: 10,
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
};

const addButtonStyle: React.CSSProperties = {
  marginTop: 12,
  backgroundColor: 'transparent',
  color: GOLD,
  border: `1px solid ${GOLD}`,
  borderRadius: 4,
  padding: '8px 14px',
  fontFamily: 'Inter, sans-serif',
  fontSize: 13,
  cursor: 'pointer',
};

const removeButtonStyle: React.CSSProperties = {
  backgroundColor: 'transparent',
  color: BODY_TEXT_ON_NAVY,
  border: '1px solid rgba(232,232,232,0.5)',
  borderRadius: 4,
  padding: '8px 10px',
  fontFamily: 'Inter, sans-serif',
  fontSize: 12,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const submitButtonStyle: React.CSSProperties = {
  backgroundColor: GOLD,
  color: NAVY,
  border: 'none',
  borderRadius: 4,
  padding: '14px 40px',
  fontFamily: 'Inter, sans-serif',
  fontSize: 16,
  fontWeight: 700,
};
