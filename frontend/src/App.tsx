import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { Sidebar } from './components/Sidebar';
import { TopHeader } from './components/TopHeader';
import { CandidateListCard, CandidateItem } from './components/CandidateListCard';
import { VideoStage } from './components/VideoStage';
import { TeamFeedbackCard } from './components/TeamFeedbackCard';
import { QuestionRoadmapCard } from './components/QuestionRoadmapCard';
import { AIScoreSummaryCard } from './components/AIScoreSummaryCard';
import { MetricDonutCard } from './components/MetricDonutCard';
import { CodeModal } from './components/CodeModal';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { HistoryView } from './components/HistoryView';
import { RecruiterView } from './components/RecruiterView';
import { CandidatesView } from './components/CandidatesView';
import { QuestionBankView } from './components/QuestionBankView';
import { SettingsView } from './components/SettingsView';
import { InterviewRoom } from './components/InterviewRoom';
import { TakeInterviewBanner } from './components/TakeInterviewBanner';
import { TakeInterviewModal } from './components/TakeInterviewModal';
import { ThemeSelectorModal, ThemeMode, AccentColor } from './components/ThemeSelectorModal';
import { Problem, InterviewSession, ScoreRecord, Candidate } from './types';
import {
  fetchQuestions,
  fetchCandidates,
  startInterviewSession,
  finishInterviewSession,
  fetchInterviewResult
} from './services/api';

const safeStorageGet = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeStorageSet = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
};

const statusFromScore = (score: number | null | undefined): CandidateItem['status'] =>
  score == null ? 'Pending' : score >= 70 ? 'Approved' : 'Rejected';

/** Converts a backend candidate (with stats) into the list-card shape. */
const toCandidateItem = (c: Candidate): CandidateItem => ({
  id: c.id,
  name: c.name,
  role: c.role,
  avatar: c.avatar,
  score: c.stats?.latestScore ?? 0,
  status: statusFromScore(c.stats?.latestScore),
  latestInterviewId: c.stats?.latestInterviewId ?? null
});

/** Illustrative scorecard for built-in demo profiles that have no backend record. */
const buildSampleScore = (cand: CandidateItem): ScoreRecord => ({
  id: `sample-${cand.id}`,
  interviewId: `sample-${cand.id}`,
  candidateId: cand.id,
  overallScore: cand.score,
  codeCorrectnessScore: Math.min(100, cand.score + 3),
  codeEfficiencyScore: Math.min(100, cand.score + 7),
  communicationScore: Math.max(0, cand.score - 7),
  timeManagementScore: cand.score,
  totalTestCases: 4,
  passedTestCases: Math.round((Math.min(100, cand.score + 3) / 100) * 4),
  strengths: [
    'Strong algorithmic reasoning with explicit O(n) linear time complexity analysis.',
    'Clear and structured problem-solving approach.'
  ],
  improvements: ['Elaborate more on negative and duplicate integer edge cases.'],
  competencies: {
    algorithms: Math.min(100, cand.score + 5),
    problemSolving: Math.min(100, cand.score + 2),
    codeQuality: Math.min(100, cand.score + 4),
    verbalArticulation: Math.max(0, cand.score - 7),
    speedAndTime: cand.score
  },
  createdAt: new Date().toISOString()
});

type Toast = { id: number; kind: 'error' | 'success' | 'info'; message: string };

const INITIAL_CANDIDATES: CandidateItem[] = [
  {
    id: 'cand-1',
    name: 'Seo Jan Im',
    role: 'Fullstack Talent',
    status: 'Approved',
    score: 85,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120&auto=format&fit=crop&q=80'
  },
  {
    id: 'cand-2',
    name: 'Devon Lane',
    role: 'Backend Specialist',
    status: 'Rejected',
    score: 55,
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop&q=80'
  },
  {
    id: 'cand-3',
    name: 'Arlene McCoy',
    role: 'Algorithms Engineer',
    status: 'Approved',
    score: 95,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80'
  },
  {
    id: 'cand-4',
    name: 'Esther Howard',
    role: 'System Architect',
    status: 'Rejected',
    score: 48,
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=80'
  },
  {
    id: 'cand-5',
    name: 'Jane Coper',
    role: 'Fullstack Developer',
    status: 'Approved',
    score: 78,
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&auto=format&fit=crop&q=80'
  }
];

