import rateLimit from 'express-rate-limit';
import { config } from '../config.js';

const limiter = (perMinute, message) => rateLimit({
  windowMs: 60_000,
  limit: perMinute,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: message }
});

/** Code execution is the most expensive operation in the system. */
export const evaluateLimiter = limiter(
  config.evalRateLimitPerMin,
  'Too many evaluation requests. Please wait a moment and try again.'
);

/** NLP scoring and interview finalization. */
export const nlpLimiter = limiter(
  config.nlpRateLimitPerMin,
  'Too many requests. Please wait a moment and try again.'
);
