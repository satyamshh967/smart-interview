import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../services/db.js';
import { isNonEmptyString } from '../services/sanitize.js';

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Attaches interview count and latest/best score to a candidate. */
function withStats(cand) {
  const interviews = db.getInterviews().filter(i => i.candidateId === cand.id);
  const scores = db.getScores({ candidateId: cand.id })
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latest = scores[0] || null;
  return {
    ...cand,
    stats: {
      interviewCount: interviews.length,
      completedCount: scores.length,
      latestScore: latest ? latest.overallScore : null,
      latestInterviewId: latest ? latest.interviewId : null,
      bestScore: scores.length ? Math.max(...scores.map(s => s.overallScore)) : null
    }
  };
}

/**
 * GET /api/candidates
 * Pass ?withStats=true to include interview/score aggregates.
 */
router.get('/', (req, res) => {
  const cands = db.getCandidates();
  if (req.query.withStats === 'true' || req.query.withStats === '1') {
    return res.json(cands.map(withStats));
  }
  return res.json(cands);
});

/**
 * GET /api/candidates/:id
 */
router.get('/:id', (req, res) => {
  const cand = db.getCandidateById(req.params.id);
  if (!cand) return res.status(404).json({ error: 'Candidate not found' });
  return res.json(withStats(cand));
});

/**
 * POST /api/candidates
 */
router.post('/', (req, res) => {
  const { name, email, role, targetTrack, experienceLevel } = req.body || {};
  if (!isNonEmptyString(name, 120) || !isNonEmptyString(email, 254)) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  if (!EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Email address is invalid' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (db.getCandidates().some(c => c.email?.toLowerCase() === normalizedEmail)) {
    return res.status(409).json({ error: 'A candidate with this email already exists' });
  }

  const cleanName = name.trim();
  const newCand = {
    id: `cand-${uuidv4().slice(0, 8)}`,
    name: cleanName,
    email: normalizedEmail,
    role: role || 'Software Engineer',
    targetTrack: targetTrack || 'General SWE',
    experienceLevel: experienceLevel || 'Entry Level',
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}`,
    createdAt: new Date().toISOString()
  };

  db.addCandidate(newCand);
  return res.status(201).json(newCand);
});

export default router;
