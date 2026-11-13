/**
 * Centralized, validated runtime configuration (all values come from env vars).
 */
const int = (value, fallback) => {
  const n = Number(value);
  return value !== undefined && value !== '' && Number.isFinite(n) ? n : fallback;
};

const list = value => (value || '').split(',').map(s => s.trim()).filter(Boolean);

export const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: int(process.env.PORT, 5000),
  // Loopback by default; containers set HOST=0.0.0.0 so the proxy can reach the API
  host: process.env.HOST || '127.0.0.1',
  // Shared secret sent to the evaluator so only the gateway can submit code to it
  evaluatorToken: process.env.EVALUATOR_TOKEN || '',
  evaluatorUrl: process.env.EVALUATOR_URL || 'http://127.0.0.1:8082',
  nlpUrl: process.env.NLP_URL || 'http://127.0.0.1:8081',
  // Empty = CORS disabled (the frontend is always served same-origin via nginx / Vite proxy)
  corsOrigins: list(process.env.CORS_ORIGINS),
  // Number of reverse-proxy hops in front of the API (nginx = 1); used for client IPs in rate limiting
  trustProxyHops: int(process.env.TRUST_PROXY_HOPS, 1),
  evalRateLimitPerMin: int(process.env.EVAL_RATE_LIMIT_PER_MIN, 20),
  nlpRateLimitPerMin: int(process.env.NLP_RATE_LIMIT_PER_MIN, 30),
  storeFlushMs: int(process.env.STORE_FLUSH_MS, 200),
  shutdownTimeoutMs: int(process.env.SHUTDOWN_TIMEOUT_MS, 25000),
  enableDocs: process.env.ENABLE_API_DOCS !== 'false',
  logFormat: process.env.LOG_FORMAT || (process.env.NODE_ENV === 'production' ? 'combined' : 'dev')
});
