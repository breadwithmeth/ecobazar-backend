import { Request, Response, NextFunction } from 'express';

interface MetricData {
  totalRequests: number;
  requestsByEndpoint: Map<string, number>;
  requestsByMethod: Map<string, number>;
  responseTimesByEndpoint: Map<string, number[]>;
  errorsByEndpoint: Map<string, number>;
  errorsByStatus: Map<number, number>;
  activeConnections: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  lastReset: Date;
}

class MetricsService {
  private metrics: MetricData = {
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

  incrementRequest(method: string, endpoint: string): void {
    this.metrics.totalRequests++;
    
    const currentMethod = this.metrics.requestsByMethod.get(method) || 0;
    this.metrics.requestsByMethod.set(method, currentMethod + 1);
    
    const currentEndpoint = this.metrics.requestsByEndpoint.get(endpoint) || 0;
    this.metrics.requestsByEndpoint.set(endpoint, currentEndpoint + 1);
  }

  recordResponseTime(endpoint: string, responseTime: number): void {
    const times = this.metrics.responseTimesByEndpoint.get(endpoint) || [];
    times.push(responseTime);
    
    // Сохраняем только последние 100 измерений для каждого эндпоинта
    if (times.length > 100) {
      times.shift();
    }
    
    this.metrics.responseTimesByEndpoint.set(endpoint, times);
  }

  incrementError(endpoint: string, statusCode: number): void {
    const currentEndpoint = this.metrics.errorsByEndpoint.get(endpoint) || 0;
    this.metrics.errorsByEndpoint.set(endpoint, currentEndpoint + 1);
    
    const currentStatus = this.metrics.errorsByStatus.get(statusCode) || 0;
    this.metrics.errorsByStatus.set(statusCode, currentStatus + 1);
  }

  incrementActiveConnections(): void {
    this.metrics.activeConnections++;
  }

  decrementActiveConnections(): void {
    this.metrics.activeConnections = Math.max(0, this.metrics.activeConnections - 1);
  }

  updateMemoryUsage(): void {
    this.metrics.memoryUsage = process.memoryUsage();
  }

  getMetrics() {
    this.updateMemoryUsage();
    this.metrics.uptime = process.uptime();
    
    return {
      ...this.metrics,
      requestsByEndpoint: Object.fromEntries(this.metrics.requestsByEndpoint),
      requestsByMethod: Object.fromEntries(this.metrics.requestsByMethod),
      errorsByEndpoint: Object.fromEntries(this.metrics.errorsByEndpoint),
      errorsByStatus: Object.fromEntries(this.metrics.errorsByStatus),
      averageResponseTimes: this.getAverageResponseTimes(),
      memoryUsage: {
        ...this.metrics.memoryUsage,
        usedMemoryMB: Math.round(this.metrics.memoryUsage.rss / 1024 / 1024),
        heapUsedMB: Math.round(this.metrics.memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(this.metrics.memoryUsage.heapTotal / 1024 / 1024)
      }
    };
  }

  private getAverageResponseTimes(): Record<string, number> {
    const averages: Record<string, number> = {};
    
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
    const issues: string[] = [];

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

  reset(): void {
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

export const metricsService = new MetricsService();

// Middleware для сбора метрик
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const endpoint = `${req.method} ${req.route?.path || req.path}`;
  
  // Увеличиваем счетчики
  metricsService.incrementRequest(req.method, endpoint);
  metricsService.incrementActiveConnections();
  
  // Перехватываем завершение ответа
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const responseTime = Date.now() - startTime;
    
    // Записываем время ответа
    metricsService.recordResponseTime(endpoint, responseTime);
    
    // Если ошибка, записываем её
    if (res.statusCode >= 400) {
      metricsService.incrementError(endpoint, res.statusCode);
    }
    
    // Уменьшаем счетчик активных соединений
    metricsService.decrementActiveConnections();
    
    return originalEnd.call(this, chunk, encoding, cb);
  };
  
  next();
};

// Периодическое обновление метрик памяти
setInterval(() => {
  metricsService.updateMemoryUsage();
}, 30000); // Каждые 30 секунд
