"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsMiddleware = exports.metricsService = void 0;
class MetricsService {
    constructor() {
        this.metrics = {
            totalRequests: 0,
            requestsByEndpoint: new Map(),
            requestsByMethod: new Map(),
            responseTimesByEndpoint: new Map(),
            errorsByEndpoint: new Map(),
            errorsByStatus: new Map(),
            activeConnections: 0,
            memoryUsage: process.memoryUsage(),
            uptime: 0,
            lastReset: new Date()
        };
    }
    incrementRequest(method, endpoint) {
        this.metrics.totalRequests++;
        const currentMethod = this.metrics.requestsByMethod.get(method) || 0;
        this.metrics.requestsByMethod.set(method, currentMethod + 1);
        const currentEndpoint = this.metrics.requestsByEndpoint.get(endpoint) || 0;
        this.metrics.requestsByEndpoint.set(endpoint, currentEndpoint + 1);
    }
    recordResponseTime(endpoint, responseTime) {
        const times = this.metrics.responseTimesByEndpoint.get(endpoint) || [];
        times.push(responseTime);
        // Сохраняем только последние 100 измерений для каждого эндпоинта
        if (times.length > 100) {
            times.shift();
        }
        this.metrics.responseTimesByEndpoint.set(endpoint, times);
    }
    incrementError(endpoint, statusCode) {
        const currentEndpoint = this.metrics.errorsByEndpoint.get(endpoint) || 0;
        this.metrics.errorsByEndpoint.set(endpoint, currentEndpoint + 1);
        const currentStatus = this.metrics.errorsByStatus.get(statusCode) || 0;
        this.metrics.errorsByStatus.set(statusCode, currentStatus + 1);
    }
    incrementActiveConnections() {
        this.metrics.activeConnections++;
    }
    decrementActiveConnections() {
        this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
    }
    updateMemoryUsage() {
        this.metrics.memoryUsage = process.memoryUsage();
    }
    getMetrics() {
        this.updateMemoryUsage();
        this.metrics.uptime = process.uptime();
        return Object.assign(Object.assign({}, this.metrics), { requestsByEndpoint: Object.fromEntries(this.metrics.requestsByEndpoint), requestsByMethod: Object.fromEntries(this.metrics.requestsByMethod), errorsByEndpoint: Object.fromEntries(this.metrics.errorsByEndpoint), errorsByStatus: Object.fromEntries(this.metrics.errorsByStatus), averageResponseTimes: this.getAverageResponseTimes(), memoryUsage: Object.assign(Object.assign({}, this.metrics.memoryUsage), { usedMemoryMB: Math.round(this.metrics.memoryUsage.rss / 1024 / 1024), heapUsedMB: Math.round(this.metrics.memoryUsage.heapUsed / 1024 / 1024), heapTotalMB: Math.round(this.metrics.memoryUsage.heapTotal / 1024 / 1024) }) });
    }
    getAverageResponseTimes() {
        const averages = {};
        for (const [endpoint, times] of this.metrics.responseTimesByEndpoint) {
            const sum = times.reduce((acc, time) => acc + time, 0);
            averages[endpoint] = Math.round(sum / times.length);
        }
        return averages;
    }
    getHealthStatus() {
        const metrics = this.getMetrics();
        const memUsedMB = metrics.memoryUsage.usedMemoryMB;
        const totalErrors = Array.from(this.metrics.errorsByStatus.values())
            .reduce((sum, count) => sum + count, 0);
        const errorRate = this.metrics.totalRequests > 0
            ? (totalErrors / this.metrics.totalRequests) * 100
            : 0;
        let status = 'healthy';
        const issues = [];
        // Проверяем использование памяти
        if (memUsedMB > 500) {
            status = 'warning';
            issues.push(`Высокое использование памяти: ${memUsedMB}MB`);
        }
        // Проверяем частоту ошибок
        if (errorRate > 5) {
            status = 'critical';
            issues.push(`Высокая частота ошибок: ${errorRate.toFixed(2)}%`);
        }
        return {
            status,
            issues,
            timestamp: new Date(),
            metrics: {
                uptime: metrics.uptime,
                memoryUsedMB: memUsedMB,
                totalRequests: metrics.totalRequests,
                errorRate: errorRate.toFixed(2),
                activeConnections: metrics.activeConnections
            }
        };
    }
    reset() {
        this.metrics = {
            totalRequests: 0,
            requestsByEndpoint: new Map(),
            requestsByMethod: new Map(),
            responseTimesByEndpoint: new Map(),
            errorsByEndpoint: new Map(),
            errorsByStatus: new Map(),
            activeConnections: this.metrics.activeConnections, // Не сбрасываем активные соединения
            memoryUsage: process.memoryUsage(),
            uptime: 0,
            lastReset: new Date()
        };
    }
}
exports.metricsService = new MetricsService();
// Middleware для сбора метрик
const metricsMiddleware = (req, res, next) => {
    var _a;
    const startTime = Date.now();
    const endpoint = `${req.method} ${((_a = req.route) === null || _a === void 0 ? void 0 : _a.path) || req.path}`;
    // Увеличиваем счетчики
    exports.metricsService.incrementRequest(req.method, endpoint);
    exports.metricsService.incrementActiveConnections();
    // Перехватываем завершение ответа
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const responseTime = Date.now() - startTime;
        // Записываем время ответа
        exports.metricsService.recordResponseTime(endpoint, responseTime);
        // Если ошибка, записываем её
        if (res.statusCode >= 400) {
            exports.metricsService.incrementError(endpoint, res.statusCode);
        }
        // Уменьшаем счетчик активных соединений
        exports.metricsService.decrementActiveConnections();
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
};
exports.metricsMiddleware = metricsMiddleware;
// Периодическое обновление метрик памяти
setInterval(() => {
    exports.metricsService.updateMemoryUsage();
}, 30000); // Каждые 30 секунд