const ACCENT_MAP: Record<AccentColor, { [shade: number]: string }> = {
  blue: {
    50: '239 246 255',
    100: '219 234 254',
    200: '191 219 254',
    300: '147 197 253',
    400: '96 165 250',
    500: '59 130 246',
    600: '37 99 235',
    700: '29 78 216',
    800: '30 64 175',
    900: '30 58 138',
    950: '23 37 84'
  },
  teal: {
    50: '240 253 250',
    100: '204 251 241',
    200: '153 246 228',
    300: '94 234 212',
    400: '45 212 191',
    500: '20 184 166',
    600: '13 148 136',
    700: '15 118 110',
    800: '17 94 89',
    900: '19 78 74',
    950: '4 47 46'
  },
  emerald: {
    50: '236 253 245',
    100: '209 250 229',
    200: '167 243 208',
    300: '110 231 183',
    400: '52 211 153',
    500: '16 185 129',
    600: '5 150 105',
    700: '4 120 87',
    800: '6 95 70',
    900: '6 78 59',
    950: '2 44 34'
  },
  cyan: {
    50: '236 254 255',
    100: '207 250 254',
    200: '165 243 252',
    300: '103 232 249',
    400: '34 211 238',
    500: '6 182 212',
    600: '8 145 178',
    700: '14 116 144',
    800: '21 94 117',
    900: '22 78 99',
    950: '8 51 68'
  },
  amber: {
    50: '255 251 235',
    100: '254 243 199',
    200: '253 230 138',
    300: '252 211 77',
    400: '251 191 36',
    500: '245 158 11',
    600: '217 119 6',
    700: '180 83 9',
    800: '146 64 14',
    900: '120 53 15',
    950: '69 26 3'
  },
  slate: {
    50: '248 250 252',
    100: '241 245 249',
    200: '226 232 240',
    300: '203 213 225',
    400: '148 163 184',
    500: '100 116 139',
    600: '71 85 105',
    700: '51 65 85',
    800: '30 41 59',
    900: '15 23 42',
    950: '2 6 23'
  }
};

