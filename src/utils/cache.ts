// Простая реализация кэша в памяти
// В продакшене следует использовать Redis

interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

export class CacheService {
  private cache = new Map<string, CacheItem<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 минут по умолчанию

  set<T>(key: string, data: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expiresAt });
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Очистка истекших записей
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  // Получение размера кэша
  size(): number {
    return this.cache.size;
  }

  // Мемоизация функций
  async memoize<T>(
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const result = await fn();
    this.set(key, result, ttl);
    return result;
  }

  // Генерация ключей для пагинации
  static generatePaginationKey(
    prefix: string,
    page: number,
    limit: number,
    filters?: Record<string, any>
  ): string {
    const filterStr = filters ? JSON.stringify(filters) : '';
    return `${prefix}:page:${page}:limit:${limit}:filters:${filterStr}`;
  }

  // Генерация ключей для отдельных ресурсов
  static generateResourceKey(resource: string, id: number | string): string {
    return `${resource}:${id}`;
  }

  // Инвалидация по паттерну
  invalidatePattern(pattern: string): void {
    // Преобразуем glob-паттерн в регулярное выражение
    const globToRegex = (glob: string): string => {
      // Экранируем специальные символы регулярных выражений, кроме *
      const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
      // Заменяем * на .*
      return escaped.replace(/\*/g, '.*');
    };
    
    const regexPattern = globToRegex(pattern);
    const regex = new RegExp(`^${regexPattern}$`);
    
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}

// Создаем глобальный экземпляр кэша
export const cacheService = new CacheService();

// Запускаем периодическую очистку каждые 10 минут
setInterval(() => {
  cacheService.cleanup();
}, 10 * 60 * 1000);
