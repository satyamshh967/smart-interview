import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, CheckCircle2 } from 'lucide-react';
import { Problem, InterviewSession, EvaluationResult } from '../types';
import { CodeEditor } from './CodeEditor';
import { ConsoleOutput } from './ConsoleOutput';
import { VideoRecorder } from './VideoRecorder';
import { Timer } from './Timer';
import { evaluateCodeSubmission } from '../services/api';
import { useDialog } from '../hooks/useDialog';

interface InterviewRoomProps {
  interview: InterviewSession | null;
  problems: Problem[];
  onStartNewSession: (track: string, difficulty: string) => void;
  onFinishInterview: (transcript: string, timeTakenSec: number) => void;
  isStarting: boolean;
  isFinishing?: boolean;
  candidateName?: string;
}

type ProblemStatus = { passed: number; total: number; accepted: boolean };

const draftKey = (interviewId: string) => `interview-draft:${interviewId}`;
const DRAFT_SAVE_DELAY_MS = 500;

function loadDraft(interviewId?: string): { codeMap: Record<string, string>; language: string } {
  if (!interviewId) return { codeMap: {}, language: 'python' };
  try {
    const raw = localStorage.getItem(draftKey(interviewId));
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        codeMap: parsed && typeof parsed.codeMap === 'object' ? parsed.codeMap : {},
        language: typeof parsed?.language === 'string' ? parsed.language : 'python'
      };
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { codeMap: {}, language: 'python' };
}

export const InterviewRoom = memo(function InterviewRoom(props: InterviewRoomProps) {
  if (!props.interview || props.problems.length === 0) {
    return <StartScreen onStartNewSession={props.onStartNewSession} isStarting={props.isStarting} />;
  }
  return <ActiveRoom {...props} interview={props.interview} />;
});

/* -------------------------------------------------------------------------- */
/* Start screen                                                               */
/* -------------------------------------------------------------------------- */

