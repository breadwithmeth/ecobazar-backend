"use strict";
// Простая реализация кэша в памяти
// В продакшене следует использовать Redis
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheService = exports.CacheService = void 0;
class CacheService {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 минут по умолчанию
    }
    set(key, data, ttl) {
        const expiresAt = Date.now() + (ttl || this.defaultTTL);
        this.cache.set(key, { data, expiresAt });
    }
    get(key) {
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
    delete(key) {
        return this.cache.delete(key);
    }
    clear() {
        this.cache.clear();
    }
    // Очистка истекших записей
    cleanup() {
        const now = Date.now();
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
            }
        }
    }
    // Получение размера кэша
    size() {
        return this.cache.size;
    }
    // Мемоизация функций
    memoize(key, fn, ttl) {
        return __awaiter(this, void 0, void 0, function* () {
            const cached = this.get(key);
            if (cached !== null) {
                return cached;
            }
            const result = yield fn();
            this.set(key, result, ttl);
            return result;
        });
    }
    // Генерация ключей для пагинации
    static generatePaginationKey(prefix, page, limit, filters) {
        const filterStr = filters ? JSON.stringify(filters) : '';
        return `${prefix}:page:${page}:limit:${limit}:filters:${filterStr}`;
    }
    // Генерация ключей для отдельных ресурсов
    static generateResourceKey(resource, id) {
        return `${resource}:${id}`;
    }
    // Инвалидация по паттерну
    invalidatePattern(pattern) {
        // Преобразуем glob-паттерн в регулярное выражение
        const globToRegex = (glob) => {
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
exports.CacheService = CacheService;
// Создаем глобальный экземпляр кэша
exports.cacheService = new CacheService();
// Запускаем периодическую очистку каждые 10 минут
setInterval(() => {
    exports.cacheService.cleanup();
}, 10 * 60 * 1000);
