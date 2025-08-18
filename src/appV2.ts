import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'body-parser';

// Импортируем маршруты
import routes from './routes/index';

// Импортируем middleware
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { requestLoggerMiddleware, logger } from './utils/logger';
import { securityService } from './utils/security';
import { metricsMiddleware, metricsService } from './utils/metrics';

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

// Обработка неперехваченных исключений
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message, 
    stack: error.stack 
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason as string, 
    promise: promise.toString() 
  });
});

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
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// CORS настройки по .env (ALLOWED_ORIGINS)
const allowedOriginsEnvV2 = process.env.ALLOWED_ORIGINS;
const isWildcardOriginV2 = !allowedOriginsEnvV2 || allowedOriginsEnvV2 === '*';
const allowedOriginsV2 = isWildcardOriginV2
  ? '*'
  : allowedOriginsEnvV2.split(',').map(o => o.trim()).filter(Boolean);

const corsOptionsV2: cors.CorsOptions = {
  origin: ["*"], // '*' или массив строк
  credentials: isWildcardOriginV2 ? false : true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
  maxAge: 86400
};

app.use(cors(corsOptionsV2));
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Middleware для парсинга тела запроса
app.use(json({ 
  limit: '10mb',
  verify: (req, res, buf) => {
    // Дополнительная проверка JSON
    try {
      JSON.parse(buf.toString());
    } catch (error) {
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 100 // Ограничиваем количество параметров
}));

// Middleware безопасности
app.use(securityService.securityHeaders());
app.use(securityService.detectSuspiciousActivity());
app.use(securityService.sqlInjectionProtection());
app.use(securityService.validateContentType());
app.use(securityService.validateBodySize(10 * 1024 * 1024)); // 10MB

// Rate limiting для всех запросов
app.use(securityService.rateLimit('general'));

// Middleware для сбора метрик
app.use(metricsMiddleware);

// Логирование запросов
app.use(requestLoggerMiddleware);

// Health check endpoint
app.get('/health', (req, res) => {
  const healthStatus = metricsService.getHealthStatus();
  res.status(healthStatus.status === 'critical' ? 503 : 200).json({
    ...healthStatus,
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    systemUptime: process.uptime()
  });
});

// Metrics endpoint (только для админов в продакшене)
app.get('/metrics', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    // В продакшене требуем аутентификацию для метрик
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.METRICS_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  const metrics = metricsService.getMetrics();
  res.json(metrics);
});

// Security stats endpoint (только для админов)
app.get('/security-stats', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  const securityStats = securityService.getSecurityStats();
  res.json(securityStats);
});

// API routes
app.use('/api', routes);

// Статические файлы (если нужны)
if (process.env.NODE_ENV === 'production') {
  app.use('/static', express.static('public', {
    maxAge: '1y',
    etag: true,
    lastModified: true
  }));
}

// 404 handler
app.use(notFoundHandler);

// Error handler (должен быть последним)
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Получен сигнал ${signal}, начинаем graceful shutdown...`);
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
