import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import interviewRoutes from './routes/interview.js';
import submissionRoutes from './routes/submission.js';
import resultsRoutes from './routes/results.js';
import questionsRoutes from './routes/questions.js';
import candidatesRoutes from './routes/candidates.js';

import { checkEvaluatorHealth } from './services/evaluatorClient.js';
import { checkNlpHealth } from './services/nlpClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.disable('x-powered-by');
app.use(morgan('dev'));

// Swagger UI Documentation
try {
  const swaggerDoc = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'openapi.json'), 'utf-8'));
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDoc, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Smart Interview Platform - API Documentation'
  }));
} catch (err) {
  console.warn('Could not initialize Swagger UI:', err.message);
}

// API Routes
app.use('/api/interview', interviewRoutes);
app.use('/api/submission', submissionRoutes);
app.use('/api/results', resultsRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/candidates', candidatesRoutes);

// Health check endpoint across all microservices (probed in parallel)
app.get('/api/health', async (req, res) => {
  const [evaluatorStatus, nlpStatus] = await Promise.all([
    checkEvaluatorHealth(),
    checkNlpHealth()
  ]);

  res.json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    services: {
      backendGateway: {
        status: 'UP',
        port: PORT,
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
    documentation: `http://localhost:${PORT}/api/docs`,
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

// Centralized error handler (malformed JSON bodies, oversized payloads, uncaught errors)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON request body' });
  }
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload too large' });
  }
  console.error('Unhandled error:', err);
  return res.status(err?.status || 500).json({ error: err?.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log('=================================================');
  console.log(`  Interview Platform API Gateway running on port ${PORT}`);
  console.log(`  Interactive API Docs: http://localhost:${PORT}/api/docs`);
  console.log(`  Health Status:        http://localhost:${PORT}/api/health`);
  console.log('=================================================');
});
