"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicRateLimit = exports.adminRateLimit = exports.validateUserAgent = exports.securityHeaders = exports.sanitizeParams = exports.validateBodySize = exports.validateContentType = exports.rateLimit = void 0;
const errorHandler_1 = require("./errorHandler");
const logger_1 = require("./logger");
const rateLimitStore = {};
const rateLimit = (options) => {
    return (req, res, next) => {
        const key = req.ip || 'unknown';
        const now = Date.now();
        // Очищаем устаревшие записи
        if (rateLimitStore[key] && rateLimitStore[key].resetTime < now) {
            delete rateLimitStore[key];
        }
        // Инициализируем или обновляем счетчик
        if (!rateLimitStore[key]) {
            rateLimitStore[key] = {
                count: 1,
                resetTime: now + options.windowMs
            };
        }
        else {
            rateLimitStore[key].count++;
        }
        // Проверяем лимит
        if (rateLimitStore[key].count > options.max) {
            logger_1.securityLogger.logSuspiciousActivity(req, 'Rate limit exceeded', {
                count: rateLimitStore[key].count,
                limit: options.max
            });
            throw new errorHandler_1.AppError(options.message || 'Слишком много запросов, попробуйте позже', 429);
        }
        // Добавляем заголовки
        res.set({
            'X-RateLimit-Limit': options.max.toString(),
            'X-RateLimit-Remaining': (options.max - rateLimitStore[key].count).toString(),
            'X-RateLimit-Reset': new Date(rateLimitStore[key].resetTime).toISOString()
        });
        next();
    };
};
exports.rateLimit = rateLimit;
// Валидация Content-Type для POST/PUT запросов
const validateContentType = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new errorHandler_1.AppError('Content-Type должен быть application/json', 400);
        }
    }
    next();
};
exports.validateContentType = validateContentType;
// Проверка размера тела запроса
const validateBodySize = (maxSize = 1024 * 1024) => {
    return (req, res, next) => {
        const contentLength = parseInt(req.get('Content-Length') || '0');
        if (contentLength > maxSize) {
            logger_1.securityLogger.logSuspiciousActivity(req, 'Large request body', {
                size: contentLength,
                maxSize
            });
            throw new errorHandler_1.AppError('Размер запроса превышает лимит', 413);
        }
        next();
    };
};
exports.validateBodySize = validateBodySize;
// Защита от SQL injection в параметрах
const sanitizeParams = (req, res, next) => {
    const suspiciousPatterns = [
        /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
        /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
        /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
        /((\%27)|(\'))union/i
    ];
    for (const [key, value] of Object.entries(req.params)) {
        if (typeof value === 'string') {
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(value)) {
                    logger_1.securityLogger.logSuspiciousActivity(req, 'SQL injection attempt', {
                        parameter: key,
                        value: value
                    });
                    throw new errorHandler_1.AppError('Недопустимые символы в параметрах', 400);
                }
            }
        }
    }
    next();
};
exports.sanitizeParams = sanitizeParams;
// Проверка заголовков безопасности
const securityHeaders = (req, res, next) => {
    // Устанавливаем безопасные заголовки
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Content-Security-Policy': "default-src 'self'",
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
    });
    next();
};
exports.securityHeaders = securityHeaders;
// Проверка User-Agent (базовая защита от ботов)
const validateUserAgent = (req, res, next) => {
    const userAgent = req.get('User-Agent');
    if (!userAgent) {
        logger_1.securityLogger.logSuspiciousActivity(req, 'Missing User-Agent header');
        throw new errorHandler_1.AppError('User-Agent обязателен', 400);
    }
    // Проверяем на подозрительные User-Agent
    const suspiciousAgents = [
        /sqlmap/i,
        /nikto/i,
        /nessus/i,
        /openvas/i,
        /nmap/i,
        /masscan/i,
        /zap/i,
        /gobuster/i,
        /dirb/i,
        /dirbuster/i
    ];
    for (const pattern of suspiciousAgents) {
        if (pattern.test(userAgent)) {
            logger_1.securityLogger.logSuspiciousActivity(req, 'Suspicious User-Agent', {
                userAgent
            });
            throw new errorHandler_1.AppError('Доступ запрещен', 403);
        }
    }
    next();
};
exports.validateUserAgent = validateUserAgent;
// Middleware для администраторских эндпоинтов (ОТКЛЮЧЕН - без ограничений)
const adminRateLimit = (req, res, next) => {
    // Пропускаем без ограничений для админов
    next();
};
exports.adminRateLimit = adminRateLimit;
// Middleware для публичных эндпоинтов
exports.publicRateLimit = (0, exports.rateLimit)({
    windowMs: 15 * 60 * 1000, // 15 минут
    max: 1000, // 1000 запросов на 15 минут для обычных пользователей
    message: 'Слишком много запросов'
});
// Middleware для авторизации (ОТКЛЮЧЕН - без ограничений)
// export const authRateLimit = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 минут
//   max: 5, // 5 попыток авторизации на 15 минут
//   message: 'Превышен лимит запросов'
// });
