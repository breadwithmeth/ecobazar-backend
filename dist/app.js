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
const index_1 = __importDefault(require("./routes/index"));
const errorHandler_1 = require("./middlewares/errorHandler");
const logger_1 = require("./middlewares/logger");
const security_1 = require("./middlewares/security");
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
app.use((0, compression_1.default)());
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
app.use((0, cors_1.default)(corsOptions));
// Универсальная обработка preflight без route-паттернов (совместимо с Express 5)
app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});
// Middleware для парсинга тела запроса
app.use((0, body_parser_1.json)({ limit: '10mb' }));
app.use((0, body_parser_1.urlencoded)({ extended: true, limit: '10mb' }));
// Middleware безопасности
app.use(security_1.securityHeaders);
app.use(security_1.validateUserAgent);
app.use(security_1.sanitizeParams);
app.use(security_1.validateContentType);
app.use((0, security_1.validateBodySize)(10 * 1024 * 1024)); // 10MB
// Rate limiting для всех запросов
app.use(security_1.publicRateLimit);
// Логирование запросов
app.use(logger_1.requestLogger);
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
app.use('/api', index_1.default);
// 404 handler
app.use(errorHandler_1.notFoundHandler);
// Error handler (должен быть последним)
app.use(errorHandler_1.errorHandler);
exports.default = app;
