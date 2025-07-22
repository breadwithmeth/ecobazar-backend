"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLoggerMiddleware = exports.logger = exports.LogLevel = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const util_1 = require("util");
const appendFile = (0, util_1.promisify)(fs_1.default.appendFile);
// Типы логов
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "ERROR";
    LogLevel["WARN"] = "WARN";
    LogLevel["INFO"] = "INFO";
    LogLevel["DEBUG"] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
class Logger {
    constructor() {
        this.logDir = path_1.default.join(process.cwd(), 'logs');
        this.isDevelopment = process.env.NODE_ENV === 'development';
        this.ensureLogDirectory();
    }
    ensureLogDirectory() {
        if (!fs_1.default.existsSync(this.logDir)) {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
    }
    formatLogEntry(entry) {
        const { level, message, timestamp, metadata } = entry;
        const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
        return `[${timestamp.toISOString()}] ${level}: ${message}${metaStr}\n`;
    }
    writeToFile(filename, content) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filePath = path_1.default.join(this.logDir, filename);
                yield appendFile(filePath, content);
            }
            catch (error) {
                console.error('Ошибка записи лога:', error);
            }
        });
    }
    getLogFileName(level) {
        const date = new Date().toISOString().split('T')[0];
        return `${level.toLowerCase()}-${date}.log`;
    }
    log(level, message, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const entry = {
                level,
                message,
                timestamp: new Date(),
                metadata
            };
            // В development выводим в консоль
            if (this.isDevelopment) {
                const color = this.getConsoleColor(level);
                console.log(`${color}[${entry.timestamp.toISOString()}] ${level}: ${message}${metadata ? ` ${JSON.stringify(metadata)}` : ''}\x1b[0m`);
            }
            // Всегда записываем в файл
            const logContent = this.formatLogEntry(entry);
            yield this.writeToFile(this.getLogFileName(level), logContent);
            // Критичные ошибки дублируем в общий лог
            if (level === LogLevel.ERROR) {
                yield this.writeToFile('app.log', logContent);
            }
        });
    }
    getConsoleColor(level) {
        switch (level) {
            case LogLevel.ERROR: return '\x1b[31m'; // Red
            case LogLevel.WARN: return '\x1b[33m'; // Yellow
            case LogLevel.INFO: return '\x1b[36m'; // Cyan
            case LogLevel.DEBUG: return '\x1b[37m'; // White
            default: return '\x1b[0m';
        }
    }
    error(message, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.log(LogLevel.ERROR, message, metadata);
        });
    }
    warn(message, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.log(LogLevel.WARN, message, metadata);
        });
    }
    info(message, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.log(LogLevel.INFO, message, metadata);
        });
    }
    debug(message, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.log(LogLevel.DEBUG, message, metadata);
        });
    }
    // Специализированные методы логирования
    logRequest(req, res, responseTime) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const authReq = req;
            const entry = {
                level: LogLevel.INFO,
                message: 'HTTP Request',
                timestamp: new Date(),
                method: req.method,
                url: req.url,
                ip: req.ip || req.connection.remoteAddress || 'unknown',
                userAgent: req.get('User-Agent') || 'unknown',
                userId: (_a = authReq.user) === null || _a === void 0 ? void 0 : _a.id,
                responseTime,
                statusCode: res.statusCode
            };
            const filename = `requests-${new Date().toISOString().split('T')[0]}.log`;
            yield this.writeToFile(filename, this.formatLogEntry(entry));
        });
    }
    logError(error, req, additionalInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const metadata = Object.assign({ stack: error.stack, name: error.name }, additionalInfo);
            if (req) {
                metadata.request = {
                    method: req.method,
                    url: req.url,
                    ip: req.ip,
                    userAgent: req.get('User-Agent'),
                    userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id
                };
            }
            yield this.error(error.message, metadata);
        });
    }
    logSecurityEvent(event, req, details) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const metadata = Object.assign({ event, ip: req.ip, userAgent: req.get('User-Agent'), url: req.url, method: req.method, userId: (_a = req.user) === null || _a === void 0 ? void 0 : _a.id }, details);
            yield this.warn(`Security Event: ${event}`, metadata);
            // Записываем в отдельный файл безопасности
            const filename = `security-${new Date().toISOString().split('T')[0]}.log`;
            yield this.writeToFile(filename, this.formatLogEntry({
                level: LogLevel.WARN,
                message: `Security Event: ${event}`,
                timestamp: new Date(),
                metadata
            }));
        });
    }
    logDatabase(operation, table, duration, error) {
        return __awaiter(this, void 0, void 0, function* () {
            const metadata = {
                operation,
                table,
                duration,
                error: error === null || error === void 0 ? void 0 : error.message
            };
            const level = error ? LogLevel.ERROR : LogLevel.DEBUG;
            const message = error ? `DB Error: ${operation}` : `DB Query: ${operation}`;
            yield this.log(level, message, metadata);
        });
    }
    // Очистка старых логов (более 30 дней)
    cleanupOldLogs() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const files = fs_1.default.readdirSync(this.logDir);
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                for (const file of files) {
                    const filePath = path_1.default.join(this.logDir, file);
                    const stats = fs_1.default.statSync(filePath);
                    if (stats.mtime < thirtyDaysAgo) {
                        fs_1.default.unlinkSync(filePath);
                        yield this.info(`Удален старый лог файл: ${file}`);
                    }
                }
            }
            catch (error) {
                yield this.error('Ошибка очистки логов', { error: error.message });
            }
        });
    }
}
exports.logger = new Logger();
// Middleware для логирования запросов
const requestLoggerMiddleware = (req, res, next) => {
    const startTime = Date.now();
    // Перехватываем завершение ответа
    const originalEnd = res.end;
    res.end = function (chunk, encoding, cb) {
        const responseTime = Date.now() - startTime;
        // Логируем запрос асинхронно
        exports.logger.logRequest(req, res, responseTime).catch(err => console.error('Ошибка логирования запроса:', err));
        return originalEnd.call(this, chunk, encoding, cb);
    };
    next();
};
exports.requestLoggerMiddleware = requestLoggerMiddleware;
// Запускаем очистку логов каждый день в 3:00
const scheduleLogCleanup = () => {
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setHours(3, 0, 0, 0);
    if (nextRun <= now) {
        nextRun.setDate(nextRun.getDate() + 1);
    }
    const timeUntilNextRun = nextRun.getTime() - now.getTime();
    setTimeout(() => {
        exports.logger.cleanupOldLogs();
        scheduleLogCleanup(); // Планируем следующую очистку
    }, timeUntilNextRun);
};
scheduleLogCleanup();
