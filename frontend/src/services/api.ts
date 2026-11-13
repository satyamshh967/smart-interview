import {
  Candidate,
  InterviewSession,
  Problem,
  EvaluationResult,
  Submission,
  NLPFeedback,
  ScoreRecord,
  InterviewHistoryItem,
  HistoryAnalytics
} from '../types';

const API_BASE = '/api';

/** Error carrying the HTTP status and the server-provided message. */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 30000, ...rest } = init || {};
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...rest,
      headers: rest.body ? { 'Content-Type': 'application/json', ...(rest.headers || {}) } : rest.headers,
      signal: rest.signal ?? AbortSignal.timeout(timeoutMs)
    });
  } catch (err: any) {
    const msg = err?.name === 'TimeoutError'
      ? 'Request timed out. Is the API gateway running?'
      : 'Network error: could not reach the API gateway.';
    throw new ApiError(msg, 0);
  }

  let data: any = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    throw new ApiError(data?.error || `${res.status} ${res.statusText}`, res.status);
  }
  return data as T;
}

const post = <T>(path: string, body: unknown, timeoutMs?: number) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body), timeoutMs });

export function fetchHealth() {
  return request<any>('/health', { timeoutMs: 8000 });
}

export function fetchCandidates(withStats = false): Promise<Candidate[]> {
  return request<Candidate[]>(withStats ? '/candidates?withStats=true' : '/candidates');
}

export function createCandidate(params: {
  name: string;
  email: string;
  role?: string;
  targetTrack?: string;
  experienceLevel?: string;
}): Promise<Candidate> {
  return post<Candidate>('/candidates', params);
}

export function fetchQuestions(): Promise<Problem[]> {
  return request<Problem[]>('/questions');
}

export function startInterviewSession(params: {
  candidateId: string;
  difficulty: string;
  track: string;
  problemCount?: number;
}): Promise<{
  interview: InterviewSession;
  problems: Problem[];
  candidate: Candidate;
}> {
  return post('/interview/start', params);
}

export function getInterviewSession(id: string): Promise<{
  interview: InterviewSession;
  problems: Problem[];
  submissions: Submission[];
  score: ScoreRecord | null;
}> {
  return request(`/interview/${encodeURIComponent(id)}`);
}

export function evaluateCodeSubmission(params: {
  interviewId?: string;
  problemId: string;
  language: string;
  code: string;
  isSampleOnly: boolean;
}): Promise<{
  evaluation: EvaluationResult;
  submission?: Submission;
  isSampleOnly: boolean;
}> {
  // Code execution can legitimately take a while across many test cases.
  return post('/submission/evaluate', params, 90000);
}

export function getCommunicationFeedback(params: {
  interviewId?: string;
  transcript: string;
  problemId?: string;
  code?: string;
  timeTakenSeconds?: number;
}): Promise<NLPFeedback> {
  return post('/interview/communication-feedback', params);
}

export function finishInterviewSession(params: {
  interviewId: string;
  recordingUrl?: string;
  communicationTranscript?: string;
  timeTakenSeconds?: number;
}): Promise<{
  interview: InterviewSession;
  score: ScoreRecord;
}> {
  return post('/interview/finish', params, 60000);
}

export function fetchInterviewResult(interviewId: string): Promise<{
  interview: InterviewSession;
  score: ScoreRecord | null;
  submissions: Submission[];
  problems: Problem[];
  candidate?: Candidate;
}> {
  return request(`/results/${encodeURIComponent(interviewId)}`);
}

export function fetchInterviewHistory(candidateId?: string): Promise<{
  history: InterviewHistoryItem[];
  analytics: HistoryAnalytics;
}> {
  const path = candidateId
    ? `/results/history?candidateId=${encodeURIComponent(candidateId)}`
    : '/results/history';
  return request(path);
}
