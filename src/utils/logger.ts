import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const appendFile = promisify(fs.appendFile);

// Типы логов
export enum LogLevel {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

interface RequestLogEntry extends LogEntry {
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  userId?: number;
  responseTime?: number;
  statusCode?: number;
}

class Logger {
  private logDir: string;
  private isDevelopment: boolean;

  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    const { level, message, timestamp, metadata } = entry;
    const metaStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
    return `[${timestamp.toISOString()}] ${level}: ${message}${metaStr}\n`;
  }

  private async writeToFile(filename: string, content: string) {
    try {
      const filePath = path.join(this.logDir, filename);
      await appendFile(filePath, content);
    } catch (error) {
      console.error('Ошибка записи лога:', error);
    }
  }

  private getLogFileName(level: LogLevel): string {
    const date = new Date().toISOString().split('T')[0];
    return `${level.toLowerCase()}-${date}.log`;
  }

  async log(level: LogLevel, message: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
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
    await this.writeToFile(this.getLogFileName(level), logContent);
    
    // Критичные ошибки дублируем в общий лог
    if (level === LogLevel.ERROR) {
      await this.writeToFile('app.log', logContent);
    }
  }

  private getConsoleColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.ERROR: return '\x1b[31m'; // Red
      case LogLevel.WARN: return '\x1b[33m';  // Yellow
      case LogLevel.INFO: return '\x1b[36m';  // Cyan
      case LogLevel.DEBUG: return '\x1b[37m'; // White
      default: return '\x1b[0m';
    }
  }

  async error(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.ERROR, message, metadata);
  }

  async warn(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.WARN, message, metadata);
  }

  async info(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.INFO, message, metadata);
  }

  async debug(message: string, metadata?: Record<string, any>) {
    await this.log(LogLevel.DEBUG, message, metadata);
  }

  // Специализированные методы логирования
  async logRequest(req: Request, res: Response, responseTime: number) {
    const authReq = req as any;
    const entry: RequestLogEntry = {
      level: LogLevel.INFO,
      message: 'HTTP Request',
      timestamp: new Date(),
      method: req.method,
      url: req.url,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      userId: authReq.user?.id,
      responseTime,
      statusCode: res.statusCode
    };

    const filename = `requests-${new Date().toISOString().split('T')[0]}.log`;
    await this.writeToFile(filename, this.formatLogEntry(entry));
  }

  async logError(error: Error, req?: Request, additionalInfo?: Record<string, any>) {
    const metadata: Record<string, any> = {
      stack: error.stack,
      name: error.name,
      ...additionalInfo
    };

    if (req) {
      metadata.request = {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id
      };
    }

    await this.error(error.message, metadata);
  }

  async logSecurityEvent(event: string, req: Request, details?: Record<string, any>) {
    const metadata = {
      event,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      method: req.method,
      userId: (req as any).user?.id,
      ...details
    };

    await this.warn(`Security Event: ${event}`, metadata);
    
    // Записываем в отдельный файл безопасности
    const filename = `security-${new Date().toISOString().split('T')[0]}.log`;
    await this.writeToFile(filename, this.formatLogEntry({
      level: LogLevel.WARN,
      message: `Security Event: ${event}`,
      timestamp: new Date(),
      metadata
    }));
  }

  async logDatabase(operation: string, table: string, duration: number, error?: Error) {
    const metadata = {
      operation,
      table,
      duration,
      error: error?.message
    };

    const level = error ? LogLevel.ERROR : LogLevel.DEBUG;
    const message = error ? `DB Error: ${operation}` : `DB Query: ${operation}`;
    
    await this.log(level, message, metadata);
  }

  // Очистка старых логов (более 30 дней)
  async cleanupOldLogs() {
    try {
      const files = fs.readdirSync(this.logDir);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < thirtyDaysAgo) {
          fs.unlinkSync(filePath);
          await this.info(`Удален старый лог файл: ${file}`);
        }
      }
    } catch (error) {
      await this.error('Ошибка очистки логов', { error: (error as Error).message });
    }
  }
}

export const logger = new Logger();

// Middleware для логирования запросов
export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();

  // Перехватываем завершение ответа
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const responseTime = Date.now() - startTime;
    
    // Логируем запрос асинхронно
    logger.logRequest(req, res, responseTime).catch(err => 
      console.error('Ошибка логирования запроса:', err)
    );
    
    return originalEnd.call(this, chunk, encoding, cb);
  };

  next();
};

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
    logger.cleanupOldLogs();
    scheduleLogCleanup(); // Планируем следующую очистку
  }, timeUntilNextRun);
};

scheduleLogCleanup();
