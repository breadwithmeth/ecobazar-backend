"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const body_parser_1 = require("body-parser");
// Импортируем маршруты
const index_1 = __importDefault(require("./routes/index"));
// Импортируем middleware
const errorHandler_1 = require("./middlewares/errorHandler");
const logger_1 = require("./utils/logger");
const security_1 = require("./utils/security");
const metrics_1 = require("./utils/metrics");
// Загружаем переменные окружения
dotenv_1.default.config();
// Проверяем обязательные переменные окружения
const requiredEnvVars = ['JWT_SECRET', 'DATABASE_URL'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.error(`❌ Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}
const app = (0, express_1.default)();
// Обработка неперехваченных исключений
process.on('uncaughtException', (error) => {
    logger_1.logger.error('Uncaught Exception', {
        error: error.message,
        stack: error.stack
    });
    process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error('Unhandled Rejection', {
        reason: reason,
        promise: promise.toString()
    });
});
// Базовые middleware для безопасности
app.use((0, helmet_1.default)({
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
app.use((0, compression_1.default)({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression_1.default.filter(req, res);
    }
}));
// CORS настройки по .env (ALLOWED_ORIGINS)
const allowedOriginsEnvV2 = process.env.ALLOWED_ORIGINS;
const isWildcardOriginV2 = !allowedOriginsEnvV2 || allowedOriginsEnvV2 === '*';
const allowedOriginsV2 = isWildcardOriginV2
    ? '*'
    : allowedOriginsEnvV2.split(',').map(o => o.trim()).filter(Boolean);
const corsOptionsV2 = {
    origin: ["https://eco-f.drawbridge.kz"], // '*' или массив строк
    credentials: isWildcardOriginV2 ? false : true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-CSRF-Token'],
    maxAge: 86400
};
app.use((0, cors_1.default)(corsOptionsV2));
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});
// Middleware для парсинга тела запроса
app.use((0, body_parser_1.json)({
    limit: '10mb',
    verify: (req, res, buf) => {
        // Дополнительная проверка JSON
        try {
            JSON.parse(buf.toString());
        }
        catch (error) {
            throw new Error('Invalid JSON');
        }
    }
}));
app.use((0, body_parser_1.urlencoded)({
    extended: true,
    limit: '10mb',
    parameterLimit: 100 // Ограничиваем количество параметров
}));
// Middleware безопасности
app.use(security_1.securityService.securityHeaders());
app.use(security_1.securityService.detectSuspiciousActivity());
app.use(security_1.securityService.sqlInjectionProtection());
app.use(security_1.securityService.validateContentType());
app.use(security_1.securityService.validateBodySize(10 * 1024 * 1024)); // 10MB
// Rate limiting для всех запросов
app.use(security_1.securityService.rateLimit('general'));
// Middleware для сбора метрик
app.use(metrics_1.metricsMiddleware);
// Логирование запросов
app.use(logger_1.requestLoggerMiddleware);
// Health check endpoint
app.get('/health', (req, res) => {
    const healthStatus = metrics_1.metricsService.getHealthStatus();
    res.status(healthStatus.status === 'critical' ? 503 : 200).json(Object.assign(Object.assign({}, healthStatus), { version: process.env.npm_package_version || '1.0.0', environment: process.env.NODE_ENV || 'development', systemUptime: process.uptime() }));
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
    const metrics = metrics_1.metricsService.getMetrics();
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
    const securityStats = security_1.securityService.getSecurityStats();
    res.json(securityStats);
});
// API routes
app.use('/api', index_1.default);
// Статические файлы (если нужны)
if (process.env.NODE_ENV === 'production') {
    app.use('/static', express_1.default.static('public', {
        maxAge: '1y',
        etag: true,
        lastModified: true
    }));
}
// 404 handler
app.use(errorHandler_1.notFoundHandler);
// Error handler (должен быть последним)
app.use(errorHandler_1.errorHandler);
// Graceful shutdown
const gracefulShutdown = (signal) => {
    logger_1.logger.info(`Получен сигнал ${signal}, начинаем graceful shutdown...`);
    process.exit(0);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
exports.default = app;
