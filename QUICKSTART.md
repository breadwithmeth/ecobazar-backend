# 🚀 Быстрый старт EcoBazar Backend v2.0

Пошаговое руководство для запуска улучшенной версии EcoBazar Backend.

## ⚡ Быстрая установка (5 минут)

### 1. Установите зависимости
```bash
npm install
```

### 2. Создайте файл окружения
Создайте файл `.env` в корне проекта:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/ecobazar"
JWT_SECRET="your-super-secret-jwt-key-min-32-chars"
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:3001"
METRICS_TOKEN="metrics-secret-token"
ADMIN_TOKEN="admin-secret-token"
```

### 3. Настройте базу данных
```bash
# Генерация Prisma клиента
npm run db:generate

# Применение миграций
npm run db:migrate

# Заполнение тестовыми данными (опционально)
npm run db:seed
```

### 4. Запустите сервер
```bash
# Улучшенная версия V2 (рекомендуется)
npm run dev:v2

# Или оригинальная версия
npm run dev
```

Сервер запустится на http://localhost:4000

## 🧪 Проверка работоспособности

### Health Check
```bash
curl http://localhost:4000/health
```

Ожидаемый ответ:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-21T10:00:00.000Z",
  "version": "2.0.0",
  "environment": "development",
  "uptime": 60,
  "metrics": {
    "memoryUsedMB": 45.2,
    "totalRequests": 1,
    "errorRate": "0",
    "activeConnections": 1
  }
}
```

### Тестовая авторизация
```bash
curl -X POST http://localhost:4000/api/auth \
  -H "Content-Type: application/json" \
  -d '{"telegram_user_id": "123456789"}'
```

Ожидаемый ответ:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "telegram_user_id": "123456789",
      "role": "CUSTOMER"
    }
  }
}
```

### Получение продуктов
```bash
curl http://localhost:4000/api/products
```

## 🆚 Сравнение версий

| Функция | V1 (оригинал) | V2 (улучшенная) |
|---------|---------------|------------------|
| **Архитектура** | Контроллеры + Prisma | Сервисный слой |
| **Валидация** | Базовая | Zod схемы |
| **Безопасность** | JWT + основная | Расширенная защита |
| **Кэширование** | Нет | Встроенное |
| **Мониторинг** | Нет | Полные метрики |
| **Логирование** | Простое | Структурированное |
| **Тестирование** | Нет | Jest + полное покрытие |
| **Эндпоинты** | /api/* | /api/* + /metrics + /health |

## 📊 Новые возможности V2

### 1. Мониторинг и метрики
```bash
# Системные метрики
curl http://localhost:4000/metrics

# Статистика безопасности (требует ADMIN_TOKEN)
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:4000/security-stats
```

### 2. Кэширование
- Автоматическое кэширование запросов продуктов (5 мин)
- Кэширование отдельных продуктов (10 мин)
- Кэширование заказов и склада (2 мин)

### 3. Улучшенная безопасность
- Rate limiting: 1000 запросов/15 мин для обычных пользователей
- Auth rate limiting: 5 попыток/15 мин
- Автоблокировка подозрительных IP
- Защита от SQL injection и XSS

### 4. Продвинутое логирование
```bash
# Просмотр логов
tail -f logs/app.log        # Основные логи
tail -f logs/error.log      # Ошибки
tail -f logs/security.log   # События безопасности
```

## 🛠️ Команды разработки

### Разработка
```bash
npm run dev              # Оригинальная версия
npm run dev:v2           # Улучшенная версия (рекомендуется)
```

### Тестирование
```bash
npm test                 # Запуск всех тестов
npm run test:watch       # Тесты в watch режиме
npm run test:coverage    # Покрытие кода
```

### Продакшн
```bash
npm run build           # Сборка проекта
npm run start:v2        # Запуск в продакшне
```

### База данных
```bash
npm run db:generate     # Генерация Prisma клиента
npm run db:migrate      # Применение миграций
npm run db:seed         # Заполнение тестовыми данными
npm run db:studio       # Открыть Prisma Studio
npm run db:reset        # Сброс БД (осторожно!)
```

### Качество кода
```bash
npm run lint            # Проверка ESLint
npm run lint:fix        # Автоисправление ESLint
npm run type-check      # Проверка TypeScript
```

## 🔧 Настройка для продакшна

### 1. Переменные окружения
```env
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@prod-host:5432/ecobazar"
JWT_SECRET="secure-64-char-secret-key-for-production-use-only"
PORT=4000
ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"
METRICS_TOKEN="secure-metrics-token"
ADMIN_TOKEN="secure-admin-token"
```

### 2. PM2 конфигурация
Создайте `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'ecobazar-backend',
    script: 'dist/serverV2.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 4000
    }
  }]
};
```

Запуск:
```bash
npm run build
pm2 start ecosystem.config.js --env production
```

### 3. Docker
```bash
# Сборка образа
docker build -t ecobazar-backend .

