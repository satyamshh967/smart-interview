import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import interviewRoutes from './routes/interview.js';
import submissionRoutes from './routes/submission.js';
import resultsRoutes from './routes/results.js';
import questionsRoutes from './routes/questions.js';
import candidatesRoutes from './routes/candidates.js';

import { db } from './services/db.js';
import { checkEvaluatorHealth } from './services/evaluatorClient.js';
import { checkNlpHealth } from './services/nlpClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port;
let shuttingDown = false;

// Behind nginx: trust its X-Forwarded-For so rate limits key on the real client IP
app.set('trust proxy', config.trustProxyHops);
app.disable('x-powered-by');

// Middleware
app.use(helmet());
if (config.corsOrigins.length > 0) {
  app.use(cors({ origin: config.corsOrigins }));
}
app.use(express.json({ limit: '2mb' }));
app.use(morgan(config.logFormat, {
  skip: req => req.path.startsWith('/api/health')
}));

// Swagger UI Documentation
if (config.enableDocs) {
  try {
    const swaggerDoc = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'openapi.json'), 'utf-8'));
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Smart Interview Platform - API Documentation'
    }));
  } catch (err) {
    console.warn('Could not initialize Swagger UI:', err.message);
  }
}

// API Routes
app.use('/api/interview', interviewRoutes);
app.use('/api/submission', submissionRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/candidates', candidatesRoutes);

// Liveness: the process is up and serving requests
app.get('/api/health/live', (req, res) => {
  res.json({ status: 'UP' });
});

// Readiness: able to do useful work (evaluator required; NLP has a degraded fallback)
app.get('/api/health/ready', async (req, res) => {
  if (shuttingDown) return res.status(503).json({ status: 'DRAINING' });
  const [evaluator, nlp] = await Promise.all([checkEvaluatorHealth(), checkNlpHealth()]);
  const ready = evaluator.status !== 'DOWN';
  return res.status(ready ? 200 : 503).json({ status: ready ? 'READY' : 'NOT_READY', evaluator, nlp });
});

// Aggregate status across all microservices (used by the UI's status indicator)
app.get('/api/health', async (req, res) => {
  const [evaluatorStatus, nlpStatus] = await Promise.all([
    checkEvaluatorHealth(),
    checkNlpHealth()
  ]);

  res.json({
    status: shuttingDown ? 'DRAINING' : 'UP',
    timestamp: new Date().toISOString(),
    services: {
      backendGateway: {
        status: shuttingDown ? 'DRAINING' : 'UP',
        uptime: process.uptime()
      },
      cppCodeEvaluator: evaluatorStatus,
      pythonNlpEngine: nlpStatus
    }
  });
});

// Root welcome route
app.get('/', (req, res) => {
  res.json({
    name: 'Smart Interview Simulation & Evaluation Platform API Gateway',
    version: '1.0.0',
    documentation: config.enableDocs ? '/api/docs' : null,
    endpoints: [
      '/api/interview/start',
      '/api/submission/evaluate',
      '/api/interview/communication-feedback',
      '/api/interview/finish',
      '/api/results/history',
      '/api/questions',
      '/api/candidates',
      '/api/health'
    ]
  });
});

// Unknown API routes → JSON 404
app.use('/api', (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handler (malformed JSON bodies, oversized payloads, upstream outages, uncaught errors)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON request body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload too large' });
  }
  const status = err?.status || err?.statusCode || 500;
  if (status >= 500) console.error('Request failed:', err);
  // Never leak internal details (file paths, upstream URLs) for unexpected server errors
  const exposeMessage = status < 500 || status === 503 || !config.isProduction;
  return res.status(status).json({
    error: exposeMessage ? (err?.message || 'Internal server error') : 'Internal server error'
  });
});

const server = app.listen(PORT, config.host, () => {
  console.log('=================================================');
  console.log(`  Interview Platform API Gateway running on ${config.host}:${PORT} (${config.env})`);
  if (config.enableDocs) console.log(`  Interactive API Docs: http://localhost:${PORT}/api/docs`);
  console.log(`  Health Status:        http://localhost:${PORT}/api/health`);
  console.log('=================================================');
});

/** Stop accepting connections, let in-flight requests finish, flush the store, then exit. */
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received: draining connections...`);

  const force = setTimeout(() => {
    console.error('Shutdown timed out; forcing exit');
    process.exit(1);
  }, config.shutdownTimeoutMs);
  force.unref();

  server.close(async (err) => {
    try {
      await db.flush();
    } catch (e) {
      console.error('Final store flush failed:', e);
    }
    process.exit(err ? 1 : 0);
  });
  server.closeIdleConnections?.();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
