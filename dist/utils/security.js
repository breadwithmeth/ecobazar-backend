"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityService = void 0;
const errorHandler_1 = require("../middlewares/errorHandler");
const logger_1 = require("./logger");
const crypto_1 = __importDefault(require("crypto"));
class SecurityService {
    constructor() {
        this.rateLimitStore = new Map();
        this.blockedIPs = new Set();
        this.suspiciousIPs = new Map();
        this.config = {
            rateLimits: {
                general: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests per 15 minutes
                admin: { windowMs: 15 * 60 * 1000, max: 200 } // 200 admin requests per 15 minutes
            },
            maxViolations: 5,
            blockDuration: 60 * 60 * 1000 // 1 hour
        };
    }
    // Rate limiting
    rateLimit(type = 'general') {
        return (req, res, next) => {
            const ip = this.getClientIP(req);
            // Проверяем, заблокирован ли IP
            if (this.blockedIPs.has(ip)) {
                logger_1.logger.logSecurityEvent('Blocked IP Access Attempt', req, { ip });
                throw new errorHandler_1.AppError('IP заблокирован', 429);
            }
            const config = this.config.rateLimits[type];
            const key = `${ip}:${type}`;
            const now = Date.now();
            // Очищаем истекшие записи
            if (this.rateLimitStore.has(key)) {
                const entry = this.rateLimitStore.get(key);
                if (entry.resetTime < now) {
                    this.rateLimitStore.delete(key);
                }
            }
            // Инициализируем или обновляем счетчик
            if (!this.rateLimitStore.has(key)) {
                this.rateLimitStore.set(key, {
                    count: 1,
                    resetTime: now + config.windowMs,
                    violations: 0
                });
            }
            else {
                const entry = this.rateLimitStore.get(key);
                entry.count++;
                // Проверяем лимит
                if (entry.count > config.max) {
                    entry.violations++;
                    logger_1.logger.logSecurityEvent('Rate Limit Exceeded', req, {
                        ip,
                        type,
                        count: entry.count,
                        max: config.max,
                        violations: entry.violations
                    });
                    // Если много нарушений, блокируем IP
                    if (entry.violations >= this.config.maxViolations) {
                        this.blockIP(ip, req);
                    }
                    throw new errorHandler_1.AppError('Слишком много запросов', 429);
                }
            }
            // Добавляем заголовки
            const entry = this.rateLimitStore.get(key);
            res.set({
                'X-RateLimit-Limit': config.max.toString(),
                'X-RateLimit-Remaining': (config.max - entry.count).toString(),
                'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
            });
            next();
        };
    }
    // Блокировка IP
    blockIP(ip, req) {
        this.blockedIPs.add(ip);
        logger_1.logger.logSecurityEvent('IP Blocked', req, {
            ip,
            reason: 'Multiple rate limit violations',
            duration: this.config.blockDuration
        });
        // Автоматически разблокируем через blockDuration
        setTimeout(() => {
            this.blockedIPs.delete(ip);
            logger_1.logger.info(`IP разблокирован: ${ip}`);
        }, this.config.blockDuration);
    }
    // Получение IP клиента
    getClientIP(req) {
        return (req.headers['x-forwarded-for'] ||
            req.headers['x-real-ip'] ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            'unknown').split(',')[0].trim();
    }
    // Проверка подозрительной активности
    detectSuspiciousActivity() {
        return (req, res, next) => {
            const ip = this.getClientIP(req);
            const userAgent = req.get('User-Agent') || '';
            // Проверяем подозрительные паттерны
            const suspiciousPatterns = [
                /bot|crawler|spider/i,
                /sqlmap|nikto|nessus|openvas/i,
                /nmap|masscan|zap/i,
                /gobuster|dirb|dirbuster/i
            ];
            if (suspiciousPatterns.some(pattern => pattern.test(userAgent))) {
                this.incrementSuspiciousActivity(ip, req, 'Suspicious User-Agent');
                throw new errorHandler_1.AppError('Доступ запрещен', 403);
            }
            // Проверяем отсутствие User-Agent
            if (!userAgent) {
                this.incrementSuspiciousActivity(ip, req, 'Missing User-Agent');
                throw new errorHandler_1.AppError('User-Agent обязателен', 400);
            }
            next();
        };
    }
    incrementSuspiciousActivity(ip, req, reason) {
        const current = this.suspiciousIPs.get(ip) || 0;
        this.suspiciousIPs.set(ip, current + 1);
        logger_1.logger.logSecurityEvent('Suspicious Activity', req, {
            ip,
            reason,
            activityCount: current + 1
        });
        // Если слишком много подозрительной активности, блокируем
        if (current + 1 >= 3) {
            this.blockIP(ip, req);
        }
    }
    // Проверка SQL injection в параметрах
    sqlInjectionProtection() {
        return (req, res, next) => {
            const suspicious = [
                /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
                /((\%3D)|(=))[^\n]*((\%27)|(\')|(\-\-)|(\%3B)|(;))/i,
                /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/i,
                /((\%27)|(\'))union/i,
                /select.*from/i,
                /insert.*into/i,
                /delete.*from/i,
                /update.*set/i,
                /drop.*table/i
            ];
            const checkObject = (obj, objName) => {
                for (const [key, value] of Object.entries(obj)) {
                    if (typeof value === 'string') {
                        for (const pattern of suspicious) {
                            if (pattern.test(value)) {
                                logger_1.logger.logSecurityEvent('SQL Injection Attempt', req, {
                                    object: objName,
                                    field: key,
                                    value: value.substring(0, 100) // Ограничиваем для логов
                                });
                                throw new errorHandler_1.AppError('Обнаружена попытка SQL injection', 400);
                            }
                        }
                    }
                }
            };
            // Проверяем параметры, query и body
            checkObject(req.params, 'params');
            checkObject(req.query, 'query');
            if (req.body && typeof req.body === 'object') {
                checkObject(req.body, 'body');
            }
            next();
        };
    }
    // Валидация Content-Type
    validateContentType() {
        return (req, res, next) => {
            if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
                const contentType = req.get('Content-Type');
                if (!contentType || !contentType.includes('application/json')) {
                    logger_1.logger.logSecurityEvent('Invalid Content-Type', req, { contentType });
                    throw new errorHandler_1.AppError('Content-Type должен быть application/json', 400);
                }
            }
            next();
        };
    }
    // Проверка размера тела запроса
    validateBodySize(maxSize = 10 * 1024 * 1024) {
        return (req, res, next) => {
            const contentLength = parseInt(req.get('Content-Length') || '0');
            if (contentLength > maxSize) {
                logger_1.logger.logSecurityEvent('Large Request Body', req, {
                    size: contentLength,
                    maxSize
                });
                throw new errorHandler_1.AppError('Размер запроса превышает лимит', 413);
            }
            next();
        };
    }
    // Безопасные заголовки
    securityHeaders() {
        return (req, res, next) => {
            // Устанавливаем безопасные заголовки
            res.set({
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Referrer-Policy': 'strict-origin-when-cross-origin',
                'Content-Security-Policy': "default-src 'self'",
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'X-Powered-By': 'EcoBazar', // Скрываем Express
                'Server': 'EcoBazar' // Скрываем версию сервера
            });
            next();
        };
    }
    // Генерация CSRF токена
    generateCSRFToken() {
        return crypto_1.default.randomBytes(32).toString('hex');
    }
    // Проверка CSRF токена
    validateCSRFToken(token, sessionToken) {
        return crypto_1.default.timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(sessionToken, 'hex'));
    }
    // Получение статистики безопасности
    getSecurityStats() {
        return {
            blockedIPs: Array.from(this.blockedIPs),
            suspiciousIPs: Object.fromEntries(this.suspiciousIPs),
            rateLimitEntries: this.rateLimitStore.size,
            config: this.config
        };
    }
    // Очистка устаревших записей
    cleanup() {
        const now = Date.now();
        // Очищаем rate limit записи
        for (const [key, entry] of this.rateLimitStore.entries()) {
            if (entry.resetTime < now) {
                this.rateLimitStore.delete(key);
            }
        }
        // Очищаем подозрительную активность (раз в час)
        if (Math.random() < 0.1) { // 10% шанс
            this.suspiciousIPs.clear();
        }
    }
}
exports.securityService = new SecurityService();
// Запускаем очистку каждые 5 минут
setInterval(() => {
    exports.securityService.cleanup();
}, 5 * 60 * 1000);
