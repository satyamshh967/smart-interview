import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db.js';
import { evaluateCommunication } from '../services/nlpClient.js';
import { sanitizeProblem } from '../services/sanitize.js';

const router = express.Router();

const DIFFICULTY_RANK = { Easy: 0, Medium: 1, Hard: 2 };

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Prefer problems at the requested difficulty (shuffled for variety), then fill
 * remaining slots with the closest other difficulties. Result is ordered easy → hard.
 */
function selectProblems(allProblems, difficulty, count) {
  const target = DIFFICULTY_RANK[difficulty] ?? 1;
  const rankOf = p => DIFFICULTY_RANK[p.difficulty] ?? 1;
  const matching = shuffle(allProblems.filter(p => p.difficulty === difficulty));
  const others = shuffle(allProblems.filter(p => p.difficulty !== difficulty))
    .sort((a, b) => Math.abs(rankOf(a) - target) - Math.abs(rankOf(b) - target));
  return [...matching, ...others]
    .slice(0, count)
    .sort((a, b) => rankOf(a) - rankOf(b));
}

const testCount = prob => (prob.sampleTestCases || []).length + (prob.hiddenTestCases || []).length;

/**
 * POST /api/interview/start
 * Initiates an interview session for a candidate.
 */
router.post('/start', (req, res) => {
  try {
    const {
      candidateId = 'cand-101',
      title,
      difficulty = 'Medium',
      track = 'Fullstack / DSA',
      problemCount = 2
    } = req.body || {};

    const candidate = db.getCandidateById(candidateId) || db.getCandidates()[0];
    if (!candidate) {
      return res.status(400).json({ error: 'No candidates available to start an interview' });
    }

    const allProblems = db.getProblems();
    if (allProblems.length === 0) {
      return res.status(503).json({ error: 'Question bank is empty' });
    }
    const count = Math.min(Math.max(parseInt(problemCount, 10) || 2, 1), allProblems.length);
    const selectedProblems = selectProblems(allProblems, difficulty, count);

    const totalTimeMinutes = selectedProblems.reduce((sum, p) => sum + (p.timeLimitMinutes || 20), 0);

    const interview = {
      id: `int-${uuidv4().slice(0, 8)}`,
      candidateId: candidate.id,
      candidateName: candidate.name,
      title: title || `${track} Interview`,
      difficulty,
      track,
      timeLimitMinutes: totalTimeMinutes,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      completedAt: null,
      problemIds: selectedProblems.map(p => p.id),
      communicationTranscript: '',
      recordingUrl: null
    };

    db.createInterview(interview);

    return res.status(201).json({
      interview,
      problems: selectedProblems.map(sanitizeProblem),
      candidate
    });
  } catch (error) {
    console.error('Error starting interview:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/interview/:id
 * Fetch active interview session state (hidden test cases are never exposed).
 */
router.get('/:id', (req, res) => {
  const interview = db.getInterviewById(req.params.id);
  if (!interview) {
    return res.status(404).json({ error: 'Interview session not found' });
  }

  const problems = db.getProblems().filter(p => interview.problemIds.includes(p.id)).map(sanitizeProblem);
  const submissions = db.getSubmissions({ interviewId: interview.id });
  const score = db.getScores({ interviewId: interview.id })[0] || null;

  return res.json({
    interview,
    problems,
    submissions,
    score
  });
});

/**
 * POST /api/interview/communication-feedback
 * Send verbal explanation / audio transcript to Python NLP feedback engine
 */
router.post('/communication-feedback', async (req, res) => {
  try {
    const { interviewId, transcript, problemId, code, timeTakenSeconds } = req.body || {};

    if (typeof transcript !== 'string' || !transcript.trim()) {
      return res.status(400).json({ error: 'Transcript is required for communication feedback' });
    }

    let problemTitle = '';
    if (problemId) {
      const prob = db.getProblemById(problemId);
      if (prob) problemTitle = prob.title;
    }

    const nlpResult = await evaluateCommunication({
      transcript,
      problemContext: problemTitle,
      code: code || '',
      timeTakenSeconds: timeTakenSeconds || 0
    });

    if (interviewId && db.getInterviewById(interviewId)) {
      db.updateInterview(interviewId, {
        communicationTranscript: transcript
      });
    }

    return res.json(nlpResult);
  } catch (err) {
    console.error('Error generating communication feedback:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/interview/finish
 * Concludes the interview, computes composite score, and produces evaluation report.
 */
router.post('/finish', async (req, res) => {
  try {
    const {
      interviewId,
      recordingUrl,
      communicationTranscript = '',
      timeTakenSeconds: rawTimeTaken = 0
    } = req.body || {};

    if (!interviewId) {
      return res.status(400).json({ error: 'interviewId is required' });
    }

    const interview = db.getInterviewById(interviewId);
    if (!interview) {
      return res.status(404).json({ error: 'Interview session not found' });
    }

    const timeTakenSeconds = Math.max(0, Number(rawTimeTaken) || 0);
    const completedAt = new Date().toISOString();
    db.updateInterview(interviewId, {
      status: 'completed',
      completedAt,
      recordingUrl: recordingUrl || interview.recordingUrl,
      communicationTranscript: communicationTranscript || interview.communicationTranscript
    });

    // Fetch all submissions for this interview
    const submissions = db.getSubmissions({ interviewId });
    const problems = db.getProblems().filter(p => interview.problemIds.includes(p.id));

    // Calculate Code Correctness Score from the best submission per problem
    let totalPossibleTests = 0;
    let totalPassedTests = 0;
    let totalRuntimeMs = 0;
    let solvedProblemCount = 0;
    const problemBreakdown = [];

    for (const prob of problems) {
      const probSubmissions = submissions.filter(s => s.problemId === prob.id);
      if (probSubmissions.length > 0) {
        // most tests passed first, then fastest
        const best = [...probSubmissions].sort((a, b) =>
          ((b.testCasesPassed || 0) - (a.testCasesPassed || 0)) ||
          ((a.executionTimeMs || 0) - (b.executionTimeMs || 0))
        )[0];
        const total = best.testCasesTotal || testCount(prob);
        totalPassedTests += best.testCasesPassed || 0;
        totalPossibleTests += total;
        if ((best.testCasesPassed || 0) > 0) {
          totalRuntimeMs += best.executionTimeMs || 0;
          solvedProblemCount += 1;
        }
        problemBreakdown.push({
          problemId: prob.id,
          title: prob.title,
          attempts: probSubmissions.length,
          passed: best.testCasesPassed || 0,
          total,
          language: best.language,
          status: best.status
        });
      } else {
        totalPossibleTests += testCount(prob);
        problemBreakdown.push({
          problemId: prob.id,
          title: prob.title,
          attempts: 0,
          passed: 0,
          total: testCount(prob),
          language: null,
          status: 'NOT_ATTEMPTED'
        });
      }
    }

    const avgRuntimeMs = solvedProblemCount > 0 ? totalRuntimeMs / solvedProblemCount : 0;

    const codeCorrectnessScore = totalPossibleTests > 0
      ? Math.round((totalPassedTests / totalPossibleTests) * 100)
      : 0;

    // Code Efficiency Score (penalize slow average runtime of solved problems)
    let codeEfficiencyScore = 90;
    if (avgRuntimeMs > 300) codeEfficiencyScore = 70;
    else if (avgRuntimeMs > 100) codeEfficiencyScore = 82;
    if (totalPassedTests === 0) codeEfficiencyScore = 30;

    // Time Management Score
    const allowedSeconds = interview.timeLimitMinutes * 60;
    let timeManagementScore = 85;
    if (timeTakenSeconds > 0 && allowedSeconds > 0) {
      const usageRatio = timeTakenSeconds / allowedSeconds;
      if (usageRatio <= 0.75) timeManagementScore = 95;
      else if (usageRatio <= 1.0) timeManagementScore = 85;
      else timeManagementScore = Math.max(40, 85 - Math.round((usageRatio - 1.0) * 100));
    }
    // Finishing quickly without solving anything is not good time management.
    if (totalPassedTests === 0) timeManagementScore = Math.min(timeManagementScore, 50);

    // Call Python NLP Feedback Engine for communication scoring
    const fullTranscript = communicationTranscript || interview.communicationTranscript || '';
    const nlpFeedback = fullTranscript.trim()
      ? await evaluateCommunication({
          transcript: fullTranscript,
          problemContext: problems.map(p => p.title).join(', '),
          timeTakenSeconds
        })
      : {
          overallScore: 30,
          strengths: [],
          improvements: ['No verbal explanation was captured. Walk through your approach, complexity and edge cases out loud.'],
          summary: 'No transcript was captured for this interview.'
        };

    const communicationScore = Number.isFinite(nlpFeedback.overallScore) ? nlpFeedback.overallScore : 60;

    // Weighted Overall Score:
    // 45% Code Correctness, 20% Code Efficiency, 20% Verbal Communication, 15% Time Management
    const overallScore = Math.round(
      (codeCorrectnessScore * 0.45) +
      (codeEfficiencyScore * 0.20) +
      (communicationScore * 0.20) +
      (timeManagementScore * 0.15)
    );

    // Merge strengths & improvements
    const strengths = [...(nlpFeedback.strengths || [])];
    const improvements = [...(nlpFeedback.improvements || [])];

    if (codeCorrectnessScore >= 90) {
      strengths.unshift('Flawless test case suite execution; passed edge cases and hidden test suites.');
    } else if (codeCorrectnessScore >= 60) {
      strengths.unshift('Strong foundational logic, passed primary test cases.');
      improvements.unshift('Address hidden edge cases and boundary conditions in test submissions.');
    } else {
      improvements.unshift('Focus on baseline algorithmic correctness and syntax validation before submission.');
    }
    const unattempted = problemBreakdown.filter(p => p.attempts === 0);
    if (unattempted.length > 0) {
      improvements.push(`No submission recorded for: ${unattempted.map(p => p.title).join(', ')}.`);
    }

    const scoreRecord = {
      id: `score-${uuidv4().slice(0, 8)}`,
      interviewId,
      candidateId: interview.candidateId,
      overallScore,
      codeCorrectnessScore,
      codeEfficiencyScore,
      communicationScore,
      timeManagementScore,
      timeTakenSeconds,
      totalTestCases: totalPossibleTests,
      passedTestCases: totalPassedTests,
      problemBreakdown,
      strengths,
      improvements,
      nlpDetails: nlpFeedback,
      competencies: {
        algorithms: Math.round((codeCorrectnessScore * 0.7) + (codeEfficiencyScore * 0.3)),
        problemSolving: Math.round((codeCorrectnessScore * 0.6) + (communicationScore * 0.4)),
        codeQuality: codeEfficiencyScore,
        verbalArticulation: communicationScore,
        speedAndTime: timeManagementScore
      },
      createdAt: completedAt
    };

    db.saveScore(scoreRecord);

    return res.json({
      interview: db.getInterviewById(interviewId),
      score: scoreRecord
    });
  } catch (err) {
    console.error('Error completing interview:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
