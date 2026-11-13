import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db.js';
import { evaluateCode } from '../services/evaluatorClient.js';
import { sanitizeEvaluation, SUPPORTED_LANGUAGES } from '../services/sanitize.js';

const MAX_CODE_LENGTH = 100_000;

const router = express.Router();

/**
 * POST /api/submission/evaluate
 * Forwards candidate code to C++ Code Evaluation Engine and persists submission record.
 */
router.post('/evaluate', async (req, res) => {
  try {
    const {
      interviewId,
      problemId,
      language = 'python',
      code = '',
      isSampleOnly = false
    } = req.body || {};

    if (typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ error: 'Code is required for evaluation' });
    }
    if (code.length > MAX_CODE_LENGTH) {
      return res.status(413).json({ error: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters` });
    }
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      return res.status(400).json({ error: `Unsupported language '${language}'. Supported: ${SUPPORTED_LANGUAGES.join(', ')}` });
    }
    if (interviewId && !isSampleOnly) {
      const interview = db.getInterviewById(interviewId);
      if (interview && interview.status === 'completed') {
        return res.status(409).json({ error: 'Interview already completed; submissions are closed' });
      }
    }

    const problem = db.getProblemById(problemId);
    if (!problem) {
      return res.status(404).json({ error: `Problem with ID '${problemId}' not found` });
    }

    // Determine which test cases to evaluate
    let testCases = [];
    if (isSampleOnly) {
      testCases = (problem.sampleTestCases || []).map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: false
      }));
    } else {
      const samples = (problem.sampleTestCases || []).map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: false
      }));
      const hiddens = (problem.hiddenTestCases || []).map(tc => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isHidden: true
      }));
      testCases = [...samples, ...hiddens];
    }

    // Call C++ Evaluation Engine
    const evalResult = await evaluateCode({
      language,
      code,
      testCases,
      timeLimitMs: 3500
    });

    const isFullSubmission = !isSampleOnly;
    let submissionRecord = null;

    if (isFullSubmission && interviewId) {
      submissionRecord = {
        id: `sub-${uuidv4().slice(0, 8)}`,
        interviewId,
        problemId,
        problemTitle: problem.title,
        language,
        code,
        status: evalResult.status,
        executionTimeMs: evalResult.totalExecutionTimeMs,
        memoryKb: evalResult.peakMemoryKb,
        testCasesPassed: evalResult.passedTestCases,
        testCasesTotal: evalResult.totalTestCases,
        compilationError: evalResult.compilationError || null,
        submittedAt: new Date().toISOString()
      };
      db.addSubmission(submissionRecord);
    }

    return res.json({
      evaluation: sanitizeEvaluation(evalResult),
      submission: submissionRecord,
      isSampleOnly
    });
  } catch (error) {
    console.error('Error evaluating submission:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
