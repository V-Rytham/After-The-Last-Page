import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { connectDB, getLastDbError, isDbConnected } from './config/db.js';
import { connectCache } from './config/cache.js';
import { loadBookFriendEnv, resolveLlmProvider } from './config/env.js';
import { logger, withRequestContext } from './lib/logger.js';
import { sendSuccess } from './lib/http.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { attachRequestContext } from './middleware/requestContext.js';
import { memoryRateLimit } from './middleware/rateLimit.js';
import agentRoutes from './routes/agentRoutes.js';

loadBookFriendEnv();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production' ? 1 : 0);

const isProd = () => String(process.env.NODE_ENV || '').trim().toLowerCase() === 'production';

const corsOrigin = (origin, callback) => {
  const allowList = new Set([
    process.env.CLIENT_URL,
    process.env.BACKEND_URL,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5000',
    'http://127.0.0.1:5000',
  ].filter(Boolean));

  if (!origin || allowList.has(origin) || !isProd()) {
    callback(null, true);
    return;
  }

  callback(new Error('Origin not allowed by CORS.'));
};

app.use(attachRequestContext);
app.use((req, _res, next) => {
  logger.info(withRequestContext({ req, route: req.originalUrl, method: req.method }), 'Incoming request');
  next();
});

app.use(helmet({
  hsts: isProd() ? { maxAge: 31_536_000, includeSubDomains: true, preload: true } : false,
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https:'],
      frameAncestors: ["'none'"],
    },
  },
}));

app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
  credentials: true,
  maxAge: 600,
}));

app.use(cookieParser());
app.use(express.json({ limit: '200kb' }));
app.use(express.urlencoded({ extended: false, limit: '200kb' }));
app.use(memoryRateLimit);

app.get('/health', (req, res) => {
  const { provider } = resolveLlmProvider();
  const dbConnected = isDbConnected();

  return sendSuccess(res, {
    status: dbConnected ? 'ok' : 'degraded',
    service: 'bookfriend-agent-server',
    llm_provider: provider,
    database: {
      connected: dbConnected,
      error: dbConnected ? null : (getLastDbError()?.message || 'Database unavailable'),
    },
  }, dbConnected ? 200 : 503);
});

app.use('/agent', agentRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

const port = process.env.PORT || 5050;

process.on('unhandledRejection', (reason) => {
  logger.fatal({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.fatal({ error }, 'Uncaught exception');
  process.exit(1);
});

await connectDB();
await connectCache();

const { provider } = resolveLlmProvider();
app.listen(port, () => {
  logger.info({ port, provider }, 'BookFriend Agent server listening');
});
