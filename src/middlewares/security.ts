import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';
import { securityLogger } from './logger';

// Rate limiting
interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

const rateLimitStore: RateLimitStore = {};

export const rateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return (req: Request, res: Response, next: NextFunction) => {
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
    } else {
      rateLimitStore[key].count++;
    }
    
    // Проверяем лимит
    if (rateLimitStore[key].count > options.max) {
      securityLogger.logSuspiciousActivity(req, 'Rate limit exceeded', {
        count: rateLimitStore[key].count,
        limit: options.max
      });
      
      throw new AppError(
        options.message || 'Слишком много запросов, попробуйте позже',
        429
      );
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

// Валидация Content-Type для POST/PUT запросов
export const validateContentType = (req: Request, res: Response, next: NextFunction) => {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new AppError('Content-Type должен быть application/json', 400);
    }
  }
  next();
};

// Проверка размера тела запроса
export const validateBodySize = (maxSize: number = 1024 * 1024) => { // 1MB по умолчанию
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    if (contentLength > maxSize) {
      securityLogger.logSuspiciousActivity(req, 'Large request body', {
        size: contentLength,
        maxSize
      });
      throw new AppError('Размер запроса превышает лимит', 413);
    }
    next();
  };
};

// Защита от SQL injection в параметрах
export const sanitizeParams = (req: Request, res: Response, next: NextFunction) => {
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
          securityLogger.logSuspiciousActivity(req, 'SQL injection attempt', {
            parameter: key,
            value: value
          });
          throw new AppError('Недопустимые символы в параметрах', 400);
        }
      }
    }
  }
  
  next();
};

// Проверка заголовков безопасности
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
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

// Проверка User-Agent (базовая защита от ботов)
export const validateUserAgent = (req: Request, res: Response, next: NextFunction) => {
  const userAgent = req.get('User-Agent');
  
  if (!userAgent) {
    securityLogger.logSuspiciousActivity(req, 'Missing User-Agent header');
    throw new AppError('User-Agent обязателен', 400);
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
      securityLogger.logSuspiciousActivity(req, 'Suspicious User-Agent', {
        userAgent
      });
      throw new AppError('Доступ запрещен', 403);
    }
  }
  
  next();
};

// Middleware для администраторских эндпоинтов (ОТКЛЮЧЕН - без ограничений)
export const adminRateLimit = (req: any, res: any, next: any) => {
  // Пропускаем без ограничений для админов
  next();
};

// Middleware для публичных эндпоинтов
export const publicRateLimit = rateLimit({
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
