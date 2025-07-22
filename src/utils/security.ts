import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler';
import { logger } from './logger';
import crypto from 'crypto';

// Интерфейсы
interface RateLimitEntry {
  count: number;
  resetTime: number;
  violations: number;
}

interface SecurityConfig {
  rateLimits: {
    general: { windowMs: number; max: number };
    admin: { windowMs: number; max: number };
  };
  maxViolations: number;
  blockDuration: number;
}

class SecurityService {
  private rateLimitStore = new Map<string, RateLimitEntry>();
  private blockedIPs = new Set<string>();
  private suspiciousIPs = new Map<string, number>();
  
  private config: SecurityConfig = {
    rateLimits: {
      general: { windowMs: 15 * 60 * 1000, max: 1000 }, // 1000 requests per 15 minutes
      admin: { windowMs: 15 * 60 * 1000, max: 200 }     // 200 admin requests per 15 minutes
    },
    maxViolations: 5,
    blockDuration: 60 * 60 * 1000 // 1 hour
  };

  // Rate limiting
  rateLimit(type: 'general' | 'admin' = 'general') {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = this.getClientIP(req);
      
      // Проверяем, заблокирован ли IP
      if (this.blockedIPs.has(ip)) {
        logger.logSecurityEvent('Blocked IP Access Attempt', req, { ip });
        throw new AppError('IP заблокирован', 429);
      }

      const config = this.config.rateLimits[type];
      const key = `${ip}:${type}`;
      const now = Date.now();

      // Очищаем истекшие записи
      if (this.rateLimitStore.has(key)) {
        const entry = this.rateLimitStore.get(key)!;
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
      } else {
        const entry = this.rateLimitStore.get(key)!;
        entry.count++;
        
        // Проверяем лимит
        if (entry.count > config.max) {
          entry.violations++;
          
          logger.logSecurityEvent('Rate Limit Exceeded', req, {
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
          
          throw new AppError('Слишком много запросов', 429);
        }
      }

      // Добавляем заголовки
      const entry = this.rateLimitStore.get(key)!;
      res.set({
        'X-RateLimit-Limit': config.max.toString(),
        'X-RateLimit-Remaining': (config.max - entry.count).toString(),
        'X-RateLimit-Reset': new Date(entry.resetTime).toISOString()
      });

      next();
    };
  }

  // Блокировка IP
  private blockIP(ip: string, req: Request) {
    this.blockedIPs.add(ip);
    logger.logSecurityEvent('IP Blocked', req, { 
      ip, 
      reason: 'Multiple rate limit violations',
      duration: this.config.blockDuration 
    });
    
    // Автоматически разблокируем через blockDuration
    setTimeout(() => {
      this.blockedIPs.delete(ip);
      logger.info(`IP разблокирован: ${ip}`);
    }, this.config.blockDuration);
  }

  // Получение IP клиента
  private getClientIP(req: Request): string {
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    ).split(',')[0].trim();
  }

  // Проверка подозрительной активности
  detectSuspiciousActivity() {
    return (req: Request, res: Response, next: NextFunction) => {
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
        throw new AppError('Доступ запрещен', 403);
      }

      // Проверяем отсутствие User-Agent
      if (!userAgent) {
        this.incrementSuspiciousActivity(ip, req, 'Missing User-Agent');
        throw new AppError('User-Agent обязателен', 400);
      }

      next();
    };
  }

  private incrementSuspiciousActivity(ip: string, req: Request, reason: string) {
    const current = this.suspiciousIPs.get(ip) || 0;
    this.suspiciousIPs.set(ip, current + 1);
    
    logger.logSecurityEvent('Suspicious Activity', req, { 
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
    return (req: Request, res: Response, next: NextFunction) => {
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

      const checkObject = (obj: any, objName: string) => {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'string') {
            for (const pattern of suspicious) {
              if (pattern.test(value)) {
                logger.logSecurityEvent('SQL Injection Attempt', req, {
                  object: objName,
                  field: key,
                  value: value.substring(0, 100) // Ограничиваем для логов
                });
                throw new AppError('Обнаружена попытка SQL injection', 400);
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
    return (req: Request, res: Response, next: NextFunction) => {
      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
          logger.logSecurityEvent('Invalid Content-Type', req, { contentType });
          throw new AppError('Content-Type должен быть application/json', 400);
        }
      }
      next();
    };
  }

  // Проверка размера тела запроса
  validateBodySize(maxSize: number = 10 * 1024 * 1024) { // 10MB по умолчанию
    return (req: Request, res: Response, next: NextFunction) => {
      const contentLength = parseInt(req.get('Content-Length') || '0');
      if (contentLength > maxSize) {
        logger.logSecurityEvent('Large Request Body', req, {
          size: contentLength,
          maxSize
        });
        throw new AppError('Размер запроса превышает лимит', 413);
      }
      next();
    };
  }

  // Безопасные заголовки
  securityHeaders() {
    return (req: Request, res: Response, next: NextFunction) => {
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
  generateCSRFToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Проверка CSRF токена
  validateCSRFToken(token: string, sessionToken: string): boolean {
    return crypto.timingSafeEqual(
      Buffer.from(token, 'hex'),
      Buffer.from(sessionToken, 'hex')
    );
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

export const securityService = new SecurityService();

// Запускаем очистку каждые 5 минут
setInterval(() => {
  securityService.cleanup();
}, 5 * 60 * 1000);