export function App() {
  // Theme state: restore saved preference, default to 'light' (Clean All-White)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = safeStorageGet('app-theme-mode');
    return saved === 'dark' || saved === 'contrast' || saved === 'light' ? (saved as ThemeMode) : 'light';
  });
  const [accentColor, setAccentColor] = useState<AccentColor>(() => {
    const saved = safeStorageGet('app-accent-color');
    if (saved && ['blue', 'teal', 'emerald', 'cyan', 'amber', 'slate'].includes(saved)) {
      return saved as AccentColor;
    }
    return 'blue';
  });

  const [activeView, setActiveView] = useState<string>('dashboard');
  const sampleCandidates = useMemo(
    () => INITIAL_CANDIDATES.map((c) => ({ ...c, isSample: true })),
    []
  );
  const [candidatesList, setCandidatesList] = useState<CandidateItem[]>(sampleCandidates);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateItem>(sampleCandidates[0]);
  const [activeStep, setActiveStep] = useState<number>(2);

  // Question & Code sandbox states
  const [bankProblems, setBankProblems] = useState<Problem[]>([]);
  const [interviewProblems, setInterviewProblems] = useState<Problem[]>([]);
  const [sandboxProblem, setSandboxProblem] = useState<Problem | null>(null);
  const [isCodeModalOpen, setIsCodeModalOpen] = useState<boolean>(false);
  const [activeInterview, setActiveInterview] = useState<InterviewSession | null>(null);

  // Scorecard currently shown in the analytics view
  const [scorecard, setScorecard] = useState<{ score: ScoreRecord; interview: InterviewSession | null; isSample?: boolean } | null>(null);
  const [isLoadingScorecard, setIsLoadingScorecard] = useState<boolean>(false);

  // Modals
  const [isTakeInterviewModalOpen, setIsTakeInterviewModalOpen] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [isStartingInterview, setIsStartingInterview] = useState<boolean>(false);
  const [isFinishingInterview, setIsFinishingInterview] = useState<boolean>(false);

  // Lightweight toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);
  const notify = useCallback((kind: Toast['kind'], message: string) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev.slice(-2), { id, kind, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 5000);
  }, []);

  /** Loads candidates from the backend; real candidates are listed before demo profiles. */
  const loadCandidates = useCallback(async () => {
    try {
      const data = await fetchCandidates(true);
      if (Array.isArray(data) && data.length > 0) {
        const real = data.map(toCandidateItem);
        setCandidatesList([...real, ...sampleCandidates]);
        setSelectedCandidate((prev) => real.find((c) => c.id === prev.id) || (prev.isSample ? real[0] : prev));
      }
    } catch (e) {
      console.warn('Could not load candidates from API, using demo profiles:', e);
    }
  }, [sampleCandidates]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Sync theme with DOM
  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    safeStorageSet('app-theme-mode', themeMode);
  }, [themeMode]);

  // Apply accent directly to DOM root style & attribute
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-accent', accentColor);
    const shades = ACCENT_MAP[accentColor] || ACCENT_MAP.blue;
    Object.entries(shades).forEach(([shade, rgb]) => {
      root.style.setProperty(`--color-accent-${shade}`, rgb);
    });
    safeStorageSet('app-accent-color', accentColor);
  }, [accentColor]);

  const toggleTheme = () => {
    setThemeMode(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    const loadProblems = async () => {
      try {
        const data = await fetchQuestions();
        if (data && data.length > 0) {
          setBankProblems(data);
        }
      } catch (e) {
        console.error('Error fetching questions:', e);
      }
    };
    loadProblems();
  }, []);

  const handleStartInterview = async (track: string, difficulty: string) => {
    if (isStartingInterview) return;
    setIsStartingInterview(true);
    try {
      const data = await startInterviewSession({
        candidateId: selectedCandidate.id,
        difficulty,
        track
      });
      setActiveInterview(data.interview);
      setInterviewProblems(data.problems || []);
      setIsTakeInterviewModalOpen(false);
      setActiveView('interview');
      notify('info', `Interview started for ${data.candidate?.name || selectedCandidate.name}. Good luck!`);
    } catch (err: any) {
      notify('error', `Could not start interview: ${err?.message || 'unknown error'}`);
    } finally {
      setIsStartingInterview(false);
    }
  };

  const handleFinishInterview = async (transcript: string, timeTakenSeconds: number) => {
    if (!activeInterview) return;
    setIsFinishingInterview(true);
    try {
      const data = await finishInterviewSession({
        interviewId: activeInterview.id,
        communicationTranscript: transcript,
        timeTakenSeconds
      });
      setScorecard({ score: data.score, interview: data.interview });
      try {
        localStorage.removeItem(`interview-draft:${activeInterview.id}`);
      } catch {
        /* ignore */
      }
      setActiveInterview(null);
      setInterviewProblems([]);
      setActiveView('analytics');
      notify('success', `Interview scored: ${data.score.overallScore}/100`);
      loadCandidates();
    } catch (err: any) {
      notify('error', `Failed to finalize interview: ${err?.message || 'unknown error'}`);
    } finally {
      setIsFinishingInterview(false);
    }
  };

  /** Loads a stored interview's scorecard and opens the analytics view. */
  const openInterviewScorecard = async (interviewId: string) => {
    setIsLoadingScorecard(true);
    setActiveView('analytics');
    try {
      const data = await fetchInterviewResult(interviewId);
      if (data.score) {
        setScorecard({ score: data.score, interview: data.interview });
      } else {
        setScorecard(null);
        notify('info', 'This interview has not been scored yet.');
      }
    } catch (err: any) {
      notify('error', `Could not load scorecard: ${err?.message || 'unknown error'}`);
    } finally {
      setIsLoadingScorecard(false);
    }
  };

  const openCandidateScorecard = (cand: CandidateItem) => {
    setSelectedCandidate(cand);
    if (cand.latestInterviewId) {
      openInterviewScorecard(cand.latestInterviewId);
    } else if (cand.isSample) {
      setScorecard({ score: buildSampleScore(cand), interview: null, isSample: true });
      setActiveView('analytics');
    } else {
      setScorecard(null);
      setActiveView('analytics');
    }
  };

  const activeProblem: Problem = sandboxProblem || bankProblems[0] || {
    id: 'prob-001',
    title: 'Two Sum',
    slug: 'two-sum',
    difficulty: 'Easy',
    category: 'Arrays & Hash Tables',
    timeLimitMinutes: 15,
    description: 'Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.',
    examples: [{ input: 'nums = [2,7,11,15], target = 9', output: '[0, 1]' }],
    constraints: ['2 <= nums.length <= 10^4'],
    starterCode: { python: 'import sys, json\n# Two Sum solution' },
    sampleTestCases: [{ id: 'tc-1', input: '[2,7,11,15]\n9', expectedOutput: '[0, 1]' }]
  };

  const bgCanvasClass = themeMode === 'dark'
    ? 'bg-[#090D16]'
    : themeMode === 'contrast'
    ? 'bg-[#F1F3F7]'
    : 'bg-[#FFFFFF]'; // All white!

  return (
    <div className={`flex h-screen w-screen overflow-hidden ${bgCanvasClass} font-sans transition-colors`}>
      {/* 1. Left Icon Rail Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={(view) => setActiveView(view)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* 2. Top Header Bar */}
        <TopHeader
          theme={themeMode}
          toggleTheme={toggleTheme}
          roleTitle={
            activeView === 'candidates' ? 'Candidate Review & Profiles' :
            activeView === 'questions' ? 'Technical Problem Bank' :
            activeView === 'analytics' ? 'Evaluation Scorecard' :
            activeView === 'settings' ? 'Platform Settings & Config' :
            activeView === 'interview' ? 'Live Technical Assessment Room' :
            activeView === 'recruiter' ? 'Institutional Placement Portal' :
            'Assessment & Review Stage'
          }
          onOpenCodeEditor={() => setIsCodeModalOpen(true)}
          onOpenTakeInterview={() => setIsTakeInterviewModalOpen(true)}
          onOpenThemeModal={() => setIsThemeModalOpen(true)}
          onBack={() => setActiveView('dashboard')}
          onNavigate={(view) => setActiveView(view)}
        />

        {/* 3. Main Stage Content */}
        <main className="flex-1 p-5 md:p-6 lg:p-7 overflow-y-auto space-y-6">
          {/* Home Page: Dashboard Overview */}
          {activeView === 'dashboard' && (
            <>
              {/* Home Page Top Banner: Various Options to Take Interview */}
              <TakeInterviewBanner
                onQuickStart={handleStartInterview}
                onOpenCustomModal={() => setIsTakeInterviewModalOpen(true)}
              />

              {/* Top Tier: All Candidates Panel (Left) & Video Stage (Right) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                {/* Left: All Candidates Panel (4 cols) */}
                <div className="lg:col-span-4 h-full min-h-[380px]">
                  <CandidateListCard
                    candidates={candidatesList}
                    selectedId={selectedCandidate.id}
                    onSelectCandidate={(cand) => setSelectedCandidate(cand)}
                  />
                </div>

                {/* Right: Main Video Player Stage (8 cols) */}
                <div className="lg:col-span-8 h-full">
                  <VideoStage
                    candidate={selectedCandidate}
                    questionNumber={activeStep}
                    questionTitle={
                      activeStep === 2
                        ? "Question 2: Why do you think you are good at technical problem solving and sales?"
                        : "Question 1: Tell us about your background and engineering projects?"
                    }
                    transcript="I'm an extremely ambitious person which motivates me in my professional life. In this problem, my approach uses a hash map to achieve O(n) linear time complexity and avoids the O(n^2) brute-force nested loop."
                    onOpenCodeEditor={() => setIsCodeModalOpen(true)}
                  />
                </div>
              </div>

              {/* Bottom Tier: 4 Metric & Feedback Cards in a Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
                {/* 1. Team Feedback */}
                <TeamFeedbackCard />

                {/* 2. Question List / Roadmap */}
                <QuestionRoadmapCard
                  activeStep={activeStep}
                  onSelectStep={(step) => {
                    setActiveStep(step);
                    if (step === 2 || step === 3) {
                      setIsCodeModalOpen(true);
                    }
                  }}
                />

                {/* 3. AI Score Summary */}
                <AIScoreSummaryCard
                  score={selectedCandidate.score}
                  summaryText="The presentation of talent is good. Algorithmic trade-offs and Big-O complexity are articulated cleanly."
                  onHireTalent={() => openCandidateScorecard(selectedCandidate)}
                />

                {/* 4. AI Video Score Detail (4 Donut Rings) */}
                <MetricDonutCard
                  metrics={{
                    correctness: 80,
                    complexity: 90,
                    communication: 65,
                    speed: 85
                  }}
                  onRefresh={() => {
                    loadCandidates();
                  }}
                  onExpand={() => openCandidateScorecard(selectedCandidate)}
                />
              </div>
            </>
          )}

          {/* Live Technical Assessment Room */}
          {activeView === 'interview' && (
            <InterviewRoom
              key={activeInterview?.id || 'no-interview'}
              interview={activeInterview}
              problems={interviewProblems}
              candidateName={activeInterview?.candidateName}
              onStartNewSession={handleStartInterview}
              onFinishInterview={handleFinishInterview}
              isStarting={isStartingInterview}
              isFinishing={isFinishingInterview}
            />
          )}

          {activeView === 'candidates' && (
            <CandidatesView
              candidates={candidatesList}
              onSelectCandidate={(cand) => {
                setSelectedCandidate(cand);
                setActiveView('dashboard');
              }}
              onViewScorecard={openCandidateScorecard}
            />
          )}

          {activeView === 'questions' && (
            <QuestionBankView
              problems={bankProblems}
              onOpenProblem={(problem) => {
                setSandboxProblem(problem);
                setIsCodeModalOpen(true);
              }}
            />
          )}

          {activeView === 'analytics' && (
            isLoadingScorecard ? (
              <div className="max-w-xl mx-auto py-20 text-center">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Loading evaluation scorecard...</p>
              </div>
            ) : (
            <AnalyticsDashboard
              score={scorecard?.score || null}
              isSample={scorecard?.isSample}
              interview={scorecard?.interview || null}
              onRetake={() => setActiveView('interview')}
              onViewHistory={() => setActiveView('history')}
            />
            )
          )}

          {activeView === 'history' && (
            <HistoryView
              onSelectInterview={openInterviewScorecard}
            />
          )}

          {activeView === 'recruiter' && (
            <RecruiterView
              onSelectCandidateInterview={openInterviewScorecard}
            />
          )}

          {activeView === 'settings' && (
            <SettingsView
              currentMode={themeMode}
              onSelectMode={setThemeMode}
              currentAccent={accentColor}
              onSelectAccent={(accent) => setAccentColor(accent as AccentColor)}
            />
          )}
        </main>
      </div>

      {/* Take Interview Custom Modal */}
      <TakeInterviewModal
        isOpen={isTakeInterviewModalOpen}
        onClose={() => setIsTakeInterviewModalOpen(false)}
        onStartInterview={handleStartInterview}
        isStarting={isStartingInterview}
      />

      {/* Theme Selector Modal */}
      <ThemeSelectorModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentMode={themeMode}
        onSelectMode={setThemeMode}
        currentAccent={accentColor}
        onSelectAccent={setAccentColor}
      />

      {/* Code Sandbox Modal (C++ Evaluation Engine) */}
      <CodeModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        problem={activeProblem}
        interview={activeInterview}
        onTestResultsUpdated={(res) => {
          if (res.status === 'ACCEPTED') notify('success', 'All test cases passed!');
        }}
      />

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] sm:w-auto" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`flex items-start gap-2 px-4 py-3 rounded-2xl border shadow-lg text-xs font-medium animate-fadeIn ${
              t.kind === 'error'
                ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-500/30'
                : t.kind === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-500/30'
                : 'bg-white text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:border-white/10'
            }`}
          >
            {t.kind === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : t.kind === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <Info className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              aria-label="Dismiss notification"
              className="opacity-60 hover:opacity-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
