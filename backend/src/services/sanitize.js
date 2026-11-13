/**
 * Helpers that strip grading-only data (hidden test cases) before
 * problems or evaluation results leave the API gateway.
 */

export function sanitizeProblem(p) {
  if (!p) return p;
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    difficulty: p.difficulty,
    category: p.category,
    timeLimitMinutes: p.timeLimitMinutes,
    description: p.description,
    examples: p.examples,
    constraints: p.constraints,
    starterCode: p.starterCode,
    sampleTestCases: p.sampleTestCases,
    hiddenTestCaseCount: (p.hiddenTestCases || []).length
  };
}

/** Masks inputs/expected/actual output of hidden test cases in an evaluator result. */
export function sanitizeEvaluation(result) {
  if (!result || !Array.isArray(result.details)) return result;
  return {
    ...result,
    details: result.details.map(d =>
      d.isHidden
        ? {
            ...d,
            input: '[hidden]',
            expectedOutput: '[hidden]',
            actualOutput: d.passed ? '[hidden]' : '[hidden - output mismatch]'
          }
        : d
    )
  };
}

export function isNonEmptyString(v, max = 10000) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

export const SUPPORTED_LANGUAGES = ['python', 'javascript', 'cpp', 'c'];
