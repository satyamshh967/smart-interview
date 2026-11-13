import { config } from '../config.js';
import { postJson, probeHealth } from './upstream.js';

/**
 * Runs code against test cases in the C++ evaluation engine.
 * Throws UpstreamUnavailableError (HTTP 503) if the engine is unreachable, so an
 * outage is never recorded as a failed candidate submission.
 */
export function evaluateCode({ language, code, testCases, timeLimitMs = 3000 }) {
  const timeoutMs = Math.max(10000, timeLimitMs * ((testCases?.length || 1) + 2));
  return postJson(
    'Code evaluation service',
    `${config.evaluatorUrl}/evaluate`,
    { language, code, testCases, timeLimitMs },
    timeoutMs,
    config.evaluatorToken ? { 'X-Evaluator-Token': config.evaluatorToken } : {}
  );
}

export function checkEvaluatorHealth() {
  return probeHealth(`${config.evaluatorUrl}/health`);
}
