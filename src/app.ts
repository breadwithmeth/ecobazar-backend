import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'body-parser';
import routes from './routes/index';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/logger';
import { 
  securityHeaders, 
  validateUserAgent, 
  validateContentType, 
  validateBodySize,
  sanitizeParams,
  publicRateLimit 
} from './middlewares/security';

// Загружаем переменные окружения
dotenv.config();

// Проверяем обязательные переменные окружения
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

const app = express();

// Базовые middleware для безопасности
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Сжатие ответов
app.use(compression());

// CORS настройки по .env (ALLOWED_ORIGINS)
const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
const isWildcardOrigin = !allowedOriginsEnv || allowedOriginsEnv === '*';
const allowedOrigins = isWildcardOrigin 
  ? '*'
  : allowedOriginsEnv.split(',').map(o => o.trim()).filter(Boolean);

const corsOptions = {
  origin: ["https://eco-f.drawbridge.kz"], // '*' или массив строк
  credentials: isWildcardOrigin ? false : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 часа
};

app.use(cors(corsOptions));
app.options('(.*)', cors(corsOptions));

// Middleware для парсинга тела запроса
app.use(json({ limit: '10mb' }));
app.use(urlencoded({ extended: true, limit: '10mb' }));

// Middleware безопасности
app.use(securityHeaders);
app.use(validateUserAgent);
app.use(sanitizeParams);
app.use(validateContentType);
app.use(validateBodySize(10 * 1024 * 1024)); // 10MB

// Rate limiting для всех запросов
app.use(publicRateLimit);

// Логирование запросов
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api', routes);

// 404 handler
app.use(notFoundHandler);

// Error handler (должен быть последним)
app.use(errorHandler);

export default app;