# Запуск контейнера
docker run -p 4000:4000 --env-file .env ecobazar-backend
```

## 🐛 Устранение неполадок

### Проблема: "Cannot connect to database"
**Решение:**
1. Проверьте что PostgreSQL запущен
2. Убедитесь что `DATABASE_URL` корректный
3. Проверьте что база данных создана
4. Запустите `npm run db:migrate`

### Проблема: "JWT_SECRET is required"
**Решение:**
1. Убедитесь что файл `.env` создан
2. `JWT_SECRET` должен быть длиной минимум 32 символа
3. Перезапустите сервер после изменения `.env`

### Проблема: "Port 4000 is already in use"
**Решение:**
1. Остановите другие процессы на порту 4000
2. Или измените `PORT` в `.env` файле
3. Проверьте: `lsof -ti:4000` и `kill -9 <PID>`

### Проблема: Высокое использование памяти
**Решение:**
1. Проверьте метрики: `curl http://localhost:4000/metrics`
2. Настройте кэш: уменьшите TTL в `src/utils/cache.ts`
3. Оптимизируйте запросы Prisma

### Проблема: Медленные запросы
**Решение:**
1. Включите логирование медленных запросов в Prisma
2. Проверьте индексы в базе данных
3. Используйте кэширование для частых запросов

## 🔍 Отладка

### Включение debug логов
```bash
DEBUG=* npm run dev:v2
```

### Анализ производительности
```bash
# Профилирование памяти
node --inspect dist/serverV2.js

# Анализ медленных запросов
tail -f logs/app.log | grep "slow query"
```

### Мониторинг в реальном времени
```bash
# Метрики системы
watch -n 1 'curl -s http://localhost:4000/metrics | jq .data.memoryUsage'

# Статистика запросов
watch -n 1 'curl -s http://localhost:4000/metrics | jq .data.requests'
```

## 📈 Оптимизация производительности

### 1. Настройки кэша
В `src/utils/cache.ts` настройте TTL:
```typescript
const CACHE_TTL = {
  products: 5 * 60 * 1000,      // 5 минут
  singleProduct: 10 * 60 * 1000, // 10 минут
  orders: 2 * 60 * 1000,        // 2 минуты
};
```

### 2. Оптимизация базы данных
```sql
-- Индексы для частых запросов
CREATE INDEX idx_products_store_category ON products(store_id, category_id);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

### 3. Rate limiting настройки
В `src/utils/security.ts`:
```typescript
const RATE_LIMITS = {
  general: { requests: 1000, window: 15 * 60 * 1000 },  // 1000/15мин
  admin: { requests: 100, window: 15 * 60 * 1000 },     // 100/15мин
};
```

## 🎯 Следующие шаги

1. **Настройте мониторинг**: Интегрируйте с Grafana/Prometheus
2. **Добавьте CI/CD**: GitHub Actions для автодеплоя
3. **Настройте резервное копирование**: Автобэкап базы данных
4. **Оптимизируйте**: Анализ производительности в продакшне
5. **Масштабируйте**: Load balancer + несколько инстансов

## 📞 Поддержка

Если возникли проблемы:
1. Проверьте [API документацию](./API.md)
2. Посмотрите логи в `logs/` папке
3. Создайте Issue в репозитории
4. Проверьте health endpoint: `/health`

---

**Готово!** 🎉 Ваш EcoBazar Backend v2.0 запущен и готов к работе!
