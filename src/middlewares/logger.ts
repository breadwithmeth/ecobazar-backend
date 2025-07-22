import { Request, Response, NextFunction } from 'express';

interface LogData {
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  userId?: number;
  status?: number;
  responseTime?: number;
  timestamp: Date;
}

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Получаем информацию о запросе
  const logData: LogData = {
    method: req.method,
    url: req.url,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    timestamp: new Date()
  };
  
  // Добавляем userId если есть авторизованный пользователь
  const authReq = req as any;
  if (authReq.user?.id) {
    logData.userId = authReq.user.id;
  }
  
  // Логируем запрос
  console.log(`📨 ${logData.method} ${logData.url} - ${logData.ip}`, {
    ...logData,
    body: shouldLogBody(req) ? req.body : '[СКРЫТО]'
  });
  
  // Перехватываем ответ
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    logData.status = res.statusCode;
    logData.responseTime = responseTime;
    
    // Логируем ответ
    const statusEmoji = getStatusEmoji(res.statusCode);
    console.log(`📤 ${statusEmoji} ${logData.method} ${logData.url} - ${res.statusCode} - ${responseTime}ms`, {
      ...logData,
      responseSize: data?.length || 0
    });
    
    return originalSend.call(this, data);
  };
  
  next();
};

function shouldLogBody(req: Request): boolean {
  // Не логируем пароли и токены
  const sensitiveRoutes = ['/api/auth'];
  return !sensitiveRoutes.some(route => req.url.startsWith(route));
}

function getStatusEmoji(status: number): string {
  if (status >= 200 && status < 300) return '✅';
  if (status >= 300 && status < 400) return '🔄';
  if (status >= 400 && status < 500) return '❌';
  if (status >= 500) return '💥';
  return '❓';
}

// Логирование ошибок безопасности
export const securityLogger = {
  logFailedAuth: (req: Request, reason: string) => {
    console.warn('🔒 SECURITY: Failed authentication attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      reason,
      timestamp: new Date()
    });
  },
  
  logSuspiciousActivity: (req: Request, activity: string, details?: any) => {
    console.warn('⚠️ SECURITY: Suspicious activity detected', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      activity,
      details,
      timestamp: new Date()
    });
  },
  
  logUnauthorizedAccess: (req: Request, resource: string) => {
    console.warn('🚫 SECURITY: Unauthorized access attempt', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      url: req.url,
      resource,
      userId: (req as any).user?.id,
      timestamp: new Date()
    });
  }
};
