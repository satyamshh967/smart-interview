import { config } from '../config.js';
import { postJson, probeHealth } from './upstream.js';

/**
 * Scores a verbal explanation with the Python NLP engine.
 * Throws UpstreamUnavailableError (HTTP 503) if the engine is unreachable.
 */
export function evaluateCommunication({ transcript, problemContext = '', code = '', timeTakenSeconds = 0 }) {
  return postJson(
    'NLP feedback service',
    `${config.nlpUrl}/nlp/evaluate`,
    { transcript, problemContext, code, timeTakenSeconds },
    10000
  );
}

/**
 * Neutral placeholder used only when finalizing an interview while the NLP engine is down.
 * Flagged `degraded` so the scorecard never presents it as a real analysis.
 */
export function degradedCommunicationFeedback(transcript = '') {
  return {
    overallScore: 60,
    technicalClarityScore: 60,
    complexityAwarenessScore: 60,
    structuralCoherenceScore: 60,
    verbalConfidenceScore: 60,
    detectedKeywords: [],
    complexityIdentified: false,
    wordCount: transcript ? transcript.trim().split(/\s+/).filter(Boolean).length : 0,
    fillerCount: 0,
    strengths: [],
    improvements: ['Communication was not analyzed because the NLP engine was unavailable; a neutral score was used.'],
    summary: 'NLP engine unavailable at scoring time — communication score is a neutral placeholder.',
    degraded: true
  };
}

export function checkNlpHealth() {
  return probeHealth(`${config.nlpUrl}/health`);
}
