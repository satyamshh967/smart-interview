import express from 'express';
import { db } from '../services/db.js';
import { sanitizeProblem } from '../services/sanitize.js';

const router = express.Router();

/**
 * GET /api/questions
 * List all available problems in the question bank.
 * Optional filters: ?difficulty=Easy|Medium|Hard&category=...
 */
router.get('/', (req, res) => {
  const { difficulty, category } = req.query;
  let problems = db.getProblems();
  if (difficulty) problems = problems.filter(p => p.difficulty === difficulty);
  if (category) problems = problems.filter(p => p.category?.toLowerCase().includes(String(category).toLowerCase()));
  return res.json(problems.map(sanitizeProblem));
});

/**
 * GET /api/questions/:id
 */
router.get('/:id', (req, res) => {
  const problem = db.getProblemById(req.params.id);
  if (!problem) {
    return res.status(404).json({ error: 'Question not found' });
  }
  return res.json(sanitizeProblem(problem));
});

export default router;
