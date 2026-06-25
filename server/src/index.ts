import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

import config from './config/index.js';
import { connectDatabase } from './config/database.js';
import { connectRedis } from './config/redis.js';
import routes from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import initializeSocket from './socket/index.js';

async function bootstrap() {
  // Initialize Express app
  const app = express();
  const httpServer = createServer(app);

  // Connect to databases
  await connectDatabase();
  await connectRedis();

  // Initialize Socket.io
  const io = initializeSocket(httpServer);

  // Security middleware
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  // CORS — accept the configured CLIENT_URL plus any localhost origin in development.
  // The CLIENT_URL env var may be a single URL or a comma-separated list of allowed origins.
  const allowedOrigins = config.clientUrl
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

  app.use(cors({
    origin(origin, callback) {
      // Allow non-browser requests (curl, server-to-server) which have no origin header
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      if (config.nodeEnv !== 'production' && localhostRegex.test(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  if (config.nodeEnv === 'production') {
    const limiter = rateLimit({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later',
        },
      },
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);
  }

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Request logging
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    });
    next();
  });

  // API routes
  app.use('/api', routes);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  // Start server
  httpServer.listen(config.port, () => {
    console.log(`                               
   Environment: ${config.nodeEnv.padEnd(39)}
  API:         http://localhost:${String(config.port).padEnd(27)}
   Socket.io:   ws://localhost:${String(config.port).padEnd(28)}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    
    httpServer.close(() => {
      console.log('HTTP server closed');
    });

    io.close(() => {
      console.log('Socket.io server closed');
    });

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