function StartScreen({
  onStartNewSession,
  isStarting
}: Pick<InterviewRoomProps, 'onStartNewSession' | 'isStarting'>) {
  const [newDifficulty, setNewDifficulty] = useState<string>('Medium');
  const [newTrack, setNewTrack] = useState<string>('Fullstack & Algorithms');

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="text-center max-w-xl mx-auto mb-10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold mb-4">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          <span>AI-Powered Technical Assessment</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-3">
          Start Your Technical Interview Simulation
        </h1>
        <p className="text-slate-400 text-sm leading-relaxed">
          Practice realistic timed coding interviews with multi-language code execution and real-time verbal communication evaluation.
        </p>
      </div>

      <div className="bg-[#0D121F] rounded-2xl border border-white/5 p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label htmlFor="room-track-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Interview Track
            </label>
            <select
              id="room-track-select"
              value={newTrack}
              onChange={(e) => setNewTrack(e.target.value)}
              className="w-full bg-[#090D16] border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-teal-500 font-medium"
            >
              <option value="Fullstack & Algorithms">Fullstack Software Engineering</option>
              <option value="Backend Systems & Architecture">Backend Systems & Distributed Logic</option>
              <option value="Data Structures & Algorithms">Core DSA (Arrays, Stacks, Trees)</option>
            </select>
          </div>

          <div>
            <span id="room-difficulty-label" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Target Difficulty
            </span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="room-difficulty-label">
              {['Easy', 'Medium', 'Hard'].map((diff) => (
                <button
                  key={diff}
                  type="button"
                  role="radio"
                  aria-checked={newDifficulty === diff}
                  onClick={() => setNewDifficulty(diff)}
                  className={`py-3 px-3 rounded-xl text-xs font-semibold border transition-colors ${
                    newDifficulty === diff
                      ? 'bg-teal-600 border-teal-500 text-white shadow-lg shadow-teal-500/20'
                      : 'bg-[#090D16] border-white/5 text-slate-400 hover:text-slate-200 hover:border-white/10'
                  }`}
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Included Features Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/5">
          <div className="p-3.5 bg-[#090D16] rounded-xl border border-white/5">
            <span className="text-xs font-semibold text-slate-200 block mb-1">C++ Evaluation Engine</span>
            <p className="text-[11px] text-slate-400 leading-normal">
              Fast test suite execution with time, memory and process-count limits.
            </p>
          </div>
          <div className="p-3.5 bg-[#090D16] rounded-xl border border-white/5">
            <span className="text-xs font-semibold text-slate-200 block mb-1">Python NLP Analysis</span>
            <p className="text-[11px] text-slate-400 leading-normal">
              Speech-to-text scoring evaluating Big-O articulation, clarity, and structural coherence.
            </p>
          </div>
          <div className="p-3.5 bg-[#090D16] rounded-xl border border-white/5">
            <span className="text-xs font-semibold text-slate-200 block mb-1">Detailed Scorecard</span>
            <p className="text-[11px] text-slate-400 leading-normal">
              Multi-dimensional radar competency metrics, strengths, and areas for improvement.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onStartNewSession(newTrack, newDifficulty)}
          disabled={isStarting}
          aria-busy={isStarting}
          className="w-full py-3.5 px-6 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-teal-600 via-teal-500 to-teal-600 hover:from-teal-500 hover:to-teal-400 shadow-xl shadow-teal-500/25 transition-[transform,background-color] active:scale-[0.99] disabled:opacity-50"
        >
          {isStarting ? 'Preparing Interview Room…' : 'Enter Interview Room & Start Timer'}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Problem statement (memoized: does not re-render while typing)              */
/* -------------------------------------------------------------------------- */

const ProblemPanel = memo(function ProblemPanel({ problem }: { problem: Problem }) {
  return (
    <section
      aria-labelledby="problem-title"
      className="lg:col-span-4 bg-[#0D121F] rounded-2xl border border-white/5 p-5 h-[calc(100vh-170px)] overflow-y-auto space-y-4 shadow-xl"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
            problem.difficulty === 'Easy'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : problem.difficulty === 'Medium'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}>
            {problem.difficulty}
          </span>
          <span className="text-[11px] text-slate-400">{problem.category}</span>
        </div>
        <h1 id="problem-title" className="text-xl font-bold text-white tracking-tight">{problem.title}</h1>
      </div>

      <div className="text-slate-300 text-xs leading-relaxed space-y-3 whitespace-pre-wrap font-sans">
        {problem.description}
      </div>

      <div className="space-y-3 pt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Examples</h2>
        {problem.examples.map((ex, i) => (
          <div key={i} className="p-3 bg-[#090D16] rounded-xl border border-white/5 space-y-1.5 text-xs font-mono">
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Input</span>
              <span className="text-slate-200">{ex.input}</span>
            </div>
            <div>
              <span className="text-slate-400 font-bold block text-[10px] uppercase">Output</span>
              <span className="text-emerald-400 font-semibold">{ex.output}</span>
            </div>
            {ex.explanation && (
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase font-sans">Explanation</span>
                <span className="text-slate-400 font-sans text-[11px]">{ex.explanation}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="pt-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Constraints</h2>
        <ul className="space-y-1 text-xs font-mono text-slate-400 list-disc list-inside">
          {problem.constraints.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      </div>

      <div className="p-3 bg-teal-950/20 rounded-xl border border-teal-500/20 text-xs">
        <div className="flex items-center gap-1.5 text-teal-300 font-semibold mb-1">
          <Sparkles className="w-3.5 h-3.5 text-teal-400" aria-hidden="true" />
          <span>Interviewer Tip</span>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed">
          State your time and space complexity explicitly before writing code. Use the explanation box to articulate your thought process.
        </p>
      </div>
    </section>
  );
});

/* -------------------------------------------------------------------------- */
/* End-interview confirmation dialog                                          */
/* -------------------------------------------------------------------------- */

function FinishDialog({
  unsubmitted,
  onCancel,
  onConfirm
}: {
  unsubmitted: string[];
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialog(ref, onCancel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="finish-title"
        aria-describedby="finish-desc"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0D121F] max-w-md w-full p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4"
      >
        <h2 id="finish-title" className="text-base font-bold text-white">Conclude Technical Interview?</h2>
        <p id="finish-desc" className="text-xs text-slate-300 leading-relaxed">
          Submitting now will finalize all code solutions, evaluate hidden edge cases with the C++ engine, and generate your NLP communication scorecard.
        </p>
        {unsubmitted.length > 0 && (
          <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            No full submission yet for: {unsubmitted.join(', ')}. Unsubmitted problems score zero for correctness.
          </p>
        )}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            data-autofocus
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Continue Interview
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-xl shadow-lg shadow-teal-500/20 transition-colors"
          >
            Submit &amp; View Scorecard
          </button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Active interview                                                           */
/* -------------------------------------------------------------------------- */

function ActiveRoom({
  interview,
  problems,
  onFinishInterview,
  isFinishing = false,
  candidateName
}: InterviewRoomProps & { interview: InterviewSession }) {
  const [initialDraft] = useState(() => loadDraft(interview.id));
  const [activeProblemIndex, setActiveProblemIndex] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialDraft.language);
  // Code drafts keyed by "problemId:language" so switching problems/languages never loses work
  const [codeMap, setCodeMap] = useState<Record<string, string>>(initialDraft.codeMap);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [problemStatus, setProblemStatus] = useState<Record<string, ProblemStatus>>({});
  const [showFinishConfirm, setShowFinishConfirm] = useState<boolean>(false);

  const currentProblem = problems[activeProblemIndex] || problems[0];
  const codeKey = `${currentProblem.id}:${selectedLanguage}`;
  const currentCode =
    codeMap[codeKey] ??
    (currentProblem.starterCode[selectedLanguage as keyof typeof currentProblem.starterCode] || '');

  // Refs: latest values for stable callbacks and the timer-expiry handler
  const transcriptRef = useRef<string>('');
  const elapsedRef = useRef<number>(0);
  const finishedRef = useRef<boolean>(false);
  const codeRef = useRef(currentCode);
  codeRef.current = currentCode;
  const codeKeyRef = useRef(codeKey);
  codeKeyRef.current = codeKey;
  const problemIdRef = useRef(currentProblem.id);
  problemIdRef.current = currentProblem.id;
  const onFinishRef = useRef(onFinishInterview);
  onFinishRef.current = onFinishInterview;

  // Autosave drafts per interview (debounced: not on every keystroke)
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey(interview.id), JSON.stringify({ codeMap, language: selectedLanguage }));
      } catch {
        /* ignore quota / private mode errors */
      }
    }, DRAFT_SAVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [codeMap, selectedLanguage, interview.id]);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setShowFinishConfirm(false);
    onFinishRef.current(transcriptRef.current, elapsedRef.current);
  }, []);

  // If finishing failed (still mounted, no longer finishing), allow another attempt
  const wasFinishingRef = useRef(false);
  useEffect(() => {
    if (wasFinishingRef.current && !isFinishing) finishedRef.current = false;
    wasFinishingRef.current = isFinishing;
  }, [isFinishing]);

  const handleCodeChange = useCallback((newCode: string) => {
    const key = codeKeyRef.current;
    setCodeMap((prev) => ({ ...prev, [key]: newCode }));
  }, []);

  const handleResetCode = useCallback(() => {
    const key = codeKeyRef.current;
    setCodeMap((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const runEvaluation = useCallback(async (codeToRun: string, lang: string, isSampleOnly: boolean) => {
    const problemId = problemIdRef.current;
    setIsEvaluating(true);
    setEvalResult(null);
    setEvalError(null);
    try {
      const res = await evaluateCodeSubmission({
        interviewId: interview.id,
        problemId,
        language: lang,
        code: codeToRun,
        isSampleOnly
      });
      setEvalResult(res.evaluation);
      if (!isSampleOnly) {
        const ev = res.evaluation;
        setProblemStatus((prev) => {
          const existing = prev[problemId];
          // Keep the best submission per problem
          if (existing && existing.passed >= ev.passedTestCases) return prev;
          return {
            ...prev,
            [problemId]: { passed: ev.passedTestCases, total: ev.totalTestCases, accepted: ev.status === 'ACCEPTED' }
          };
        });
      }
    } catch (err: any) {
      setEvalError(err?.message || (isSampleOnly ? 'Failed to run sample tests' : 'Failed to submit solution'));
    } finally {
      setIsEvaluating(false);
    }
  }, [interview.id]);

  const handleRunSampleTests = useCallback((c: string, l: string) => runEvaluation(c, l, true), [runEvaluation]);
  const handleSubmitFullSolution = useCallback((c: string, l: string) => runEvaluation(c, l, false), [runEvaluation]);
  const getCode = useCallback(() => codeRef.current, []);
  const handleTranscriptChange = useCallback((t: string) => { transcriptRef.current = t; }, []);
  const handleSecondsUpdated = useCallback((sec: number) => { elapsedRef.current = sec; }, []);
  const closeFinishDialog = useCallback(() => setShowFinishConfirm(false), []);

  return (
    <div className="max-w-[1720px] mx-auto px-4 lg:px-6 py-4 space-y-4">
      {/* Top Session Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0D121F] p-3 rounded-2xl border border-white/5 shadow-md">
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <h2 className="text-sm font-bold text-white tracking-tight">{interview.title}</h2>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="text-teal-400 font-medium">{interview.track}</span>
              <span aria-hidden="true">&bull;</span>
              <span className="text-slate-300">{interview.difficulty}</span>
            </div>
          </div>

          <div className="h-6 w-[1px] bg-white/10 hidden sm:block" aria-hidden="true" />

          {/* Problem Tabs */}
          <div className="flex items-center gap-1.5 bg-[#090D16] p-1 rounded-xl border border-white/5" role="tablist" aria-label="Interview problems">
            {problems.map((p, idx) => {
              const status = problemStatus[p.id];
              const statusText = status
                ? status.accepted ? 'solved' : `${status.passed} of ${status.total} tests passed`
                : 'not submitted';
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeProblemIndex === idx}
                  aria-label={`Question ${idx + 1}: ${p.title}, ${statusText}`}
                  key={p.id}
                  onClick={() => {
                    setActiveProblemIndex(idx);
                    setEvalResult(null);
                    setEvalError(null);
                  }}
                  title={status ? `Best submission: ${status.passed}/${status.total} tests` : 'Not submitted yet'}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    activeProblemIndex === idx
                      ? 'bg-teal-600 text-white shadow-sm shadow-teal-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {status?.accepted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
                  ) : status ? (
                    <span className="text-[10px] font-mono text-amber-300" aria-hidden="true">
                      {status.passed}/{status.total}
                    </span>
                  ) : null}
                  <span aria-hidden="true">Q{idx + 1}: {p.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Timer
            initialMinutes={interview.timeLimitMinutes || 35}
            onSecondsUpdated={handleSecondsUpdated}
            onTimeExpired={finish}
          />

          <button
            type="button"
            onClick={() => setShowFinishConfirm(true)}
            disabled={isFinishing}
            aria-busy={isFinishing}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 active:scale-95 transition-[background-color,transform] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFinishing ? 'Scoring…' : 'End Interview'}
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <ProblemPanel problem={currentProblem} />

        <div className="lg:col-span-5 flex flex-col gap-4 h-[calc(100vh-170px)]">
          <div className="flex-1 min-h-[380px]">
            <CodeEditor
              value={currentCode}
              onCodeChange={handleCodeChange}
              language={selectedLanguage}
              onLanguageChange={setSelectedLanguage}
              onRunSample={handleRunSampleTests}
              onSubmitFull={handleSubmitFullSolution}
              onReset={handleResetCode}
              isEvaluating={isEvaluating}
              statusBadge={evalResult?.status}
            />
          </div>

          <div className="h-64">
            <ConsoleOutput result={evalResult} isEvaluating={isEvaluating} error={evalError} />
          </div>
        </div>

        <div className="lg:col-span-3 h-[calc(100vh-170px)] overflow-y-auto">
          <VideoRecorder
            interviewId={interview.id}
            candidateName={candidateName || interview.candidateName}
            problemId={currentProblem.id}
            getCode={getCode}
            onTranscriptChange={handleTranscriptChange}
          />
        </div>
      </div>

      {showFinishConfirm && (
        <FinishDialog
          unsubmitted={problems.filter((p) => !problemStatus[p.id]).map((p) => p.title)}
          onCancel={closeFinishDialog}
          onConfirm={finish}
        />
      )}
    </div>
  );
}
