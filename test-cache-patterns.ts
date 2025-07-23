// Тест функции invalidatePattern для проверки glob-паттернов

class TestCacheService {
  private cache = new Map<string, any>();

  set(key: string, value: any): void {
    this.cache.set(key, value);
  }

  // Копия исправленной функции invalidatePattern
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
    
    const deletedKeys: string[] = [];
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedKeys.push(key);
      }
    }
    
    console.log(`Pattern: ${pattern}`);
    console.log(`Regex: ^${regexPattern}$`);
    console.log(`Deleted keys:`, deletedKeys);
    console.log('---');
  }

  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }
}

// Тестируем различные паттерны
const testCache = new TestCacheService();

// Добавляем тестовые данные
testCache.set('courier:1:orders', 'data1');
testCache.set('courier:2:orders', 'data2');
testCache.set('order:10:details', 'data3');
testCache.set('order:20:details', 'data4');
testCache.set('admin:orders:list', 'data5');
testCache.set('products:list', 'data6');
testCache.set('user:5:profile', 'data7');

console.log('Initial keys:', testCache.getKeys());
console.log('\\n=== Testing patterns ===\\n');

// Тестируем проблемные паттерны
testCache.invalidatePattern('courier:1:*');
testCache.invalidatePattern('*order:10*');
testCache.invalidatePattern('admin:orders:*');

console.log('\\nRemaining keys:', testCache.getKeys());

export {};
