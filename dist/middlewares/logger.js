"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityLogger = exports.requestLogger = void 0;
const requestLogger = (req, res, next) => {
    var _a;
    const startTime = Date.now();
    // Получаем информацию о запросе
    const logData = {
        method: req.method,
        url: req.url,
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent') || 'unknown',
        timestamp: new Date()
    };
    // Добавляем userId если есть авторизованный пользователь
    const authReq = req;
    if ((_a = authReq.user) === null || _a === void 0 ? void 0 : _a.id) {
        logData.userId = authReq.user.id;
    }
    // Логируем запрос
    console.log(`📨 ${logData.method} ${logData.url} - ${logData.ip}`, Object.assign(Object.assign({}, logData), { body: shouldLogBody(req) ? req.body : '[СКРЫТО]' }));
    // Перехватываем ответ
    const originalSend = res.send;
    res.send = function (data) {
        const responseTime = Date.now() - startTime;
        logData.status = res.statusCode;
        logData.responseTime = responseTime;
        // Логируем ответ
        const statusEmoji = getStatusEmoji(res.statusCode);
        console.log(`📤 ${statusEmoji} ${logData.method} ${logData.url} - ${res.statusCode} - ${responseTime}ms`, Object.assign(Object.assign({}, logData), { responseSize: (data === null || data === void 0 ? void 0 : data.length) || 0 }));
        return originalSend.call(this, data);
    };
    next();
};
exports.requestLogger = requestLogger;
function shouldLogBody(req) {
    // Не логируем пароли и токены
    const sensitiveRoutes = ['/api/auth'];
    return !sensitiveRoutes.some(route => req.url.startsWith(route));
}
function getStatusEmoji(status) {
    if (status >= 200 && status < 300)
        return '✅';
    if (status >= 300 && status < 400)
        return '🔄';
    if (status >= 400 && status < 500)
        return '❌';
    if (status >= 500)
        return '💥';
    return '❓';
}
// Логирование ошибок безопасности
exports.securityLogger = {
    logFailedAuth: (req, reason) => {
        console.warn('🔒 SECURITY: Failed authentication attempt', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            url: req.url,
            reason,
            timestamp: new Date()
        });
    },
    logSuspiciousActivity: (req, activity, details) => {
        console.warn('⚠️ SECURITY: Suspicious activity detected', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            url: req.url,
            activity,
            details,
            timestamp: new Date()
        });
    },
    logUnauthorizedAccess: (req, resource) => {
        var _a;
        console.warn('🚫 SECURITY: Unauthorized access attempt', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            url: req.url,
            resource,
            userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id,
            timestamp: new Date()
        });
    }
};
